"""ERP tools exposed as an MCP stdio server.

Consumers:
  * our own agent (see `src/agent/mcp_client.py`) — forces the
    agent→tools boundary to travel over MCP instead of a Python import
  * any MCP-compatible client (Claude Desktop, Cursor, Inspector) — see
    `docs/claude_desktop_config.example.json`

Auth model — this is a standalone process with no UI, so we can't prompt
the user for credentials. The parent process (Streamlit or Claude
Desktop) must pass:

  * MCP_ERP_JWT           Supabase access token (required)
  * MCP_ERP_API_BASE_URL  defaults to http://localhost:3001/api/v1
  * MCP_ERP_DRY_RUN       "true" | "false" — echo mutations instead of POSTing

One `ErpClient` is built per tool call (cheap — httpx connection pooling
lives inside the client and we want each invocation to be independently
cancellable). The tool function signatures mirror the Pydantic models in
`src/tools/erp.py`; FastMCP generates the JSON schema from the type
hints, so changes to the argument set only touch one place.

Run directly:
    uv run python -m src.mcp_server.erp_tools
"""

from __future__ import annotations

import os
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

from src.erp_client import ErpClient

# ── env-driven config ────────────────────────────────────────────────────

_JWT_ENV = "MCP_ERP_JWT"
_BASE_URL_ENV = "MCP_ERP_API_BASE_URL"
_DRY_RUN_ENV = "MCP_ERP_DRY_RUN"

_DEFAULT_BASE_URL = "http://localhost:3001/api/v1"


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _client() -> ErpClient:
    jwt = os.environ.get(_JWT_ENV, "")
    if not jwt:
        raise RuntimeError(
            f"{_JWT_ENV} is required — pass it in the MCP client's env block."
        )
    return ErpClient(
        jwt=jwt,
        base_url=os.environ.get(_BASE_URL_ENV, _DEFAULT_BASE_URL),
        dry_run=_env_flag(_DRY_RUN_ENV),
    )


# ── server ──────────────────────────────────────────────────────────────

mcp = FastMCP("erp-tools")


@mcp.tool()
async def list_parties(
    type: Literal["customer", "supplier"] | None = None,
    search: str | None = None,
    has_balance: bool | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List customers or suppliers in the ERP.

    Use `search` to find a party by name before calling `get_party` or any
    invoice tool that needs a partyId.
    """
    async with _client() as erp:
        return await erp.list_parties(
            type=type, search=search, has_balance=has_balance, limit=limit
        )


@mcp.tool()
async def get_party(party_id: str) -> dict[str, Any]:
    """Fetch one party by UUID, including balance and summary data."""
    async with _client() as erp:
        return await erp.get_party(party_id)


@mcp.tool()
async def list_invoices(
    type: Literal["sale", "purchase"] | None = None,
    status: Literal["draft", "final", "returned", "canceled"] | None = None,
    party_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List invoices with filters (type, status, party). Paginated."""
    async with _client() as erp:
        return await erp.list_invoices(
            type=type, status=status, party_id=party_id, limit=limit
        )


@mcp.tool()
async def get_invoice(
    invoice_id: str | None = None,
    invoice_number: str | None = None,
) -> dict[str, Any]:
    """Fetch a single invoice with all line items.

    Pass either `invoice_id` (UUID) or `invoice_number` (human, e.g. INV-2026-001).
    """
    if not (invoice_id or invoice_number):
        return {"error": "Provide either invoice_id or invoice_number."}
    async with _client() as erp:
        if invoice_id:
            return await erp.get_invoice(invoice_id)
        assert invoice_number is not None
        return await erp.get_invoice_by_number(invoice_number)


class InvoiceItem(BaseModel):
    """One line on a created invoice."""

    itemId: str = Field(..., description="UUID of the inventory item.")
    quantity: float = Field(..., gt=0)
    unitPrice: float = Field(..., ge=0)
    discountPercent: float = Field(default=0, ge=0, le=100)
    taxRate: float = Field(default=0, ge=0, le=100)


@mcp.tool()
async def create_invoice(
    type: Literal["sale", "purchase"],
    warehouseId: str,
    items: list[InvoiceItem],
    partyId: str | None = None,
    currency: str = "USD",
    notes: str | None = None,
) -> dict[str, Any]:
    """Create a DRAFT invoice.

    Honors MCP_ERP_DRY_RUN — when true, returns the echoed payload instead
    of POSTing to the ERP. Caller should confirm before finalizing.
    """
    body: dict[str, Any] = {
        "type": type,
        "warehouseId": warehouseId,
        "items": [item.model_dump() for item in items],
        "currency": currency,
    }
    if partyId:
        body["partyId"] = partyId
    if notes:
        body["notes"] = notes
    async with _client() as erp:
        return await erp.create_invoice(body)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
