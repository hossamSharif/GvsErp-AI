"""Shared execution context handed to every tool call.

Keeping this in its own module avoids the obvious erp.py ↔ docs/pdf.py
import cycle — both tool modules import from here, not from each other.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

    from src.erp_client import ErpClient


@dataclass
class ToolContext:
    erp: ErpClient
    supabase: SupabaseClient | None = None
    dry_run: bool = False
    pdf_bucket: str = "ai-reports"
    # Provider + model are threaded in so tools that need their own LLM call
    # (e.g. narrative synthesis inside generate_party_summary_pdf) use the
    # same backend the user chose in the sidebar.
    provider: str = "google"
    model: str | None = None
