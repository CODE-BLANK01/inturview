import logging
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import (
    FastAPI,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from .auth import bearer_token, verify_session_token
from .config import get_settings
from .metrics import is_usable_transcript, turn_metrics
from .nextjs import NextJsInternal
from .realtime import make_openai_client, mint_client_secret

log = logging.getLogger("realtime")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.nextjs = NextJsInternal()
    app.state.openai = make_openai_client()
    yield
    await app.state.nextjs.aclose()
    await app.state.openai.aclose()


app = FastAPI(title="inturview realtime", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# --------------------------------------------------------------------------
# Realtime session bootstrap
# --------------------------------------------------------------------------


class RealtimeSessionResponse(BaseModel):
    client_secret: str
    max_duration_sec: int


@app.post("/sessions/{session_id}/realtime", response_model=RealtimeSessionResponse)
async def create_realtime_session(
    session_id: str,
    authorization: str | None = Header(default=None),
) -> RealtimeSessionResponse:
    verify_session_token(bearer_token(authorization), session_id)

    nextjs: NextJsInternal = app.state.nextjs
    session = await nextjs.get_session(session_id)
    if session.get("status") != "IN_PROGRESS":
        raise HTTPException(status.HTTP_409_CONFLICT, "Session is not in progress")

    minted = await mint_client_secret(app.state.openai, session["instructions"])
    log.info("minted realtime session sid=%s prior_turns=%s", session_id, session.get("priorTurns"))
    return RealtimeSessionResponse(
        client_secret=minted["client_secret"],
        max_duration_sec=int(session["plan"]["maxDurationSec"]),
    )


# --------------------------------------------------------------------------
# Event ingestion — the browser forwards transcript events here
# --------------------------------------------------------------------------


class Segment(BaseModel):
    start: int
    end: int


class TurnEvent(BaseModel):
    type: Literal["turn"]
    role: Literal["user", "interviewer"]
    text: str = Field(min_length=1, max_length=20_000)
    started_at: int | None = None
    ended_at: int | None = None
    segments: list[Segment] = Field(default_factory=list)
    # Aggregated body-language ratios computed in the browser (MediaPipe).
    # Never raw landmarks or frames.
    body: dict[str, float | int] | None = None


class StatusEvent(BaseModel):
    type: Literal["status"]
    state: Literal["connected", "disconnected", "ended"]


class HelloEvent(BaseModel):
    type: Literal["hello"]


IncomingEvent = Annotated[TurnEvent | StatusEvent | HelloEvent, Field(discriminator="type")]
incoming_event = TypeAdapter(IncomingEvent)


@app.websocket("/sessions/{session_id}/events")
async def session_events(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
) -> None:
    try:
        verify_session_token(token, session_id)
    except HTTPException as exc:
        await websocket.close(code=4401, reason=str(exc.detail))
        return

    await websocket.accept()
    nextjs: NextJsInternal = app.state.nextjs
    log.info("events ws open sid=%s", session_id)

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                event = incoming_event.validate_python(raw)
            except ValidationError:
                await websocket.send_json({"type": "error", "message": "Malformed event"})
                continue

            if isinstance(event, HelloEvent):
                await websocket.send_json({"type": "ready"})
                continue

            if isinstance(event, StatusEvent):
                log.info("sid=%s status=%s", session_id, event.state)
                if event.state == "ended":
                    break
                continue

            # TurnEvent
            if event.role == "user":
                if not is_usable_transcript(event.text):
                    await websocket.send_json({"type": "turn_rejected", "reason": "noise"})
                    continue
                duration = (
                    event.ended_at - event.started_at
                    if event.started_at is not None and event.ended_at is not None
                    else None
                )
                metrics = turn_metrics(
                    event.text,
                    duration,
                    [s.model_dump() for s in event.segments],
                )
                if event.body:
                    metrics["body"] = {k: v for k, v in list(event.body.items())[:20]}
                role = "user"
            else:
                metrics = None
                role = "assistant"

            try:
                saved = await nextjs.append_turn(session_id, role, event.text, metrics)
            except HTTPException as exc:
                log.warning("sid=%s failed to persist turn: %s", session_id, exc.detail)
                await websocket.send_json({"type": "error", "message": "Couldn't save that turn"})
                continue

            await websocket.send_json(
                {"type": "turn_ack", "id": saved.get("id"), "role": role, "metrics": metrics}
            )
    except WebSocketDisconnect:
        log.info("events ws closed by client sid=%s", session_id)
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
