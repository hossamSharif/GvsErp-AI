# GVS ERP — Local Edition (On-Premise, Single PC) Plan

## Context

Many leads want the ERP to run **locally on their own PC** instead of the cloud
(Vercel + Fly.io + hosted Supabase). Typical client: **one warehouse, one PC,
several staff sharing that PC**. Goals: easy one-time setup, zero-effort daily use,
and **minimum engineering effort / stack change**, keeping one codebase for cloud and local.

### Decisions taken
| Topic | Decision |
|---|---|
| Runtime | **Docker (WSL2)** on the client's Windows PC |
| Network | **Only that one PC** (everything on `localhost`, LAN can come later) |
| AI module (`apps/ai`) | **Excluded from v1** |
| Licensing | **Simple offline license key** (signed, verified by API) |

### Why Docker + self-hosted Supabase (and not a rewrite)
Exploration showed:
- **Web** (`apps/web`) uses Supabase only for **auth/session** (`src/providers/auth-provider.tsx`) and the bearer token in `src/lib/api-client.ts:47-61`. All data goes through the Express API.
- **API** (`apps/api`) is deeply Supabase-bound: ~362 `.from()` + 18 `.rpc()` via supabase-js with per-request user JWT (`src/middleware/tenant.ts:75-109`), auth via `supabase.auth.getUser` (`src/middleware/auth.ts:52-93`), GoTrue admin calls (`routes/auth.routes.ts`, `services/user.service.ts`), Storage for logos/invoice PDFs.
- **DB**: 43 migrations (`packages/database/migrations/`), 111 RLS policies using `auth.jwt()` / `auth.uid()`, 49 triggers, 68 functions, extensions `uuid-ossp`, `pgcrypto`, `vector`.

Rewriting to plain Postgres + custom auth = weeks of risky work. Running **the same Supabase
services locally** keeps the code, migrations and RLS unchanged → smallest effort.

---

## 0. Repository strategy — same repo, no impact on live users

**Use this repo (`hossamSharif/GvsErp-AI`); no new repo needed.** A separate repo would
fork the codebase and force every bug fix / feature to be done twice.

How the live cloud version stays safe:
- **Feature flag**: every local-only behavior is behind `DEPLOYMENT_MODE=local`. Cloud
  (Vercel + Fly) never sets it → behaves exactly as today.
- **Additive files only**: local packaging lives in a new folder `deploy/local/`
  (`docker-compose.yml`, `kong.yml`, `scripts/*.ps1`) plus `Dockerfile.web` /
  `Dockerfile.migrate`. The existing `Dockerfile`, `fly.toml`, Vercel settings are untouched.
- **Branch isolation**: work happens on `claude/local-app-offline-version-s4e6gw`; the live
  branch (`001-modular-erp-saas`) is only touched via a reviewed PR when ready.
  - Vercel builds pushes to other branches as **preview** deployments only — production is not affected.
  - Fly deploys are manual (`fly deploy`) — nothing auto-deploys the API.
  - No GitHub Actions workflows exist yet; the new image-build workflow will trigger only on tags like `local-v*`.
- **Shared migrations**: new migrations (e.g. `043_local_bootstrap.sql`) must be safe for the
  cloud DB too (idempotent `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), since both editions share one schema.
- **Regression gate**: before merging, verify the cloud build/deploy with `DEPLOYMENT_MODE` unset (see §8).

---

## 1. Target architecture (one `docker-compose.yml`)

All ports bound to `127.0.0.1` only (not reachable from LAN).

| Service | Image | Purpose | Port (host) |
|---|---|---|---|
| `db` | `supabase/postgres` (pinned) | Postgres + `auth`/`storage` schemas, roles, pgvector | none (internal) |
| `auth` | `supabase/gotrue` | Login (email/password), admin user API | internal |
| `rest` | `postgrest/postgrest` | Data API used by supabase-js | internal |
| `storage` | `supabase/storage-api` (file backend) | Logos, invoice PDFs, item images | internal |
| `kong` | `kong` (declarative config from Supabase self-host) | Gateway `/auth/v1`, `/rest/v1`, `/storage/v1` | `127.0.0.1:8000` |
| `migrate` | `gvs-migrate` (one-shot) | Applies pending app migrations, then exits | — |
| `api` | `gvs-api` (existing `Dockerfile`) | Express API | internal (web proxies `/api/v1`) |
| `web` | `gvs-web` (new, Next.js standalone) | UI | `127.0.0.1:3000` |
| `backup` | `postgres` + cron loop | Daily `pg_dump` + storage archive | — |

Dropped from the official Supabase self-host stack: Studio, Realtime, Meta, Analytics/Logflare,
Vector, imgproxy, Edge Functions, Supavisor → ~1.5–2 GB RAM total.

Volumes: named volumes for `db` and `storage` (fast, inside WSL2);
**bind mount `C:\GvsERP\backups`** so backups are visible in Windows Explorer.

---

## 2. Required code changes (small, all behind a `DEPLOYMENT_MODE=local` flag)

### 2.1 Runtime config for the web (instead of build-time `NEXT_PUBLIC_*`)
Each install generates its own JWT secret / anon key, so the web image cannot bake them in.
- Add a runtime config (e.g. layout injects `window.__GVS_CONFIG__` from server env, or `GET /runtime-config`) with `supabaseUrl`, `supabaseAnonKey`, `apiUrl`, `deploymentMode`.
- Read it in `apps/web/src/providers/auth-provider.tsx:45-48` and `apps/web/src/lib/api-client.ts:9,53-54` (fallback to `NEXT_PUBLIC_*` for cloud).
- `apps/web/next.config.mjs`: add `output: 'standalone'` for a small web image; add a `Dockerfile.web`.

### 2.2 Always-online in local mode
`navigator.onLine` is false when the PC has no network adapter/internet, even though the
server is on `localhost` → app would wrongly switch to Dexie offline mode.
- `apps/web/src/hooks/use-online.ts` and `isOnline()` in `apps/web/src/lib/offline/transport.ts:37`: in local mode return `true` (or use an `/health` ping). Offline engine/outbox stay dormant.

### 2.3 Auth flows without email
- GoTrue: `GOTRUE_MAILER_AUTOCONFIRM=true`, no SMTP.
- Hide **Forgot password** / reset pages in local mode (`(auth)/forgot-password`, `reset-password`).
- Admin resets staff passwords from user management (already exists: `user.service.ts` `changePassword` → `auth.admin.updateUserById`).
- Owner lost password → support script `reset-admin-password.ps1` (runs a one-off container calling the admin API).
- *(Optional, phase 2)* username login for shared PC: map `username` → synthetic email `username@local.gvs`.

### 2.4 Single-tenant first-run
- `POST /api/v1/auth/register` (`apps/api/src/routes/auth.routes.ts:95+`): in local mode allow only when **no tenant exists**; afterwards 403. Hide sign-up link after setup.
- First launch opens `/register` as a **setup wizard** (company name, owner account, then warehouse).
- Hide subscription/billing UI in local mode.

### 2.5 Shared-PC usability
- Prominent **"Switch user"** action in the header (`components/layout/header.tsx`) = logout → login.
- Auto-lock after N minutes idle reusing the existing local PIN lock (`apps/web/src/lib/offline/auth-local.ts`).

### 2.6 Remove runtime internet dependencies
- `apps/web/src/components/reports/receipt.tsx:24-27` loads Roboto from cdnjs → bundle fonts in `apps/web/public/fonts/` (Arabic font already referenced there in `items-report.tsx`).
- Invoice WhatsApp **share links** (`/s/<token>`, `routes/shares.routes.ts`) point to `localhost` and won't open on a customer's phone → in local mode hide "share link", keep **Download/Print PDF** (user sends the file via WhatsApp Desktop).
- Item images: `apps/web/src/hooks/use-image-upload.ts` uploads to bucket `item-images` (currently unused component) → create the bucket in a migration so it works locally.

### 2.7 Migration runner + fresh-DB bootstrap (also benefits cloud/staging)
- No migration runner exists today. Add `packages/database/scripts/migrate.ts`: `schema_migrations` table, apply files in filename order, each in a transaction. Packaged as `gvs-migrate` image; runs **after `auth` is healthy** (migrations 016/017 reference `auth.users`, created by GoTrue).
- Note duplicate `017_*` numbers — filename ordering is deterministic (`017_ai_user_memory` < `017_fix_transfers_rls_jwt`), keep as is.
- Add `043_local_bootstrap.sql`: create storage buckets `item-images` (missing from migrations), verify `invoice-shares` / `tenant-logos`.
- **Must test all 43 migrations on an empty DB** — the cloud DB may contain manual changes not captured in migrations.

### 2.8 License key (offline, signed)
- Payload: `{ client, edition: "local", max_users, expires_at, machine_id?, issued_at }`, signed with **Ed25519**. Private key stays with you (small CLI `scripts/issue-license.mjs`); public key embedded in `gvs-api`.
- Install script reads Windows `MachineGuid` (registry) → passed to API as env `MACHINE_ID` for optional binding.
- API: verify at startup + middleware. Expired/invalid → **read-only mode** (GETs allowed, writes blocked, banner shown) — never lock the client out of their data. Enforce `max_users` in user creation (`user.service.ts`). Store last-seen timestamp in DB to detect clock rollback.
- Settings page: show license info + "Enter new license key".
- It's a deterrent, not strong protection (an admin with Docker access can tamper) — acceptable for v1. Images ship compiled bundles, not source.

**Estimated effort for section 2: ~5–8 dev-days.**

---

## 3. Packaging & distribution

- **CI (GitHub Actions)**: build and push `gvs-api`, `gvs-web`, `gvs-migrate` to a **private GHCR** registry, tagged by version. Supabase images pinned by digest.
- **Offline package** for slow-internet clients: `docker save` all images into `gvs-images-<ver>.tar` on USB.
- **Install folder** `C:\GvsERP\`: `docker-compose.yml`, generated `.env`, `scripts\*.ps1`, `backups\`, `license.key`.
- v1 delivery: ZIP with `Install.bat` (double-click → elevated PowerShell). Phase 2: wrap in a single `GvsERP-Setup.exe` (Inno Setup, free).

### Install script (`install.ps1`) — one time, ~20–30 min
1. Check Windows 10 22H2+/11 64-bit, RAM ≥ 8 GB, virtualization enabled.
2. Enable WSL2 (`wsl --install --no-distribution`) → reboot if needed, resume automatically.
3. Silent-install Docker Desktop (`--quiet --accept-license`), enable *start at login*, cap memory via `.wslconfig` (e.g. 3 GB).
4. Generate secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, signed `ANON_KEY` / `SERVICE_ROLE_KEY` (one-off container script).
5. `docker login` to GHCR with a read-only token **or** `docker load` from the USB tar.
6. `docker compose up -d` → wait for health → `migrate` runs.
7. Prompt for license key, create desktop shortcut, open first-run wizard.

### Daily use — zero steps
- All services `restart: unless-stopped`; Docker Desktop starts at Windows login.
- Desktop icon **"GVS ERP"** → `GvsERP.bat`: waits until `http://localhost:3000/health` responds (shows "Starting…"), then opens `msedge --app=http://localhost:3000` (app-like window, no browser UI). PWA install also works since `localhost` is a secure context.

### Hardware minimum
Windows 10 22H2 / 11 (64-bit), 8 GB RAM, SSD, 20 GB free disk, BIOS virtualization ON.

---

## 4. Backup, restore, updates

- **Automatic backup**: `backup` service runs `pg_dump -Fc` daily (+ on update) and tars the storage volume → `C:\GvsERP\backups\gvs-YYYY-MM-DD.*`, keep last 30. Recommend clients copy the folder to USB / OneDrive (optional scheduled task).
- **Restore**: `restore.ps1 <file>` → stops api/web, restores DB + storage, restarts.
- **Update**: `update.ps1` → backup → pull new tags (or `docker load` tar) → set `GVS_VERSION` → `docker compose up -d` → `migrate` applies new migrations → health check → on failure, revert tags + restore backup.
- Support scripts: `status.ps1` (health of all services), `logs.ps1` (zip logs for support), `reset-admin-password.ps1`.

---

## 5. Out of scope for v1 / later phases
- AI assistant (`apps/ai`) — needs cloud LLMs; later optional with internet or local Ollama.
- LAN access from other devices (needs local HTTPS cert, e.g. Caddy internal CA, and origin-relative URLs).
- Cloud backup / sync to hosted Supabase.
- Docker-Desktop-free runtime (Docker Engine inside a WSL distro) if licensing or weight becomes a concern. Note: Docker Desktop is free for businesses < 250 employees **and** < $10M revenue — typical clients qualify.
- Single `.exe` installer, username-based login.

## 6. Risks
| Risk | Mitigation |
|---|---|
| Migrations don't apply cleanly on empty DB | Fresh-DB CI test; fix gaps in `043_local_bootstrap.sql` |
| Virtualization disabled / old PCs | Pre-flight check in installer + documented hardware minimum |
| Data loss on client PC | Daily auto-backup + backup before every update + restore script |
| Supabase image upgrades break | Pin versions/digests; upgrade only via tested releases |
| Clock tampering / license bypass | Last-seen timestamp check; accept as deterrent-level protection |

---

## 7. Implementation phases (after this plan is approved)
1. **Fresh-DB + migration runner** (2.7) and local `docker-compose.yml` working on a dev machine.
2. **Code changes** 2.1–2.6 behind `DEPLOYMENT_MODE=local`.
3. **License** (2.8) + issuer CLI.
4. **Packaging**: CI images, install/update/backup/restore scripts, desktop launcher.
5. **Pilot** with 1–2 leads, then a release checklist.

## 8. Verification (when implemented)
- On a clean Windows 11 VM: run `Install.bat` end-to-end → wizard → create tenant, warehouse, items, purchase, sales invoice, receipt PDF (with network adapter **disabled** to prove no internet dependency).
- Reboot PC → click icon → app opens with no manual steps.
- Two staff accounts: switch user, idle auto-lock, role permissions.
- `backup.ps1` → wipe volumes → `restore.ps1` → data intact.
- `update.ps1` from version N to N+1 with a new migration → data intact; forced failure → rollback works.
- License: valid key OK; expired key → read-only banner, writes blocked; `max_users` enforced.
- Cloud regression: existing Vercel/Fly deployment unaffected with `DEPLOYMENT_MODE` unset.

---
