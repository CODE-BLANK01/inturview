from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    openai_realtime_model: str = "gpt-realtime"
    openai_realtime_voice: str = "marin"

    nextjs_internal_url: str = "http://localhost:3000"
    realtime_service_secret: str = Field(min_length=32)
    allowed_origins: str = "http://localhost:3000"

    # "semantic_vad" ends a turn when the candidate sounds finished (tolerates
    # thinking pauses); "server_vad" ends it after a fixed silence window.
    rt_turn_detection: Literal["semantic_vad", "server_vad"] = "semantic_vad"
    # semantic_vad only: low = wait longest before deciding the turn is over.
    rt_vad_eagerness: Literal["low", "medium", "high", "auto"] = "low"
    # server_vad only (the three below).
    rt_vad_threshold: float = 0.8
    rt_vad_silence_ms: int = 900
    rt_vad_prefix_ms: int = 300
    rt_noise_reduction: str = "near_field"
    rt_input_language: str = "en"
    rt_transcribe_model: str = "gpt-4o-transcribe"
    rt_client_secret_ttl: int = 600

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
