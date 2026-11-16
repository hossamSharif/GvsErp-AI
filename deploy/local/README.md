# GVS ERP — Local Edition stack

Runs the whole ERP on one PC with Docker: a trimmed self-hosted Supabase
(Postgres, GoTrue, PostgREST, Storage), the GVS API, a migration runner and an
nginx gateway. See [`docs/local-edition-plan.md`](../../docs/local-edition-plan.md)
for the full plan.

> Status: **Phase 4 done** — full stack, offline license, daily backups,
> Windows installer/updater/launcher and the release workflow. Remaining: a
> real Windows PC test and a pilot client (see "Not yet tested on Windows").

## Services

| Service   | What it does                                                      |
|-----------|-------------------------------------------------------------------|
| `db`      | `supabase/postgres` — Postgres with Supabase roles, `auth`/`storage` schemas |
| `auth`    | GoTrue — email/password login, admin user API (no email server; auto-confirm) |
| `rest`    | PostgREST — the data API that supabase-js calls                   |
| `storage` | Storage API (file backend) — logos, invoice PDFs, item images     |
| `migrate` | One-shot: applies pending `packages/database/migrations/*.sql`, then exits |
| `api`     | GVS Express API (`DEPLOYMENT_MODE=local`)                         |
| `web`     | Next.js standalone server (`DEPLOYMENT_MODE=local`, image `deploy/local/web/Dockerfile`) |
| `gateway` | nginx — the only published port, `127.0.0.1:8080`                 |
| `backup`  | Daily full backup (database + uploaded files) into `./backups` (`C:\GvsERP\backups`) |

Gateway routes, all on one origin (`http://localhost:8080`):
`/auth/v1` → GoTrue, `/rest/v1` → PostgREST, `/storage/v1` → Storage,
`/api/v1` → API, `/api/health` → API readiness, `/` → web.

## Run it (developer machine)

```bash
cd deploy/local
node scripts/generate-env.mjs      # once: writes .env with fresh secrets
# docker-compose.yml uses released images only (what clients run);
# the build override builds gvs-migrate, gvs-api, gvs-web from this repo:
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
docker compose ps                  # all healthy; migrate shows "exited (0)"
curl http://localhost:8080/api/health
# open http://localhost:8080 — a fresh install opens the company setup
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

## Local mode (Phase 2)

One runtime switch, `DEPLOYMENT_MODE=local`, on the `api` and `web` containers.
When it is unset (the cloud), nothing below changes.

| Area | Local behaviour | Where |
|---|---|---|
| Config | Web reads `SUPABASE_ANON_KEY` from its env at request time and injects `window.__GVS_CONFIG__`; URLs are the page's own origin (one gateway). No per-install values in the image. | `apps/web/src/lib/runtime-config.ts`, `app/[locale]/layout.tsx` |
| Online state | Always online (server is on the same PC); no service worker, no offline sync queue | `hooks/use-online.ts`, `lib/offline/transport.ts`, `components/pwa/*` |
| First run | Login sends a fresh install to **Set up your company**; after that `/register` redirects to login and the API refuses a second company (403) | `GET /api/v1/auth/setup-status`, `auth.routes.ts`, `(auth)/login`, `(auth)/register` |
| Passwords | No email: "Forgot password" hidden, reset pages redirect to login, admins use **Set password** on Settings → Users | `components/dialogs/set-user-password-dialog.tsx`, `users.routes.ts` |
| Shared PC | **Switch user** button in the header; automatic sign-out after 30 minutes without activity | `components/layout/header.tsx`, `hooks/use-idle-sign-out.ts` |
| No internet | Receipt fonts bundled (`public/fonts`); WhatsApp share sends the message + downloads the PDF instead of a public link; Subscription settings hidden | `components/reports/receipt.tsx`, `share-invoice-whatsapp-dialog.tsx` |
| File URLs | API rewrites Supabase URLs from the internal `SUPABASE_URL` to `SUPABASE_PUBLIC_URL` so logos/PDFs open in the browser | `apps/api/src/lib/deployment.ts` |

The web standalone build is opt-in (`NEXT_BUILD_STANDALONE=1`), so the Vercel
build is unchanged.

## Verified in a browser (Phase 2)

Playwright against the full stack at `http://localhost:8080`, with **every
non-localhost request blocked** — 24/24 checks passed: fresh install → Arabic
setup page → company created and signed in → items/purchase/sale created and
shown in the UI → logo URL opens in the browser → Subscription hidden →
staff user created → admin sets their password → Switch user → staff signs in
→ forgot-password hidden → `/register` and `/forgot-password` redirect →
second company refused → 30-minute idle sign-out with explanation → zero
internet requests, zero page errors. Cloud check: a normal `next build` has no
standalone output and pages contain no injected config.

## License (Phase 3)

Owner guide: [`scripts/license/README.md`](../../scripts/license/README.md).

- No key → **14-day trial** (3 users) from company setup; then **read-only**
  (writes return `403 LICENSE_READ_ONLY`, reads keep working).
- Key = `GVS1.<payload>.<Ed25519 signature>`: client, max active users, expiry
  (or never), optional PC lock. Verified offline with the public key embedded
  in `apps/api/src/lib/license/public-key.ts` — currently the **TEST key**
  (`IS_TEST_KEY = true`, yellow warning on the License page). Replace it with
  your own before the first client.
- PC ID = short hash of `GVS_MACHINE_ID` (`.env`; random for now, the Windows
  installer will use the machine's MachineGuid).
- Stored in `app_license` (migration 046), readable/writable only by the API's
  service role. Clock set back > 48 h → read-only until corrected.
- API: `GET /api/v1/license/status`, `POST /api/v1/license` (admin). Guard and
  routes are mounted only with `DEPLOYMENT_MODE=local`.
- Web: banner under the header (trial days left / expiring / read-only),
  Settings → License page (status, PC ID, activate key); license errors are
  shown in the user's language.

Verified: 17 unit tests (`apps/api/tests/lib/license.test.ts`) + browser test
with internet blocked, 19/19: trial banner → trial over → read-only (writes
403, reads 200) → garbage and other-PC keys rejected with clear reasons →
PC-locked key activates → writes work → user limit enforced, shown in Arabic
in the Add User form → users can't edit `app_license` via the data API. Cloud
mode: no license endpoint (404) and writes unaffected.

## Backups (Phase 4)

`backup/backup.sh` runs in the `backup` container (`postgres:17-alpine`):

- **Daily, automatically**: about a minute after start and then every 10
  minutes it checks whether today's backup exists; if not, it makes one. A set
  is `gvs-<UTC time>.dump` (full `pg_dump` as `supabase_admin`) +
  `gvs-<UTC time>.storage.tgz` (uploaded files). Written to a temp name, checked
  with `pg_restore -l`, then renamed.
- **Retention by count**: newest 30 daily + 10 labelled (`manual`,
  `pre-update`, `before-restore`) — a PC that was off for weeks keeps its backups.
- `docker compose exec backup /bin/sh /opt/gvs/backup.sh now|list`
- **Restore**: stop `api web auth rest storage gateway`, then
  `docker compose run --rm backup restore <name>` (makes a `before-restore`
  backup first, recreates the database from the dump, restores the files,
  sanity-checks tables), then `docker compose up -d`.

Verified: automatic daily backup; disaster restore (all volumes deleted → fresh
install → restore → login works, data and logo back, later data gone,
migrations already applied); retention; damaged/missing backups refused.

## Windows (Phase 4)

`windows/` — Windows PowerShell 5.1 scripts, ASCII only:

| File | What it does |
|---|---|
| `Install.bat` → `install.ps1` | **Install and update.** Fresh PC: checks Windows build/RAM/disk/virtualization, enables WSL2, installs Docker Desktop (downloaded, or from `installers\` in the package), sets Docker to start with Windows and caps WSL memory, copies the app to `C:\GvsERP`, loads the bundled images, creates `.env` (Node from the API image; `GVS_MACHINE_ID` = Windows MachineGuid), starts the stack, creates the **GVS ERP** and **GVS ERP Tools** shortcuts. Restarts needed by WSL/Docker resume automatically after sign-in. Existing install: `pre-update` backup → new files and images → start → if it doesn't come up, previous files + version + pre-update backup are restored automatically. Log: `C:\GvsERP\logs\`. |
| `GvsERP.bat` → `start.ps1` | Desktop icon: starts Docker Desktop and the stack if needed, waits for `/api/health`, opens Edge in app mode. |
| `tools.ps1` | **GVS ERP Tools** menu: status, back up now, restore (pick from list, type YES), open backups folder, collect logs (zip on the desktop, secret values excluded), set a user's password (`scripts/reset-password.mjs` piped into the API container), stop. |
| `common.ps1` | Shared helpers. |

Verified here (Linux): all scripts parse with the PowerShell parser; the
`.env` helpers; and — run in PowerShell against the real stack — health checks,
back up now, restore and password reset. That run found and fixed a bug where
PowerShell swallowed `-d` (as `-Debug`) so `up -d` hung.

## Release (Phase 4)

`.github/workflows/local-edition-release.yml`:

- **Release**: push tag `local-v1.0.0` → tests → build the three images →
  start them with the client compose file (health, setup status, injected
  config, a backup) → push to GHCR → GitHub Release with
  `GvsERP-Local-1.0.0.zip` (`Install.bat`, `README.txt`, `app\`, `images\*.tar`).
- **Pilot/test build**: Actions → *Local Edition release* → Run workflow
  (version, optionally allow the TEST license key → version gets `-testkey`,
  optionally push images). The zip is a workflow artifact.
- Release builds **fail while the license TEST key is embedded**.
- Supabase images are not bundled: the first install downloads them from
  Docker Hub (~1.5 GB), so a PC needs internet once.

The packaging step was run locally and the zip was installed the way the
installer does (images loaded from the bundle, `.env` generated, started): the
24-check browser test passed on that install.

## Not yet tested on Windows

Can't run here: WSL2/Docker Desktop installation, restarts and resume,
shortcuts, Edge app window, MachineGuid, Docker auto-start, and the GitHub
Actions run itself (real `docker build` of the images). Do these on a clean
Windows 10/11 PC (or VM) before the first client — checklist in
`docs/local-edition-plan.md` §8.

## Known gaps

- **`POST /api/v1/auth/login`** returns "User not found" (it signs in on the
  service client, which then queries as the user). The web doesn't use it — it
  signs in with GoTrue directly — so it's left as is.
- **Image builds in this cloud sandbox**: `apk`/`npm` downloads inside
  `docker build` can't reach the internet here, so `gvs-api` and `gvs-web` were
  verified by running their built output in `node:20-alpine`. The release
  workflow builds the real images (first run not done yet).
- **Lint**: `next lint` / ESLint fail repo-wide (missing
  `@typescript-eslint/eslint-plugin`); pre-existing, unrelated to this work.
