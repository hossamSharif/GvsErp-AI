"""RAG tools — the agent's window into the vector store.

`search_knowledge` is the qualitative-question tool: "what's our history
with ACME?", "which invoices involved overdue payments?". The agent should
call this *before* writing narrative text, so the response is grounded in
retrieved documents (and cites specific invoice numbers from metadata).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from src.rag.retrieve import DEFAULT_K, search
from src.tools.context import ToolContext


class SearchKnowledgeArgs(BaseModel):
    query: str = Field(..., min_length=2, description="Natural-language query.")
    k: int = Field(
        default=DEFAULT_K,
        ge=1,
        le=20,
        description="Number of documents to retrieve.",
    )


async def search_knowledge(
    args: SearchKnowledgeArgs, ctx: ToolContext
) -> dict[str, Any]:
    docs = search(args.query, k=args.k, client=ctx.supabase)
    return {
        "query": args.query,
        "count": len(docs),
        "results": [
            {"content": d.page_content, "metadata": d.metadata}
            for d in docs
        ],
    }
