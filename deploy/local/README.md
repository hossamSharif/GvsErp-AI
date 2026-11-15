# GVS ERP — Local Edition stack

Runs the whole ERP on one PC with Docker: a trimmed self-hosted Supabase
(Postgres, GoTrue, PostgREST, Storage), the GVS API, a migration runner and an
nginx gateway. See [`docs/local-edition-plan.md`](../../docs/local-edition-plan.md)
for the full plan.

> Status: **Phase 1** (database + backend). The web container, Windows
> installer, backups and license come in later phases.

## Services

| Service   | What it does                                                      |
|-----------|-------------------------------------------------------------------|
| `db`      | `supabase/postgres` — Postgres with Supabase roles, `auth`/`storage` schemas |
| `auth`    | GoTrue — email/password login, admin user API (no email server; auto-confirm) |
| `rest`    | PostgREST — the data API that supabase-js calls                   |
| `storage` | Storage API (file backend) — logos, invoice PDFs, item images     |
| `migrate` | One-shot: applies pending `packages/database/migrations/*.sql`, then exits |
| `api`     | GVS Express API (`DEPLOYMENT_MODE=local`)                         |
| `gateway` | nginx — the only published port, `127.0.0.1:8080`                 |

Gateway routes, all on one origin (`http://localhost:8080`):
`/auth/v1` → GoTrue, `/rest/v1` → PostgREST, `/storage/v1` → Storage,
`/api/v1` → API, `/` → web (Phase 2).

## Run it (developer machine)

```bash
cd deploy/local
node scripts/generate-env.mjs      # once: writes .env with fresh secrets
docker compose up -d --build       # builds gvs-migrate + gvs-api, starts everything
docker compose ps                  # all healthy; migrate shows "exited (0)"
curl http://localhost:8080/health
```

Reset to an empty database (deletes all local data):

```bash
docker compose down -v
```

## Migrations

`migrate/migrate.sh` applies every `*.sql` file in filename order, each in its
own transaction, and records it in `public.schema_migrations` (name + sha256).
Re-running is a no-op. It runs after GoTrue and Storage are healthy, because
migrations reference `auth.users` and `storage.buckets`, which those services create.

```bash
docker compose run --rm migrate              # apply pending migrations
docker compose run --rm -e BASELINE=1 migrate  # mark all as applied without running
```

### Fresh-database fixes (Phase 1 findings)

The migrations had never been applied in order to an empty database. The cloud
database was partly built by hand, so these were needed (all safe for the cloud
DB, which nothing re-runs migrations against):

| File | Problem on a fresh DB | Fix |
|---|---|---|
| `000_prerequisites.sql` (new) | `update_updated_at_column()` is used by 9 migrations but defined in none | Define it |
| `004` / `007` (edited) | Circular FKs: invoices → parties/warehouses (created later), payments → invoices | `invoices` FKs moved to end of `007`, same constraint names |
| `043_item_images_bucket.sql` (new) | `item-images` bucket was created in the dashboard | Create bucket + insert policy |
| `044_get_tenant_id_user_metadata.sql` (new) | `get_tenant_id()` reads a top-level JWT claim GoTrue never issues → "User profile not found" | Read top-level, fall back to `user_metadata` |
| `045_fix_items_audit_rls_jwt.sql` (new) | Items/categories/prices/packagings/audit policies still on the unset `app.current_tenant_id`; the fix was applied to the cloud but never committed | Same JWT-claim pattern as `013` |

## Verified end-to-end (Phase 1)

Against this stack, through the real API: register a company → log in (the same
GoTrue password flow the web uses) → `/auth/me` → create warehouse, customer,
supplier, category, item → purchase invoice + finalize → sales invoice +
finalize → payment → stock 100 − 10 = 90 → customer balance 0 → enable
accounting + COGS → journals for purchase, sale, FIFO COGS and receipt, all
balanced → audit log rows → logo upload to Storage and public URL served via
the gateway.

## Known gaps (next phases)

- **Web container** (Phase 2): runtime config instead of build-time
  `NEXT_PUBLIC_*`, always-online in local mode, hide email-based flows.
- **Public file URLs**: the API builds public URLs from `SUPABASE_URL`. Inside
  Docker that is `http://gateway:8080`, which the browser can't reach — add a
  separate public URL setting (Phase 2).
- **`POST /api/v1/auth/login`** returns "User not found" (it signs in on the
  service client, which then queries as the user). The web doesn't use it — it
  signs in with GoTrue directly — so it's left as is.
- **Image builds in this cloud sandbox**: `apk`/`npm` downloads inside
  `docker build` can't reach the internet here, so `gvs-api` was verified by
  running the built API on the host. The CI workflow (Phase 4) builds the images.
