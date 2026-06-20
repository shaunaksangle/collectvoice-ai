from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    app_env: str = "local"
    app_name: str = "CollectVoice AI"
    app_version: str = "0.1.0"

    database_url: str = "postgresql+psycopg://collectvoice:collectvoice@localhost:5432/collectvoice_ai"
    redis_url: str = "redis://localhost:6379/0"

    voice_mode: str = Field(default="mock")
    sarvam_api_key: str | None = None

    telephony_provider: str = "mock"
    telephony_api_key: str | None = None

    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("voice_mode", "telephony_provider")
    @classmethod
    def normalize_provider_flags(cls, value: str) -> str:
        return value.strip().lower()


settings = Settings()
