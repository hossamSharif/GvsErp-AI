"""Retriever factory.

Backend-agnostic: returns LangChain Documents from whichever vector store
`settings.rag_backend` selected. The Supabase client is required only for
pgvector — we pass it through every call so the same code works in both
the chat path (user-JWT client from ToolContext) and the parity test
(service-role client).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_core.documents import Document

from src.rag.store import get_store

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

DEFAULT_K = 5


def search(
    query: str, *, k: int = DEFAULT_K, client: SupabaseClient | None = None
) -> list[Document]:
    retriever = get_store(client).as_retriever(search_kwargs={"k": k})
    return retriever.invoke(query)


def search_by_party(
    party_id: str,
    *,
    k: int = 20,
    client: SupabaseClient | None = None,
) -> list[Document]:
    """Metadata-scoped retrieval for party-summary PDFs.

    Filter shape `{"party_id": ...}` works for both backends:
      - Chroma: passes `where` directly to its in-memory query.
      - SupabaseVectorStore: forwards as the `filter` jsonb arg to
        `match_ai_embeddings`, where `metadata @> filter` does the same job.
    """
    store = get_store(client)
    retriever = store.as_retriever(
        search_kwargs={"k": k, "filter": {"party_id": party_id}},
    )
    # An empty query has no embedding, so we use a generic activity probe and
    # let the metadata filter narrow to this party.
    return retriever.invoke("activity summary history invoices")
