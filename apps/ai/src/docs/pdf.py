"""PDF generation — Jinja2 renders HTML, WeasyPrint turns it into a PDF.

Two execution paths:
  - Supabase configured → upload to the storage bucket and return a signed URL.
  - No Supabase or local-only mode → write to apps/ai/output/ and return the
    filesystem path. The agent sees a URL-ish string either way, so the tool
    schema stays the same from the LLM's perspective.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

from src.tools.context import ToolContext

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_LOCAL_OUTPUT = Path(__file__).resolve().parents[2] / "output"
_SIGNED_URL_TTL_SECONDS = 60 * 60  # 1 hour

_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)


class GenerateReportPdfArgs(BaseModel):
    title: str = Field(..., max_length=200, description="Report heading shown at the top.")
    subtitle: str | None = Field(default=None, max_length=500)
    columns: list[str] = Field(
        ...,
        min_length=1,
        description="Column headers, in order. Must match keys used in `rows`.",
    )
    rows: list[dict[str, Any]] = Field(
        ..., description="One dict per row; keys should be a subset of `columns`."
    )
    direction: Literal["ltr", "rtl"] = Field(default="ltr")


def _render_pdf(args: GenerateReportPdfArgs) -> bytes:
    # Import WeasyPrint lazily — on Windows it needs GTK runtime libs installed
    # at the OS level. Keep the rest of the app importable even if those are missing.
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except OSError as e:
        raise RuntimeError(
            "WeasyPrint couldn't load its native dependencies. "
            "On Windows, install GTK3 runtime — see "
            "https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows"
        ) from e

    template = _env.get_template("report.html.j2")
    html = template.render(
        title=args.title,
        subtitle=args.subtitle,
        columns=args.columns,
        rows=args.rows,
        direction=args.direction,
        generated_at=datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
    )
    return HTML(string=html).write_pdf()


def _save_local(pdf: bytes, filename: str) -> str:
    _LOCAL_OUTPUT.mkdir(parents=True, exist_ok=True)
    path = _LOCAL_OUTPUT / filename
    path.write_bytes(pdf)
    return path.as_uri()


def _save_supabase(pdf: bytes, filename: str, ctx: ToolContext) -> str:
    assert ctx.supabase is not None
    bucket = ctx.supabase.storage.from_(ctx.pdf_bucket)
    bucket.upload(
        path=filename,
        file=pdf,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    signed = bucket.create_signed_url(filename, _SIGNED_URL_TTL_SECONDS)
    return signed.get("signedURL") or signed.get("signed_url") or ""


async def generate_report_pdf(
    args: GenerateReportPdfArgs, ctx: ToolContext
) -> dict[str, Any]:
    pdf_bytes = _render_pdf(args)
    filename = f"report-{uuid.uuid4().hex[:8]}.pdf"

    if ctx.supabase is not None:
        try:
            url = _save_supabase(pdf_bytes, filename, ctx)
            return {"url": url, "filename": filename, "sink": "supabase-storage"}
        except Exception as e:
            # Fall through to local save so the learner can still see output.
            return {
                "url": _save_local(pdf_bytes, filename),
                "filename": filename,
                "sink": "local-fallback",
                "supabase_error": str(e),
            }

    return {"url": _save_local(pdf_bytes, filename), "filename": filename, "sink": "local"}
