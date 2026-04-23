"""Single embedding-model singleton, shared across backends.

Phase 3 inlined this in store.py because there was only one consumer. Phase 4
adds a second consumer (store_pg.upsert_embeddings) that needs its own embedder
to compute vectors before the upsert; pulling it out here keeps the model
loaded once per process regardless of which backend is selected.
"""

from __future__ import annotations

from typing import Any

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from src.config import settings

EMBEDDING_MODEL = "models/text-embedding-004"  # 768-dim, free tier

_embeddings: Any | None = None


def get_embeddings() -> Any:
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
