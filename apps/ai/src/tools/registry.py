"""Central registry — the one place that knows every tool the agent can call.

Keeps `openai_tool_schemas()` and `dispatch()` in one import path so the
agent loop doesn't need to know which subsystem (ERP, docs) owns a tool.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from src.docs.party_summary import (
    GeneratePartySummaryPdfArgs,
    generate_party_summary_pdf,
)
from src.docs.pdf import GenerateReportPdfArgs, generate_report_pdf
from src.tools import erp as erp_tools
from src.tools.context import ToolContext
from src.tools.rag import SearchKnowledgeArgs, search_knowledge


@dataclass
class ToolSpec:
    name: str
    description: str
    args_model: type[BaseModel]
    handler: Callable[[Any, ToolContext], Awaitable[dict[str, Any]]]


_SPECS: list[ToolSpec] = [
    *[
        ToolSpec(
            name=s.name,
            description=s.description,
            args_model=s.args_model,
            handler=s.handler,
        )
        for s in erp_tools.REGISTRY
    ],
    ToolSpec(
        name="generate_report_pdf",
        description=(
            "Render a tabular PDF report from rows the agent has already retrieved. "
            "Returns a URL (signed Supabase URL if configured, otherwise a local file URI). "
            "Use for ad-hoc analytics — do NOT use this to regenerate official ERP invoice PDFs."
        ),
        args_model=GenerateReportPdfArgs,
        handler=generate_report_pdf,
    ),
    ToolSpec(
        name="search_knowledge",
        description=(
            "Semantic search over the indexed ERP knowledge base (parties + invoices). "
            "Call this BEFORE answering qualitative questions like "
            "'summarize our history with ACME' or 'what patterns do you see in overdue invoices'. "
            "Returns document excerpts with metadata (invoice_number, party_id, status). "
            "Do NOT use for exact lookups — use list_parties / get_invoice for those."
        ),
        args_model=SearchKnowledgeArgs,
        handler=search_knowledge,
    ),
    ToolSpec(
        name="generate_party_summary_pdf",
        description=(
            "Produce a narrative PDF summary for a single party. Retrieves that party's "
            "indexed documents, asks the LLM to synthesize a paragraph citing specific "
            "invoices, and renders it as a PDF. Pass party_id (UUID). Requires the RAG "
            "index to be populated — tell the user to click 'Re-index ERP' if retrieval is empty."
        ),
        args_model=GeneratePartySummaryPdfArgs,
        handler=generate_party_summary_pdf,
    ),
]

_BY_NAME = {s.name: s for s in _SPECS}


def openai_tool_schemas() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for spec in _SPECS:
        schema = spec.args_model.model_json_schema()
        schema.pop("title", None)
        out.append(
            {
                "type": "function",
                "function": {
                    "name": spec.name,
                    "description": spec.description,
                    "parameters": schema,
                },
            }
        )
    return out


async def dispatch(name: str, raw_args: dict[str, Any], ctx: ToolContext) -> dict[str, Any]:
    spec = _BY_NAME.get(name)
    if spec is None:
        return {"error": f"Unknown tool: {name}"}
    args = spec.args_model.model_validate(raw_args)
    return await spec.handler(args, ctx)
