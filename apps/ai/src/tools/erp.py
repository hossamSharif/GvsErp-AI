"""ERP tool definitions — the LLM sees these schemas and picks one to call.

Each tool is:
  1. a Pydantic model for typed/validated args,
  2. an async function taking the model + ToolContext,
  3. an entry in the REGISTRY, which also exposes the OpenAI tool-schema list.

The Pydantic schema doubles as the LLM-facing `parameters` JSON schema —
no hand-maintained duplicate. Validation on dispatch catches bad args
before they ever hit the ERP.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

from src.tools.context import ToolContext

# ── Argument schemas ─────────────────────────────────────────────────────

class ListPartiesArgs(BaseModel):
    type: Literal["customer", "supplier"] | None = Field(
        default=None, description="Filter by party type."
    )
    search: str | None = Field(
        default=None, description="Name / email / phone fragment to search for."
    )
    has_balance: bool | None = Field(
        default=None, description="If true, only parties with non-zero balance."
    )
    limit: int = Field(default=20, ge=1, le=100, description="Max rows to return.")


class GetPartyArgs(BaseModel):
    party_id: str = Field(..., description="UUID of the party.")


class ListInvoicesArgs(BaseModel):
    type: Literal["sale", "purchase"] | None = Field(
        default=None, description="Filter by invoice type."
    )
    status: Literal["draft", "final", "returned", "canceled"] | None = Field(
        default=None, description="Filter by invoice status."
    )
    party_id: str | None = Field(default=None, description="Filter by party UUID.")
    limit: int = Field(default=20, ge=1, le=100, description="Max rows to return.")


class GetInvoiceArgs(BaseModel):
    invoice_id: str | None = Field(default=None, description="UUID of the invoice.")
    invoice_number: str | None = Field(
        default=None,
        description="Human invoice number (e.g. INV-2026-001). Used when invoice_id is unknown.",
    )


class InvoiceItemArg(BaseModel):
    itemId: str = Field(..., description="UUID of the inventory item.")
    quantity: float = Field(..., gt=0, description="Quantity ordered.")
    unitPrice: float = Field(..., ge=0, description="Unit price in invoice currency.")
    discountPercent: float = Field(default=0, ge=0, le=100)
    taxRate: float = Field(default=0, ge=0, le=100)


class CreateInvoiceArgs(BaseModel):
    type: Literal["sale", "purchase"]
    partyId: str | None = Field(default=None, description="UUID of customer/supplier.")
    warehouseId: str = Field(..., description="UUID of warehouse holding the stock.")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    items: list[InvoiceItemArg] = Field(..., min_length=1)
    notes: str | None = Field(default=None, max_length=2000)


# ── Tool implementations ────────────────────────────────────────────────

async def list_parties(args: ListPartiesArgs, ctx: ToolContext) -> dict[str, Any]:
    return await ctx.erp.list_parties(
        type=args.type,
        search=args.search,
        has_balance=args.has_balance,
        limit=args.limit,
    )


async def get_party(args: GetPartyArgs, ctx: ToolContext) -> dict[str, Any]:
    return await ctx.erp.get_party(args.party_id)


async def list_invoices(args: ListInvoicesArgs, ctx: ToolContext) -> dict[str, Any]:
    return await ctx.erp.list_invoices(
        type=args.type,
        status=args.status,
        party_id=args.party_id,
        limit=args.limit,
    )


async def get_invoice(args: GetInvoiceArgs, ctx: ToolContext) -> dict[str, Any]:
    if args.invoice_id:
        return await ctx.erp.get_invoice(args.invoice_id)
    if args.invoice_number:
        return await ctx.erp.get_invoice_by_number(args.invoice_number)
    return {"error": "Provide either invoice_id or invoice_number."}


async def create_invoice(args: CreateInvoiceArgs, ctx: ToolContext) -> dict[str, Any]:
    return await ctx.erp.create_invoice(args.model_dump(exclude_none=True))


# ── Module registry entries — consumed by src/tools/registry.py ─────────

@dataclass
class ErpToolSpec:
    name: str
    description: str
    args_model: type[BaseModel]
    handler: Any


REGISTRY: list[ErpToolSpec] = [
    ErpToolSpec(
        name="list_parties",
        description=(
            "List customers or suppliers in the ERP. Use search to find a party by name "
            "before calling get_party or any invoice tool that needs a partyId."
        ),
        args_model=ListPartiesArgs,
        handler=list_parties,
    ),
    ErpToolSpec(
        name="get_party",
        description="Fetch one party by UUID, including balance and summary data.",
        args_model=GetPartyArgs,
        handler=get_party,
    ),
    ErpToolSpec(
        name="list_invoices",
        description="List invoices with filters (type, status, party). Paginated.",
        args_model=ListInvoicesArgs,
        handler=list_invoices,
    ),
    ErpToolSpec(
        name="get_invoice",
        description=(
            "Fetch a single invoice with all line items. Pass either invoice_id (UUID) "
            "or invoice_number (human)."
        ),
        args_model=GetInvoiceArgs,
        handler=get_invoice,
    ),
    ErpToolSpec(
        name="create_invoice",
        description=(
            "Create a DRAFT invoice. Caller must confirm before finalizing. "
            "Honors the dry-run flag — in dry-run the payload is echoed instead of POSTed."
        ),
        args_model=CreateInvoiceArgs,
        handler=create_invoice,
    ),
]
