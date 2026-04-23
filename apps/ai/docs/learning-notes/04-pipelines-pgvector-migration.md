# 04 — Pipelines + pgvector migration

Phase 4 deliverables: a Supabase migration (`014_ai_embeddings.sql`), a
backend-aware vector store (`src/rag/store.py`), a hash-aware idempotent
ingest path (`src/rag/store_pg.py` + `ingest.py`), a parity check
(`src/rag/parity.py`), an APScheduler runner (`src/pipelines/scheduler.py`),
and an Excel export tool (`src/docs/excel.py` + registry entry).

## Why a real vector store now

Phase 3's Chroma in-memory worked fine for one developer typing in one
process. The failure modes it can't model:

- **Persistence** — the index dies with the process. Useless for a scheduler
  that wants to re-embed nightly.
- **Tenancy** — single Python process, single tenant. Real SaaS needs RLS on
  the embeddings themselves.
- **Inspectability** — you can't `SELECT * FROM ai_embeddings WHERE …` against
  a Chroma in-memory collection.

pgvector solves all three at the cost of a migration, an extension, an
index, and a `match_*` RPC. That cost is the lesson.

## The migration in one block

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_embeddings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    source_table text NOT NULL,
    source_id    text NOT NULL,
    content      text NOT NULL,
    content_hash text NOT NULL,
    embedding    vector(768) NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}',
    embedded_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_table, source_id)
);

CREATE INDEX … USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
```

Three things to notice:

1. The shape (`id, content, metadata, embedding`) matches what LangChain's
   `SupabaseVectorStore` expects — that's why I can read through it without
   writing a custom retriever.
2. The extra columns (`tenant_id`, `source_table`, `source_id`,
   `content_hash`) are mine. They drive idempotent upserts and tenant
   scoping. LangChain doesn't know about them — so I can't use its
   `add_documents`. I write my own upsert.
3. `ivfflat` builds an approximate-nearest-neighbour index on the
   `embedding` column. Without it, every query is a sequential scan and
   pgvector loses its appeal.

## RLS the right way

The repo has a known scar: most tenant tables use
`current_setting('app.current_tenant_id', true)`, a session variable that
nothing in the API middleware ever sets, so RLS silently rejects every
write (memory: *"ERP tenant RLS uses unset session variable"*). Migration
013 fixed sales tables; 014 follows the same JWT-claim pattern from the
start:

```sql
USING (tenant_id = ((auth.jwt() -> 'user_metadata') ->> 'tenant_id')::uuid)
```

`auth.jwt()` is a Supabase helper that returns the verified JWT payload.
`user_metadata.tenant_id` is set at signup. RLS now actually enforces
tenant scoping for both reads (via `match_ai_embeddings`, which inherits
SECURITY INVOKER) and writes.

## The match_* RPC pattern

`SupabaseVectorStore` doesn't query the table directly — it calls a
PL/pgSQL function (default name `match_documents`, configurable). I named
mine `match_ai_embeddings`. The shape is fixed:

```sql
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
```

…ordered by cosine distance, optionally filtered by `metadata @> filter`.
LangChain wraps similarity_search around it; metadata-scoped retrieval
(`{"party_id": "..."}`) just works.

## Idempotent upsert via content hash

The whole reason `content_hash` is in the schema:

```python
new_hash = sha256(doc.page_content)
prior   = existing.get(source_id)
if prior and prior.content_hash == new_hash:
    skip                       # 0 tokens, 0 writes
else:
    embed + upsert
```

Run the pipeline twice in a row on unchanged data → second run reports
`inserted=0 updated=0 skipped=N`. That's the verification line in
`docs/genAiAppPlan.md`. Same idea as a Make target: cheap when nothing
changed, correct when something did.

`delete_stale` rounds out the cleanup: source_ids that disappeared from
the latest ERP pull are dropped from `ai_embeddings`. Otherwise deletes
on the source table would never propagate to the index.

## Backend-aware factory

`store.py` reads `settings.rag_backend` and returns either a Chroma or a
SupabaseVectorStore behind a common `VectorStore` type. Callers
(`retrieve.py`, `search_knowledge`, `generate_party_summary_pdf`) only
see `as_retriever(...)` — they don't care which backend.

The pgvector branch needs a `client` argument because LangChain's
`SupabaseVectorStore` takes one in its constructor. So every retrieval
call now threads `client=ctx.supabase` through. The chroma branch
ignores it. This is the smallest API change that lets the same code
work for both eras.

## Parity check

`parity.py` constructs *both* stores in one process and runs the same
five probe queries through each, comparing top-k source_ids by Jaccard
overlap. After both backends have been ingested from the same source
data, overlap should be ≥80%. Lower means I have a metadata field
mismatch or a different splitter setting between branches.

It's not a unit test — it's a one-line sanity check I can run after the
migration. "Did the move actually preserve answer quality?"

## APScheduler — the simplest scheduler that works

```python
scheduler = AsyncIOScheduler()
scheduler.add_job(reembed_job, "interval", minutes=1440, kwargs={"ctx": ctx})
scheduler.add_job(balance_snapshot_job, "interval", minutes=60, kwargs={"ctx": ctx})
scheduler.start()
```

Two opinions baked in:

- `coalesce=True` + `max_instances=1`: if the process was paused and missed
  N firings, run only once on resume. No thundering herd.
- One priming run on startup so `uv run python -m src.pipelines.scheduler`
  shows output immediately instead of waiting an hour.

Single-tenant per process for now (PIPELINE_TENANT_ID + PIPELINE_USER_JWT
in env). Multi-tenant looping with the service-role client is a Phase 7
concern — too much surface area for a learning step about *schedulers*.

## Excel export — openpyxl + matplotlib

The pattern: openpyxl builds the workbook from `rows`, matplotlib renders
the optional chart to in-memory PNG, openpyxl's `Image` embeds the PNG
on a second sheet. No temp files, no subprocesses.

`matplotlib.use("Agg")` before importing `pyplot` is the magic incantation
for headless rendering — no Tkinter, no display, safe in any environment.

The agent surfaces this as `generate_excel_report` with the same sink
fallback as the PDF tool (Supabase Storage signed URL, else local
file URI).

## What I want to remember next phase

- LangChain wrappers handle the *read* path well (one RPC, returns
  Documents). For the *write* path with extra columns + idempotency, write
  it yourself — fewer surprises.
- pgvector + RLS gives you tenant isolation for free *if* the policy uses
  `auth.jwt()` instead of an unset session variable. Verify the JWT-claim
  pattern every time.
- `lists=100` is fine for ≤100k vectors. Bump it (rule of thumb: `√N`)
  before the corpus grows past that.
- APScheduler's interval jobs are good enough for a learning stage. Cron
  expressions, persistent job stores, and distributed locking come when
  you have more than one instance.
- "Don't migrate the API surface" — the single most useful constraint of
  Phase 4. The agent didn't change. The chat didn't change. Only the
  store did. That's the kind of refactor I want to be able to repeat.
