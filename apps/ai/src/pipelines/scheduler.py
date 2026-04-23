"""Background pipelines via APScheduler.

Two jobs:
  - Daily re-embed: pull parties + invoices, idempotent upsert into pgvector.
    Re-running on unchanged data is a no-op (hash skip in store_pg.upsert_embeddings).
  - Hourly balance snapshot: write one row per party with outstanding balance to
    ai_balance_snapshots so the agent can answer trend questions cheaply.

The scheduler is single-tenant per process — it needs PIPELINE_TENANT_ID and
PIPELINE_USER_JWT in the env. A production setup would loop over every tenant
using the service-role client; we leave that as a Phase 7+ exercise so the
learning here is APScheduler + idempotent upserts, not a multi-tenant job
runner.

Run standalone:
    uv run python -m src.pipelines.scheduler
"""

from __future__ import annotations

import asyncio
import logging
import signal
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.config import settings
from src.erp_client import ErpClient
from src.rag.ingest import IngestReport, ingest_all

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

log = logging.getLogger("apps.ai.pipelines")


# ── jobs ───────────────────────────────────────────────────────────────


@dataclass
class JobContext:
    tenant_id: str
    jwt: str
    supabase: SupabaseClient


async def reembed_job(ctx: JobContext) -> IngestReport:
    log.info("re-embed: starting tenant=%s", ctx.tenant_id)
    async with ErpClient(jwt=ctx.jwt) as erp:
        report = await ingest_all(erp, supabase=ctx.supabase, tenant_id=ctx.tenant_id)
    log.info(
        "re-embed: parties=%d invoices=%d inserted=%d updated=%d skipped=%d deleted=%d",
        report.parties,
        report.invoices,
        report.inserted,
        report.updated,
        report.skipped,
        report.deleted,
    )
    if report.errors:
        for err in report.errors:
            log.warning("re-embed error: %s", err)
    return report


async def balance_snapshot_job(ctx: JobContext) -> int:
    """Snapshot outstanding balances per party. Returns the row count written."""
    log.info("balance-snapshot: starting tenant=%s", ctx.tenant_id)
    async with ErpClient(jwt=ctx.jwt) as erp:
        payload = await erp.list_parties(has_balance=True, limit=500)

    parties = _as_list(payload)
    rows = [
        {
            "tenant_id": ctx.tenant_id,
            "party_id": p["id"],
            "party_name": p.get("name"),
            "balance": p.get("balance", 0),
            "currency": p.get("currency"),
        }
        for p in parties
        if p.get("id") is not None
    ]
    if not rows:
        log.info("balance-snapshot: no parties with balance — skip insert")
        return 0
    ctx.supabase.table("ai_balance_snapshots").insert(rows).execute()
    log.info("balance-snapshot: wrote %d rows", len(rows))
    return len(rows)


def _as_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "items", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


# ── runner ─────────────────────────────────────────────────────────────


def build_scheduler(ctx: JobContext) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        reembed_job,
        "interval",
        minutes=settings.pipeline_reembed_interval_min,
        kwargs={"ctx": ctx},
        id="reembed",
        coalesce=True,
        max_instances=1,
        next_run_time=None,  # don't run on boot — schedule's first interval kicks in
    )
    scheduler.add_job(
        balance_snapshot_job,
        "interval",
        minutes=settings.pipeline_balance_interval_min,
        kwargs={"ctx": ctx},
        id="balance_snapshot",
        coalesce=True,
        max_instances=1,
        next_run_time=None,
    )
    return scheduler


async def _main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    if settings.rag_backend != "pgvector":
        raise SystemExit(
            "Scheduler requires RAG_BACKEND=pgvector — chroma is in-memory and "
            "would discard the work between processes."
        )
    if not (settings.pipeline_tenant_id and settings.pipeline_user_jwt):
        raise SystemExit(
            "Set PIPELINE_TENANT_ID and PIPELINE_USER_JWT in apps/ai/.env "
            "(JWT must belong to a user in that tenant)."
        )
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise SystemExit("Scheduler needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")

    from supabase import create_client  # noqa: PLC0415

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    # Even with the service-role key, attaching the JWT keeps writes attributed
    # to the user — useful for audit trails when we add them later.
    supabase.postgrest.auth(settings.pipeline_user_jwt)

    ctx = JobContext(
        tenant_id=settings.pipeline_tenant_id,
        jwt=settings.pipeline_user_jwt,
        supabase=supabase,
    )

    log.info(
        "starting scheduler — re-embed every %dm, balance every %dm",
        settings.pipeline_reembed_interval_min,
        settings.pipeline_balance_interval_min,
    )

    # First-pass priming: do one of each immediately so a quick verification
    # run shows output in under 5 minutes.
    await reembed_job(ctx)
    await balance_snapshot_job(ctx)

    scheduler = build_scheduler(ctx)
    scheduler.start()

    stop = asyncio.Event()
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler in the proactor loop;
            # rely on KeyboardInterrupt below.
            pass

    try:
        await stop.wait()
    except KeyboardInterrupt:
        pass
    finally:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")


if __name__ == "__main__":
    asyncio.run(_main())
