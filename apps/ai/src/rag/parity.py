"""Chroma vs pgvector parity check.

Phase 4 verification step: run the same set of queries against both backends
(after ingesting the same source data into each) and report Jaccard overlap
of the top-k source_ids. Drift > a few percent points means the migration
broke something — most likely metadata field shape or embedding model mismatch.

Usage:
    # 1) ingest into chroma (RAG_BACKEND=chroma) via the Streamlit Re-index button
    # 2) ingest into pgvector (RAG_BACKEND=pgvector) likewise
    # 3) `uv run python -m src.rag.parity` with the JWT in env or pass explicitly

This module does not flip RAG_BACKEND itself — it instantiates each store
directly so the comparison happens in one process.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING

from langchain_core.documents import Document

from src.rag.embeddings import get_embeddings
from src.rag.store import COLLECTION_NAME

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

DEFAULT_PROBES = (
    "outstanding balance",
    "overdue invoices",
    "supplier with most activity",
    "recent sales invoices",
    "VAT discrepancy",
)


@dataclass
class ParityResult:
    query: str
    chroma_ids: list[str]
    pgvector_ids: list[str]
    overlap: float  # |∩| / |∪|


def _ids_of(docs: list[Document]) -> list[str]:
    out: list[str] = []
    for d in docs:
        sid = d.metadata.get("source_id") or d.metadata.get("id") or ""
        out.append(str(sid))
    return out


def _jaccard(a: list[str], b: list[str]) -> float:
    set_a, set_b = set(a), set(b)
    if not set_a and not set_b:
        return 1.0
    return len(set_a & set_b) / max(len(set_a | set_b), 1)


def run_parity(
    client: SupabaseClient,
    *,
    queries: tuple[str, ...] = DEFAULT_PROBES,
    k: int = 5,
) -> list[ParityResult]:
    """Compare top-k results from both stores for each probe query.

    Both stores are constructed directly here so we don't have to flip
    `RAG_BACKEND` at runtime.
    """
    from langchain_chroma import Chroma  # noqa: PLC0415

    from src.rag.store_pg import make_supabase_vector_store  # noqa: PLC0415

    chroma = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
    )
    pg = make_supabase_vector_store(client)

    results: list[ParityResult] = []
    for q in queries:
        c_docs = chroma.as_retriever(search_kwargs={"k": k}).invoke(q)
        p_docs = pg.as_retriever(search_kwargs={"k": k}).invoke(q)
        c_ids, p_ids = _ids_of(c_docs), _ids_of(p_docs)
        results.append(
            ParityResult(
                query=q,
                chroma_ids=c_ids,
                pgvector_ids=p_ids,
                overlap=_jaccard(c_ids, p_ids),
            )
        )
    return results


def format_report(results: list[ParityResult]) -> str:
    lines = ["Chroma vs pgvector parity (top-k overlap by source_id):", ""]
    for r in results:
        lines.append(f"  • {r.query!r}: overlap = {r.overlap:.0%}")
        lines.append(f"      chroma   → {r.chroma_ids}")
        lines.append(f"      pgvector → {r.pgvector_ids}")
    avg = sum(r.overlap for r in results) / max(len(results), 1)
    lines.append("")
    lines.append(f"Average overlap: {avg:.0%}")
    return "\n".join(lines)


async def _main() -> None:
    """CLI entry: build a service-role supabase client and run the probes."""
    from supabase import create_client  # noqa: PLC0415

    from src.config import settings  # noqa: PLC0415

    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise SystemExit(
            "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for parity check."
        )
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    print(format_report(run_parity(client)))


if __name__ == "__main__":
    asyncio.run(_main())
