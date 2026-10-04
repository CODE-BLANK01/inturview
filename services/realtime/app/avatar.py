import logging
from typing import Any

import httpx
from fastapi import HTTPException

from .config import get_settings

log = logging.getLogger("realtime.avatar")

LIVEAVATAR_API = "https://api.liveavatar.com"
# "Wayne", the only avatar available in LiveAvatar sandbox mode.
SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"


def avatar_enabled() -> bool:
    return bool(get_settings().liveavatar_api_key)


def make_liveavatar_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=LIVEAVATAR_API, timeout=httpx.Timeout(30.0))


async def start_avatar_session(client: httpx.AsyncClient) -> dict[str, Any]:
    """Start a LITE-mode LiveAvatar session: LiveAvatar renders the face, the
    interviewer's voice still comes from OpenAI Realtime. Returns the LiveKit
    room credentials the browser joins and the command WebSocket it drives.

    No max_session_duration is sent: LiveAvatar rejects any value above the
    plan's limit (2 min on Free), so the plan's own limit applies. The browser
    stops the session when the interview ends, and falls back to voice-only if
    the plan limit ends it first."""
    s = get_settings()
    avatar_id = SANDBOX_AVATAR_ID if s.liveavatar_sandbox else s.liveavatar_avatar_id
    if not avatar_id:
        raise HTTPException(503, "LIVEAVATAR_AVATAR_ID is not set")

    tok = await client.post(
        "/v1/sessions/token",
        headers={"X-API-KEY": s.liveavatar_api_key},
        json={"mode": "LITE", "avatar_id": avatar_id, "is_sandbox": s.liveavatar_sandbox},
    )
    if tok.status_code != 200:
        log.warning("LiveAvatar token refused (%s): %s", tok.status_code, tok.text[:500])
        raise HTTPException(502, f"LiveAvatar refused the session token: {tok.text[:300]}")
    session_token = tok.json()["data"]["session_token"]

    start = await client.post(
        "/v1/sessions/start",
        headers={"Authorization": f"Bearer {session_token}"},
    )
    if start.status_code not in (200, 201):
        log.warning("LiveAvatar start refused (%s): %s", start.status_code, start.text[:500])
        raise HTTPException(502, f"LiveAvatar could not start the session: {start.text[:300]}")
    d: dict[str, Any] = start.json()["data"]
    if not d.get("ws_url"):
        raise HTTPException(502, "LiveAvatar returned no command WebSocket (session is not LITE)")
    return {
        "avatar_session_id": d["session_id"],
        "livekit_url": d["livekit_url"],
        "livekit_client_token": d["livekit_client_token"],
        "ws_url": d["ws_url"],
        "max_session_duration": d.get("max_session_duration"),
    }


async def stop_avatar_session(client: httpx.AsyncClient, avatar_session_id: str) -> bool:
    """Stop billing as soon as the interview ends. Stopping an already-ended
    session is harmless."""
    r = await client.post(
        "/v1/sessions/stop",
        headers={"X-API-KEY": get_settings().liveavatar_api_key},
        json={"session_id": avatar_session_id, "reason": "USER_CLOSED"},
    )
    return r.status_code == 200
