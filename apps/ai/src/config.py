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

    # Phase 4: RAG store backend. "chroma" = in-memory (Phase 3 default).
    # "pgvector" = Supabase ai_embeddings table (requires migration 014).
    rag_backend: str = "chroma"

    # Standalone scheduler config (only consumed by src/pipelines/scheduler.py).
    pipeline_tenant_id: str = ""
    pipeline_user_jwt: str = ""
    pipeline_reembed_interval_min: int = 1440  # 24h
    pipeline_balance_interval_min: int = 60

    # Phase 6: Google OAuth (Gmail / Drive / Calendar).
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8501"

    # Phase 6: WhatsApp Business API (Meta Graph API).
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""

    # Phase 6: Fernet key for encrypting OAuth tokens at rest.
    # Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    token_encryption_key: str = ""

    # Phase 7: agent engine — "loop" (handwritten) or "graph" (LangGraph).
    agent_engine: str = "loop"

    # Phase 7: LangSmith tracing (optional).  Setting LANGSMITH_TRACING=true
    # plus an API key is enough — LangGraph picks up the env vars itself.
    langsmith_api_key: str = ""
    langsmith_tracing: bool = False
    langsmith_project: str = "erp-ai-companion"

    # Phase 7: where to persist the LangGraph SqliteSaver checkpoint file.
    # Empty = use in-memory MemorySaver (no persistence across app restarts).
    langgraph_sqlite_path: str = ""

    def api_key_for(self, provider: str) -> str:
        return {
            "google": self.google_api_key,
            "anthropic": self.anthropic_api_key,
            "openai": self.openai_api_key,
        }.get(provider, "")

    def configured_providers(self) -> list[str]:
        return [p for p in PROVIDERS if self.api_key_for(p)]


settings = Settings()
