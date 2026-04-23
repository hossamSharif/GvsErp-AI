"""Ingestion pipeline — ERP → LangChain Documents → vector store.

Two backends:
  - chroma: reset-and-rebuild (in-memory, Phase 3 behaviour preserved).
  - pgvector: hash-aware idempotent upsert + delete-stale. Re-running on the
    same data is a no-op (every row hashes equal → all skipped). This is the
    "log shows skips" verification line in genAiAppPlan.md Phase 4.

The ingestion *reads* still go through the ERP API (RLS-scoped JWT). Only the
*write* into the vector store changes per backend. tenant_id is required for
pgvector so we know which slice the rows belong to.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import settings
from src.erp_client import ErpClient
from src.rag.store import reset_store

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

LIST_PAGE_SIZE = 100
CHUNK_SIZE = 800
CHUNK_OVERLAP = 80


@dataclass
class IngestReport:
    parties: int
    invoices: int
    chunks_embedded: int
    # pgvector-only details. Zeroed for chroma.
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    deleted: int = 0
    errors: list[str] | None = None


def _as_list(payload: Any) -> list[dict[str, Any]]:
    """ERP list endpoints return either a bare list or `{data: [...]}`."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "items", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _party_to_document(party: dict[str, Any]) -> Document:
    lines = [
        f"Party: {party.get('name', '<unnamed>')} "
        f"(type: {party.get('type', 'unknown')})",
    ]
    if email := party.get("email"):
        lines.append(f"Email: {email}")
    if phone := party.get("phone"):
        lines.append(f"Phone: {phone}")
    if (balance := party.get("balance")) is not None:
        currency = party.get("currency", "")
        lines.append(f"Outstanding balance: {balance} {currency}".rstrip())
    if notes := party.get("notes"):
        lines.append(f"Notes: {notes}")

    return Document(
        page_content="\n".join(lines),
        metadata={
            "source_table": "parties",
            "source_id": str(party.get("id", "")),
            "party_id": str(party.get("id", "")),
            "party_name": party.get("name", ""),
            "party_type": party.get("type", ""),
        },
    )


def _invoice_to_document(invoice: dict[str, Any]) -> Document:
    number = invoice.get("invoiceNumber") or invoice.get("number") or "?"
    party_name = (
        invoice.get("partyName")
        or (invoice.get("party") or {}).get("name")
        or "<unknown party>"
    )
    lines = [
        f"Invoice {number}",
        f"Type: {invoice.get('type', 'unknown')}",
        f"Status: {invoice.get('status', 'unknown')}",
        f"Party: {party_name}",
    ]
    if date := (invoice.get("invoiceDate") or invoice.get("createdAt")):
        lines.append(f"Date: {date}")
    if (total := invoice.get("total")) is not None:
        currency = invoice.get("currency", "")
        lines.append(f"Total: {total} {currency}".rstrip())
    if notes := invoice.get("notes"):
        lines.append(f"Notes: {notes}")

    return Document(
        page_content="\n".join(lines),
        metadata={
            "source_table": "invoices",
            "source_id": str(invoice.get("id", "")),
            "invoice_number": number,
            "party_id": str(
                invoice.get("partyId") or (invoice.get("party") or {}).get("id") or ""
            ),
            "party_name": party_name,
            "type": invoice.get("type", ""),
            "status": invoice.get("status", ""),
        },
    )


def _build_documents(
    parties_raw: list[dict[str, Any]], invoices_raw: list[dict[str, Any]]
) -> tuple[list[Document], list[Document]]:
    party_docs = [_party_to_document(p) for p in parties_raw]
    invoice_docs = [_invoice_to_document(i) for i in invoices_raw]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    return splitter.split_documents(party_docs), splitter.split_documents(invoice_docs)


async def ingest_all(
    erp: ErpClient,
    *,
    supabase: SupabaseClient | None = None,
    tenant_id: str | None = None,
) -> IngestReport:
    """Pull ERP → embed → write. Backend chosen by `settings.rag_backend`.

    For pgvector you must pass `supabase` (an authenticated client) and
    `tenant_id` (rows are scoped to it). For chroma both are ignored.
    """
    parties_raw = _as_list(await erp.list_parties(limit=LIST_PAGE_SIZE))
    invoices_raw = _as_list(await erp.list_invoices(limit=LIST_PAGE_SIZE))
    party_chunks, invoice_chunks = _build_documents(parties_raw, invoices_raw)

    if settings.rag_backend == "pgvector":
        return await _ingest_pgvector(
            supabase=supabase,
            tenant_id=tenant_id,
            party_chunks=party_chunks,
            invoice_chunks=invoice_chunks,
            party_count=len(parties_raw),
            invoice_count=len(invoices_raw),
        )

    return _ingest_chroma(
        party_chunks=party_chunks,
        invoice_chunks=invoice_chunks,
        party_count=len(parties_raw),
        invoice_count=len(invoices_raw),
    )


def _ingest_chroma(
    *,
    party_chunks: list[Document],
    invoice_chunks: list[Document],
    party_count: int,
    invoice_count: int,
) -> IngestReport:
    chunks = party_chunks + invoice_chunks
    store = reset_store()
    if chunks:
        store.add_documents(chunks)
    return IngestReport(
        parties=party_count,
        invoices=invoice_count,
        chunks_embedded=len(chunks),
    )


async def _ingest_pgvector(
    *,
    supabase: SupabaseClient | None,
    tenant_id: str | None,
    party_chunks: list[Document],
    invoice_chunks: list[Document],
    party_count: int,
    invoice_count: int,
) -> IngestReport:
    if supabase is None or not tenant_id:
        raise RuntimeError(
            "pgvector ingest requires both an authenticated Supabase client and a "
            "tenant_id. Pass them explicitly to ingest_all()."
        )

    # Lazy import keeps chroma users from pulling pgvector machinery.
    from src.rag.store_pg import delete_stale, upsert_embeddings  # noqa: PLC0415

    party_report = upsert_embeddings(
        supabase,
        tenant_id=tenant_id,
        source_table="parties",
        documents=party_chunks,
    )
    invoice_report = upsert_embeddings(
        supabase,
        tenant_id=tenant_id,
        source_table="invoices",
        documents=invoice_chunks,
    )

    keep_parties = {str(d.metadata.get("source_id")) for d in party_chunks}
    keep_invoices = {str(d.metadata.get("source_id")) for d in invoice_chunks}
    deleted_parties = delete_stale(
        supabase,
        tenant_id=tenant_id,
        source_table="parties",
        keep_source_ids=keep_parties,
    )
    deleted_invoices = delete_stale(
        supabase,
        tenant_id=tenant_id,
        source_table="invoices",
        keep_source_ids=keep_invoices,
    )

    errors = (party_report.errors or []) + (invoice_report.errors or [])

    return IngestReport(
        parties=party_count,
        invoices=invoice_count,
        chunks_embedded=party_report.embedded + invoice_report.embedded,
        inserted=party_report.inserted + invoice_report.inserted,
        updated=party_report.updated + invoice_report.updated,
        skipped=party_report.skipped + invoice_report.skipped,
        deleted=deleted_parties + deleted_invoices,
        errors=errors or None,
    )
