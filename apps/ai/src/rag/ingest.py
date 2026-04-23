"""Ingestion pipeline — ERP → LangChain Documents → Chroma.

Flow:
  1. pull parties + invoices via the authenticated ErpClient (RLS-scoped),
  2. format each row into a short natural-language document with rich metadata,
  3. run the splitter (no-op for short docs, but teaches the pattern),
  4. reset + re-embed into Chroma.

Reset-and-rebuild is fine for Phase 3 because the store is in-memory:
every re-ingest is a full refresh. Phase 4 swaps this for an incremental
upsert against pgvector keyed by source_id.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.erp_client import ErpClient
from src.rag.store import reset_store

LIST_PAGE_SIZE = 100
CHUNK_SIZE = 800
CHUNK_OVERLAP = 80


@dataclass
class IngestReport:
    parties: int
    invoices: int
    chunks_embedded: int


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


async def ingest_all(erp: ErpClient) -> IngestReport:
    """Full refresh — wipes and rebuilds the collection."""
    parties_raw = _as_list(await erp.list_parties(limit=LIST_PAGE_SIZE))
    invoices_raw = _as_list(await erp.list_invoices(limit=LIST_PAGE_SIZE))

    party_docs = [_party_to_document(p) for p in parties_raw]
    invoice_docs = [_invoice_to_document(i) for i in invoices_raw]
    documents = party_docs + invoice_docs

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(documents)

    store = reset_store()
    if chunks:
        store.add_documents(chunks)

    return IngestReport(
        parties=len(party_docs),
        invoices=len(invoice_docs),
        chunks_embedded=len(chunks),
    )
