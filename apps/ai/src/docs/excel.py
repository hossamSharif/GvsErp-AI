"""Excel export — openpyxl workbook + optional matplotlib chart embed.

The chart is rendered with matplotlib (PNG bytes), then placed on a second
worksheet via openpyxl's `Image`. The agent only needs to specify a chart
type + the column to plot — everything else is inferred from `rows`.

Same sink semantics as PDF: Supabase Storage signed URL when a client is
configured, local file URI otherwise.
"""

from __future__ import annotations

import io
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from pydantic import BaseModel, Field

from src.tools.context import ToolContext

_LOCAL_OUTPUT = Path(__file__).resolve().parents[2] / "output"
_SIGNED_URL_TTL_SECONDS = 60 * 60

_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_FILL = PatternFill("solid", fgColor="305496")


ChartKind = Literal["bar", "line", "none"]


class ChartSpec(BaseModel):
    kind: ChartKind = Field(default="none", description="Chart style or 'none' to skip.")
    label_column: str | None = Field(
        default=None, description="Column whose values become x-axis labels."
    )
    value_column: str | None = Field(
        default=None, description="Numeric column to plot."
    )
    title: str | None = None


class GenerateExcelReportArgs(BaseModel):
    title: str = Field(..., max_length=200, description="Workbook title cell + filename.")
    columns: list[str] = Field(
        ..., min_length=1, description="Column headers in order; keys into `rows`."
    )
    rows: list[dict[str, Any]] = Field(
        ..., description="One dict per row; values are written as-is (numbers stay numeric)."
    )
    chart: ChartSpec = Field(default_factory=ChartSpec)


def _render_chart_png(spec: ChartSpec, rows: list[dict[str, Any]]) -> bytes | None:
    if spec.kind == "none" or not spec.value_column or not spec.label_column:
        return None
    # Lazy import keeps Streamlit cold-start under a second when no chart is needed.
    import matplotlib  # noqa: PLC0415

    matplotlib.use("Agg")  # headless backend — no GUI, safe in any environment
    import matplotlib.pyplot as plt  # noqa: PLC0415

    labels = [str(r.get(spec.label_column, "")) for r in rows]
    values: list[float] = []
    for r in rows:
        v = r.get(spec.value_column, 0)
        try:
            values.append(float(v))
        except (TypeError, ValueError):
            values.append(0.0)

    fig, ax = plt.subplots(figsize=(8, 4.5))
    if spec.kind == "bar":
        ax.bar(labels, values)
    else:
        ax.plot(labels, values, marker="o")
    ax.set_title(spec.title or f"{spec.value_column} by {spec.label_column}")
    ax.set_xlabel(spec.label_column)
    ax.set_ylabel(spec.value_column)
    fig.autofmt_xdate(rotation=30)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120)
    plt.close(fig)
    return buf.getvalue()


def _build_workbook(args: GenerateExcelReportArgs) -> bytes:
    wb = Workbook()
    data_ws = wb.active
    assert data_ws is not None
    data_ws.title = "Data"

    data_ws["A1"] = args.title
    data_ws["A1"].font = Font(bold=True, size=14)
    data_ws["A2"] = f"Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}"
    data_ws["A2"].font = Font(italic=True, color="666666")

    header_row = 4
    for col_idx, name in enumerate(args.columns, start=1):
        cell = data_ws.cell(row=header_row, column=col_idx, value=name)
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL

    for row_idx, row in enumerate(args.rows, start=header_row + 1):
        for col_idx, name in enumerate(args.columns, start=1):
            data_ws.cell(row=row_idx, column=col_idx, value=row.get(name))

    # Column widths — rough auto-fit based on header length.
    for col_idx, name in enumerate(args.columns, start=1):
        data_ws.column_dimensions[data_ws.cell(row=1, column=col_idx).column_letter].width = (
            max(len(name) + 2, 14)
        )

    chart_png = _render_chart_png(args.chart, args.rows)
    if chart_png is not None:
        from openpyxl.drawing.image import Image as XlImage  # noqa: PLC0415

        chart_ws = wb.create_sheet("Chart")
        img = XlImage(io.BytesIO(chart_png))
        chart_ws.add_image(img, "B2")

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _save_local(payload: bytes, filename: str) -> str:
    _LOCAL_OUTPUT.mkdir(parents=True, exist_ok=True)
    path = _LOCAL_OUTPUT / filename
    path.write_bytes(payload)
    return path.as_uri()


def _save_supabase(payload: bytes, filename: str, ctx: ToolContext) -> str:
    assert ctx.supabase is not None
    bucket = ctx.supabase.storage.from_(ctx.pdf_bucket)
    bucket.upload(
        path=filename,
        file=payload,
        file_options={
            "content-type": (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            "upsert": "true",
        },
    )
    signed = bucket.create_signed_url(filename, _SIGNED_URL_TTL_SECONDS)
    return signed.get("signedURL") or signed.get("signed_url") or ""


async def generate_excel_report(
    args: GenerateExcelReportArgs, ctx: ToolContext
) -> dict[str, Any]:
    payload = _build_workbook(args)
    filename = f"report-{uuid.uuid4().hex[:8]}.xlsx"

    if ctx.supabase is not None:
        try:
            url = _save_supabase(payload, filename, ctx)
            return {"url": url, "filename": filename, "sink": "supabase-storage"}
        except Exception as e:
            return {
                "url": _save_local(payload, filename),
                "filename": filename,
                "sink": "local-fallback",
                "supabase_error": str(e),
            }

    return {"url": _save_local(payload, filename), "filename": filename, "sink": "local"}
