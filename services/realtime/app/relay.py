"""WebSocket relay between the browser and OpenAI Realtime, for interviews
with the avatar on.

Browsers can't open the OpenAI Realtime WebSocket themselves (the ephemeral
key isn't a valid WebSocket subprotocol), and the WebRTC transport only gives
the interviewer's voice as a call track, which can't be read cleanly for the
avatar. So this service holds the OpenAI socket with the real API key, applies
the server-owned session config, and passes JSON events through both ways.
"""

import asyncio
import json
import logging

import websockets
from fastapi import WebSocket, WebSocketDisconnect

from .config import get_settings
from .realtime import build_relay_session_update, openai_realtime_ws_url

log = logging.getLogger("realtime.relay")

# Instructions and turn-taking are set server-side; the browser may not change them.
BLOCKED_CLIENT_EVENTS = {"session.update"}


async def run_relay(browser: WebSocket, session_id: str, instructions: str, max_seconds: float) -> None:
    """Relay until either side closes or the interview's time cap passes.
    The browser socket must already be accepted."""
    s = get_settings()
    async with websockets.connect(
        openai_realtime_ws_url(),
        additional_headers={"Authorization": f"Bearer {s.openai_api_key}"},
        max_size=4 * 1024 * 1024,
    ) as upstream:
        await upstream.send(json.dumps(build_relay_session_update(instructions)))

        async def browser_to_openai() -> None:
            while True:
                raw = await browser.receive_text()
                try:
                    event_type = json.loads(raw).get("type")
                except (ValueError, AttributeError):
                    continue
                if event_type in BLOCKED_CLIENT_EVENTS:
                    continue
                await upstream.send(raw)

        async def openai_to_browser() -> None:
            async for message in upstream:
                await browser.send_text(message if isinstance(message, str) else message.decode())

        tasks = {
            asyncio.create_task(browser_to_openai(), name="browser->openai"),
            asyncio.create_task(openai_to_browser(), name="openai->browser"),
        }
        done, pending = await asyncio.wait(tasks, timeout=max_seconds, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

        if not done:
            log.info("relay sid=%s closed at the time cap", session_id)
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, (WebSocketDisconnect, websockets.ConnectionClosed)):
                log.warning("relay sid=%s %s ended with %r", session_id, task.get_name(), exc)
