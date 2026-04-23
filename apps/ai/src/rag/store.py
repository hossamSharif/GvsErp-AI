"""Backend-aware vector store factory.

Phase 3 was Chroma-only and in-memory. Phase 4 introduces pgvector via
SupabaseVectorStore — same retriever interface, persistent + RLS-scoped.

`get_store()` reads `settings.rag_backend` and returns the matching LangChain
VectorStore. Callers (retrieve.py, ingest.py reads, search_knowledge tool)
only see `VectorStore.as_retriever(...)` — they don't care which one.

For pgvector we need a Supabase client; the caller threads one in via the
optional `client` arg. We cache one store per (backend, client identity) so
Streamlit re-runs don't keep reconstructing.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_chroma import Chroma
from langchain_core.vectorstores import VectorStore

from src.config import settings
from src.rag.embeddings import get_embeddings

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

COLLECTION_NAME = "erp_ai_companion"

_chroma_store: Chroma | None = None
_pg_store: VectorStore | None = None
_pg_store_client_id: int | None = None  # id() of the supabase client we cached against


def _get_chroma() -> Chroma:
    global _chroma_store
    if _chroma_store is None:
        _chroma_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=get_embeddings(),
        )
    return _chroma_store


def _get_pgvector(client: SupabaseClient) -> VectorStore:
    global _pg_store, _pg_store_client_id
    if _pg_store is None or _pg_store_client_id != id(client):
        # Lazy import — keeps Phase 3 users on chroma working without pulling in
        # the SupabaseVectorStore code path (which validates the supabase client).
        from src.rag.store_pg import make_supabase_vector_store  # noqa: PLC0415

        _pg_store = make_supabase_vector_store(client)
        _pg_store_client_id = id(client)
    return _pg_store


def get_store(client: SupabaseClient | None = None) -> VectorStore:
    """Return the configured store. `client` required only when backend=pgvector."""
    if settings.rag_backend == "pgvector":
        if client is None:
            raise RuntimeError(
                "RAG_BACKEND=pgvector requires a Supabase client. "
                "Pass it via get_store(client=...) or fall back to chroma."
            )
        return _get_pgvector(client)
    return _get_chroma()


def reset_store(client: SupabaseClient | None = None) -> VectorStore:
    """Drop the in-memory cache. For pgvector this only clears the local handle —
    the Postgres rows survive (use ingest.py's delete_stale or a manual DELETE
    if you want to wipe them). For chroma it actually drops the collection."""
    global _chroma_store, _pg_store, _pg_store_client_id
    if settings.rag_backend == "pgvector":
        _pg_store = None
        _pg_store_client_id = None
        return get_store(client)

    if _chroma_store is not None:
        try:
            _chroma_store.delete_collection()
        except Exception:
            pass
        _chroma_store = None
    return _get_chroma()


def collection_size(client: SupabaseClient | None = None) -> int:
    """Indexed-chunk count for the sidebar status line."""
    if settings.rag_backend == "pgvector":
        if client is None:
            return 0
        from src.rag.store_pg import count_embeddings  # noqa: PLC0415

        try:
            return count_embeddings(client)
        except Exception:
            return 0

    store = _get_chroma()
    try:
        return store._collection.count()  # type: ignore[attr-defined]
    except Exception:
        return 0


def backend_label() -> str:
    """Human-readable backend tag for the sidebar."""
    return settings.rag_backend


__all__: list[str] = [
    "backend_label",
    "collection_size",
    "get_store",
    "reset_store",
]
