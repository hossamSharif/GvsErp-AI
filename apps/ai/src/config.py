"""Typed environment loader.

pydantic-settings reads .env once at import time, validates types, and fails
loudly if something is missing. Everywhere else in the app imports `settings`
instead of touching os.environ.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

PROVIDERS: tuple[str, ...] = ("google", "anthropic", "openai")

DEFAULT_MODELS: dict[str, str] = {
    "google": "gemini-2.5-flash-lite",
    "anthropic": "claude-sonnet-4-5",
    "openai": "gpt-4o-mini",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    google_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    ai_default_provider: str = "google"
    ai_default_model: str = "gemini-2.5-flash-lite"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    erp_api_base_url: str = "http://localhost:3001/api/v1"

    def api_key_for(self, provider: str) -> str:
        return {
            "google": self.google_api_key,
            "anthropic": self.anthropic_api_key,
            "openai": self.openai_api_key,
        }.get(provider, "")

    def configured_providers(self) -> list[str]:
        return [p for p in PROVIDERS if self.api_key_for(p)]


settings = Settings()
