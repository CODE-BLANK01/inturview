from typing import Any

import httpx
from fastapi import HTTPException

from .config import get_settings

OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"

TRANSCRIPTION_PROMPT = (
    "Live technical software engineering interview in English. "
    "Terms like API, latency, p99, React, Postgres, index, cache, queue, deploy."
)

OUTPUT_LANGUAGE_RULE = (
    "LANGUAGE RULE: Speak only in English. Every spoken response must be in English, "
    "regardless of the candidate's language, browser locale, accent, transcript text, "
    "or any earlier turn. Never switch languages or translate the interview.\n\n"
)


def build_turn_detection() -> dict[str, Any]:
    """semantic_vad judges from the words whether the candidate is done, so a
    mid-sentence thinking pause doesn't end the answer. server_vad is the older
    fixed-silence detector with a loudness threshold (more noise-robust, but
    cuts people off when they pause to think)."""
    s = get_settings()
    # The browser decides when the model replies (see build_session_config).
    common = {"create_response": False, "interrupt_response": False}
    if s.rt_turn_detection == "semantic_vad":
        return {"type": "semantic_vad", "eagerness": s.rt_vad_eagerness, **common}
    return {
        "type": "server_vad",
        "threshold": s.rt_vad_threshold,
        "prefix_padding_ms": s.rt_vad_prefix_ms,
        "silence_duration_ms": s.rt_vad_silence_ms,
        **common,
    }


def build_session_config(instructions: str) -> dict[str, Any]:
    """Session config baked into the ephemeral client secret.

    The anti-noise design:
    - noise_reduction runs before VAD, so breathing and keyboard clicks are
      attenuated before the detector sees them.
    - semantic_vad (default) ends a turn only when the candidate sounds done;
      server_vad (RT_TURN_DETECTION) instead needs sustained, loud-enough
      speech to open a turn and a fixed silence to close it.
    - create_response=False: the model NEVER answers on its own. The browser
      decides to request a response only after the transcript comes back and
      passes the junk filter. interrupt_response=False for the same reason —
      barge-in is decided client-side from speech duration, not from any blip.
    - transcription language is pinned so noise can't be "translated".
    """
    s = get_settings()
    return {
        "type": "realtime",
        "model": s.openai_realtime_model,
        "instructions": f"{OUTPUT_LANGUAGE_RULE}{instructions}",
        "output_modalities": ["audio"],
        "audio": {
            "input": {
                "noise_reduction": {"type": s.rt_noise_reduction},
                "transcription": {
                    "model": s.rt_transcribe_model,
                    "language": s.rt_input_language,
                    "prompt": TRANSCRIPTION_PROMPT,
                },
                "turn_detection": build_turn_detection(),
            },
            "output": {"voice": s.openai_realtime_voice},
        },
        "max_output_tokens": 700,
    }


def make_openai_client() -> httpx.AsyncClient:
    s = get_settings()
    return httpx.AsyncClient(
        headers={"Authorization": f"Bearer {s.openai_api_key}"},
        timeout=httpx.Timeout(20.0),
    )


async def mint_client_secret(client: httpx.AsyncClient, instructions: str) -> dict[str, Any]:
    s = get_settings()
    body = {
        "expires_after": {"anchor": "created_at", "seconds": s.rt_client_secret_ttl},
        "session": build_session_config(instructions),
    }
    r = await client.post(OPENAI_CLIENT_SECRETS_URL, json=body)
    if r.status_code >= 400:
        detail = r.text[:500]
        raise HTTPException(502, f"OpenAI refused to create a realtime session: {detail}")
    data = r.json()
    return {
        "client_secret": data["value"],
        "expires_at": data.get("expires_at"),
        "model": s.openai_realtime_model,
    }
