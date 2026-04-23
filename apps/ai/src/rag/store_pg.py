"""pgvector-backed store wiring for Phase 4.

Two responsibilities:
  1. Read path — wrap the Supabase table behind a LangChain `SupabaseVectorStore`
     so the retriever interface stays identical to Phase 3.
  2. Write path — bypass `SupabaseVectorStore.add_documents` because our schema
     has extra NOT NULL columns (tenant_id, source_table, source_id, content_hash)
     that LangChain's wrapper doesn't know about. We do hash-aware idempotent
     upserts directly via supabase-py, computing embeddings only for new or
     changed rows. This is what the "log shows skips" verification line in
     genAiAppPlan.md is checking.

The embedding model and dimensions match Phase 3 (text-embedding-004, 768-dim)
so we can swap backends without re-embedding everything.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document

from src.rag.embeddings import get_embeddings

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

TABLE_NAME = "ai_embeddings"
RPC_NAME = "match_ai_embeddings"
UPSERT_BATCH_SIZE = 100


def make_supabase_vector_store(client: SupabaseClient) -> SupabaseVectorStore:
    """Read-side wrapper. Calls the `match_ai_embeddings` RPC for similarity search."""
    return SupabaseVectorStore(
        client=client,
        embedding=get_embeddings(),
        table_name=TABLE_NAME,
        query_name=RPC_NAME,
    )


@dataclass
class UpsertReport:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    deleted: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def embedded(self) -> int:
        return self.inserted + self.updated


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _existing_rows(
    client: SupabaseClient, tenant_id: str, source_table: str
) -> dict[str, dict[str, Any]]:
    """Return {source_id: {id, content_hash}} for rows the tenant already has."""
    response = (
        client.table(TABLE_NAME)
        .select("id,source_id,content_hash")
        .eq("tenant_id", tenant_id)
        .eq("source_table", source_table)
        .execute()
    )
    rows = response.data or []
    return {str(row["source_id"]): row for row in rows}


def _chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def upsert_embeddings(
    client: SupabaseClient,
    *,
    tenant_id: str,
    source_table: str,
    documents: list[Document],
) -> UpsertReport:
    """Idempotent: re-run on identical input is a no-op (every row hashes equal).

    Steps:
      1. Index existing rows by source_id → existing content_hash.
      2. Compute the new content_hash for each incoming doc.
      3. Embed only the docs that are new or changed.
      4. Upsert in batches.
      5. Optionally delete rows whose source_id has disappeared from the input
         (left to the caller — see ingest.py for the policy).
    """
    report = UpsertReport()
    if not documents:
        return report

    existing = _existing_rows(client, tenant_id, source_table)
    embeddings_client = get_embeddings()

    rows_to_embed: list[tuple[Document, str, str]] = []  # (doc, source_id, hash)
    for doc in documents:
        source_id = str(doc.metadata.get("source_id") or "")
        if not source_id:
            report.errors.append(f"document missing source_id: {doc.page_content[:60]!r}")
            continue
        new_hash = _content_hash(doc.page_content)
        prior = existing.get(source_id)
        if prior and prior.get("content_hash") == new_hash:
            report.skipped += 1
            continue
        rows_to_embed.append((doc, source_id, new_hash))

    if not rows_to_embed:
        return report

    # Embed in one call — text-embedding-004 supports batch input efficiently.
    contents = [d.page_content for d, _, _ in rows_to_embed]
    vectors = embeddings_client.embed_documents(contents)

    rows: list[dict[str, Any]] = []
    for (doc, source_id, hash_), vector in zip(rows_to_embed, vectors, strict=True):
        was_update = source_id in existing
        rows.append(
            {
                "tenant_id": tenant_id,
                "source_table": source_table,
                "source_id": source_id,
                "content": doc.page_content,
                "content_hash": hash_,
                "embedding": vector,
                "metadata": doc.metadata,
            }
        )
        if was_update:
            report.updated += 1
        else:
            report.inserted += 1

    for batch in _chunked(rows, UPSERT_BATCH_SIZE):
        try:
            client.table(TABLE_NAME).upsert(
                batch, on_conflict="tenant_id,source_table,source_id"
            ).execute()
        except Exception as exc:  # supabase-py wraps PostgREST errors
            report.errors.append(f"upsert batch failed: {exc}")

    return report


def delete_stale(
    client: SupabaseClient,
    *,
    tenant_id: str,
    source_table: str,
    keep_source_ids: set[str],
) -> int:
    """Drop rows whose source_id is no longer present in the latest ERP pull."""
    existing = _existing_rows(client, tenant_id, source_table)
    stale = [sid for sid in existing if sid not in keep_source_ids]
    if not stale:
        return 0
    (
        client.table(TABLE_NAME)
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("source_table", source_table)
        .in_("source_id", stale)
        .execute()
    )
    return len(stale)


def count_embeddings(client: SupabaseClient, tenant_id: str | None = None) -> int:
    """Sidebar status. Tenant-scoped count; pass None for total (RLS will scope to caller)."""
    query = client.table(TABLE_NAME).select("id", count="exact")
    if tenant_id:
        query = query.eq("tenant_id", tenant_id)
    response = query.limit(1).execute()
    return int(getattr(response, "count", 0) or 0)
