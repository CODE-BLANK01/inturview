from typing import Any

import httpx
from fastapi import HTTPException

from .config import get_settings


class NextJsInternal:
    """Server-to-server client for the Next.js internal face-to-face endpoints."""

    def __init__(self) -> None:
        s = get_settings()
        self._client = httpx.AsyncClient(
            base_url=s.nextjs_internal_url,
            headers={"x-service-secret": s.realtime_service_secret},
            timeout=httpx.Timeout(15.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_session(self, session_id: str) -> dict[str, Any]:
        r = await self._client.get(f"/api/internal/face-to-face/{session_id}")
        if r.status_code == 404:
            raise HTTPException(404, "Session not found")
        if r.status_code == 409:
            raise HTTPException(409, "Session time is up — start a new interview")
        if r.status_code >= 400:
            raise HTTPException(502, f"App returned {r.status_code} for session lookup")
        return r.json()

    async def append_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        metrics: dict[str, Any] | None,
    ) -> dict[str, Any]:
        r = await self._client.post(
            f"/api/internal/face-to-face/{session_id}/turns",
            json={"role": role, "content": content, "metrics": metrics},
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"App returned {r.status_code} while saving turn")
        return r.json()
