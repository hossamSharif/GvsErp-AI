"""Retriever factory.

The LangChain retriever is a thin adapter over the vector store that exposes
`invoke(query) -> list[Document]`. Keeping it behind a factory lets us swap
the store (Chroma → pgvector in Phase 4) without touching callers.
"""

from __future__ import annotations

from langchain_core.documents import Document

from src.rag.store import get_store

DEFAULT_K = 5


def search(query: str, *, k: int = DEFAULT_K) -> list[Document]:
    retriever = get_store().as_retriever(search_kwargs={"k": k})
    return retriever.invoke(query)


def search_by_party(party_id: str, *, k: int = 20) -> list[Document]:
    """Metadata-scoped retrieval for party-summary PDFs.

    We filter by party_id so the narrative is grounded in that party's
    documents only — a plain semantic search could pull in invoices from
    other parties that happen to look similar.
    """
    store = get_store()
    retriever = store.as_retriever(
        search_kwargs={"k": k, "filter": {"party_id": party_id}},
    )
    # Empty-query retrieval on Chroma returns by similarity to nothing —
    # use a generic probe so we still surface every matching doc up to k.
    return retriever.invoke("activity summary history invoices")
