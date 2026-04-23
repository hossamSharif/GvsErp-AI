"""Process-local Chroma vector store.

Phase 3 choice: in-memory Chroma. No infra, no persistence between runs.
A Streamlit reload wipes everything and you re-ingest — that's the point,
Phase 4 will swap this out for pgvector and we want the migration to hurt
just enough to teach why persistence + RLS matter.

One collection per process. `get_store()` lazy-initializes it; `reset_store()`
drops the collection and rebuilds empty. LangChain's `Chroma` wrapper
handles the embedding call on write + read, so callers deal in Documents.
"""

from __future__ import annotations

from typing import Any

from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from src.config import settings

COLLECTION_NAME = "erp_ai_companion"
EMBEDDING_MODEL = "models/text-embedding-004"  # 768-dim, free tier

_store: Chroma | None = None
_embeddings: Any | None = None


def _get_embeddings() -> Any:
    global _embeddings
    if _embeddings is None:
        if not settings.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is required for RAG — text-embedding-004 is Google-hosted."
            )
        _embeddings = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            google_api_key=settings.google_api_key,
        )
    return _embeddings


def get_store() -> Chroma:
    global _store
    if _store is None:
        _store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=_get_embeddings(),
        )
    return _store


def reset_store() -> Chroma:
    """Drop the collection and start fresh. Call before every full re-ingest."""
    global _store
    if _store is not None:
        try:
            _store.delete_collection()
        except Exception:
            # Collection may not exist yet — Chroma raises on missing.
            pass
        _store = None
    return get_store()


def collection_size() -> int:
    """Rough doc count — useful for the sidebar status line."""
    store = get_store()
    try:
        return store._collection.count()  # type: ignore[attr-defined]
    except Exception:
        return 0
