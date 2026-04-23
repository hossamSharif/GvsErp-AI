"""RAG-powered party summary PDF.

Flow for one agent turn:
  1. Retrieve the party's documents from Chroma (metadata-scoped to party_id).
  2. Ask the LLM to write a short narrative grounded in those documents.
  3. Render narrative + citations through a Jinja2 template, turn it into a
     PDF with WeasyPrint, and persist via the same sink as generate_report_pdf.

The narrative prompt explicitly asks the model to cite invoice numbers when
discussing specific activity — that's what turns this from a chatbot into
something a finance team can trust.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from langchain_core.documents import Document
from pydantic import BaseModel, Field

from src.docs.pdf import (
    _LOCAL_OUTPUT,
    _env,
    _save_local,
    _save_supabase,
)
from src.llm.provider import chat
from src.rag.retrieve import search_by_party
from src.tools.context import ToolContext

_NARRATIVE_SYSTEM = (
    "You are an analyst writing a one-paragraph activity summary for a "
    "business party (customer or supplier). Ground every claim in the "
    "supplied retrieved documents. When you reference specific activity, "
    "cite the invoice number in parentheses, e.g. (INV-2026-001). "
    "Do not invent data that is not in the documents. If the documents are "
    "empty or insufficient, say so plainly in one sentence."
)


class GeneratePartySummaryPdfArgs(BaseModel):
    party_id: str = Field(..., description="UUID of the party to summarize.")
    party_name: str | None = Field(
        default=None,
        description="Display name. If omitted we pull it from retrieved metadata.",
    )
    k: int = Field(
        default=20,
        ge=1,
        le=50,
        description="Maximum retrieved documents to feed the LLM.",
    )
    direction: Literal["ltr", "rtl"] = Field(default="ltr")


def _citations(docs: list[Document]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for d in docs:
        meta = d.metadata or {}
        ref = meta.get("invoice_number") or meta.get("source_id") or ""
        out.append(
            {
                "source_table": str(meta.get("source_table", "")),
                "ref": str(ref),
                "status": str(meta.get("status", "")),
                "excerpt": d.page_content.replace("\n", " ")[:140],
            }
        )
    return out


def _build_narrative_prompt(party_name: str, docs: list[Document]) -> str:
    bullets: list[str] = []
    for d in docs:
        meta = d.metadata or {}
        ref = meta.get("invoice_number") or meta.get("source_id", "?")
        bullets.append(f"- [{meta.get('source_table', '?')} | {ref}] {d.page_content}")
    body = "\n".join(bullets) if bullets else "(no documents retrieved)"
    return (
        f"Party: {party_name}\n\n"
        f"Retrieved documents:\n{body}\n\n"
        f"Write the one-paragraph activity summary now."
    )


def _render_pdf_bytes(
    *,
    party_name: str,
    narrative: str,
    citations: list[dict[str, str]],
    direction: str,
) -> bytes:
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except OSError as e:
        raise RuntimeError(
            "WeasyPrint couldn't load its native dependencies. On Windows, "
            "install GTK3 — see https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows"
        ) from e

    template = _env.get_template("party-summary.html.j2")
    html = template.render(
        party_name=party_name,
        narrative=narrative,
        citations=citations,
        direction=direction,
        generated_at=datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
    )
    return HTML(string=html).write_pdf()


async def generate_party_summary_pdf(
    args: GeneratePartySummaryPdfArgs, ctx: ToolContext
) -> dict[str, Any]:
    docs = search_by_party(args.party_id, k=args.k)

    display_name = args.party_name or next(
        (d.metadata.get("party_name") for d in docs if d.metadata.get("party_name")),
        args.party_id,
    )

    if docs:
        narrative = chat(
            messages=[
                {"role": "system", "content": _NARRATIVE_SYSTEM},
                {"role": "user", "content": _build_narrative_prompt(display_name, docs)},
            ],
            provider=ctx.provider,
            model=ctx.model,
            temperature=0.3,
        )
    else:
        narrative = (
            f"No indexed documents were found for {display_name}. "
            "Run 'Re-index ERP' in the sidebar and retry."
        )

    pdf_bytes = _render_pdf_bytes(
        party_name=display_name,
        narrative=narrative,
        citations=_citations(docs),
        direction=args.direction,
    )
    filename = f"party-summary-{uuid.uuid4().hex[:8]}.pdf"

    if ctx.supabase is not None:
        try:
            url = _save_supabase(pdf_bytes, filename, ctx)
            return {
                "url": url,
                "filename": filename,
                "sink": "supabase-storage",
                "retrieved": len(docs),
                "party_name": display_name,
            }
        except Exception as e:
            _LOCAL_OUTPUT.mkdir(parents=True, exist_ok=True)
            return {
                "url": _save_local(pdf_bytes, filename),
                "filename": filename,
                "sink": "local-fallback",
                "supabase_error": str(e),
                "retrieved": len(docs),
                "party_name": display_name,
            }

    return {
        "url": _save_local(pdf_bytes, filename),
        "filename": filename,
        "sink": "local",
        "retrieved": len(docs),
        "party_name": display_name,
    }
