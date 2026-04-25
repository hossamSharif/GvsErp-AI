# Deploy runbook — Vercel (web) + Fly.io (api)

Step-by-step commands. Run these in your own terminal — most need
interactive auth so I cannot run them for you.

---

## 0. Prerequisites (one-time)

- GitHub repo already exists: `hossamSharif/GvsErp-AI` ✓
- Supabase project is awake (free projects pause after 1 week idle):
  log in at https://supabase.com/dashboard and click your project to wake it.
- A credit card. **Both Vercel and Fly.io require one to verify free
  accounts** even on free tiers. You won't be charged unless you exceed
  the free allowance.

---

## 1. Commit and push the deploy artifacts

I created three new files at the repo root. Commit them along with whatever
other work you want to ship:

```bash
git add Dockerfile .dockerignore fly.toml DEPLOY.md
git status   # double-check nothing surprising is staged
git commit -m "Add Dockerfile, fly.toml, .dockerignore for Fly.io deploy"
git push
```

You have a lot of uncommitted work-in-progress files. Decide separately
whether to commit those before pushing — the deploy doesn't need them.

---

## 2. Deploy the API to Fly.io

### 2a. Install the Fly CLI

```powershell
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

Then restart your terminal so `flyctl` / `fly` is on PATH.

### 2b. Log in and create the app

```bash
fly auth signup        # or: fly auth login if you already have an account
fly launch --no-deploy
```

When `fly launch` asks:

- **App name**: `gvs-erp-api` (or pick another — it's the public hostname)
- **Region**: `fra` (Frankfurt) — closest to MENA. Other options: `cdg` Paris, `iad` US East, `sin` Singapore.
- **Postgres / Redis**: **No** to both. You're using Supabase.
- **Deploy now**: **No**. We need to set secrets first.

Fly may rewrite `fly.toml` during launch — that's fine, but verify
afterward that `internal_port = 3001` and the `[http_service.checks]`
block still point to `/health`.

### 2c. Set secrets (production env vars)

Get the values from your Supabase dashboard → Settings → API:

```bash
fly secrets set \
  SUPABASE_URL="https://<your-project>.supabase.co" \
  SUPABASE_ANON_KEY="<anon key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGIN="https://placeholder.vercel.app"
```

We'll fix `CORS_ORIGIN` after Vercel gives us the real URL in step 3.

> Skip Stripe vars unless you're using Stripe — they're optional.

### 2d. Deploy

```bash
fly deploy
```

This uploads the build context, runs the Dockerfile on Fly's remote
builder, and rolls out the machine. First build takes ~3-5 minutes.

### 2e. Verify

```bash
fly status
fly logs           # stream logs
curl https://gvs-erp-api.fly.dev/health
# expect: {"status":"ok","timestamp":"..."}
```

If `/health` returns 200, the API is live. Note the URL.

---

## 3. Deploy the web to Vercel

### 3a. Import the repo

1. Go to https://vercel.com/new
2. Sign in with GitHub, authorize the `GvsErp-AI` repo.
3. Click **Import**.

### 3b. Configure the project

In the Vercel import screen:

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: click "Edit" → set to `apps/web`
- **Build Command**: leave default (`next build`)
- **Install Command**: leave default — Vercel detects pnpm + workspace
- **Output Directory**: leave default

### 3c. Set environment variables

In the same screen, add these env vars (all three required):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase anon key) |
| `NEXT_PUBLIC_API_URL` | `https://gvs-erp-api.fly.dev` |

Click **Deploy**. First build takes ~2-3 minutes.

### 3d. Update the API's CORS_ORIGIN

Vercel gives you a URL like `gvs-erp-ai-abc123.vercel.app`. Update Fly:

```bash
fly secrets set CORS_ORIGIN="https://<your-vercel-url>.vercel.app"
# This triggers an automatic redeploy of the API.
```

---

## 4. Smoke test

Open the Vercel URL and:

- [ ] Login page loads (Arabic + English both work).
- [ ] Sign in with a Supabase user.
- [ ] Dashboard loads.
- [ ] Customers / Suppliers / Warehouses pages show data.
- [ ] Create a record (e.g. a new customer) — saves successfully.
- [ ] Browser DevTools → Network: requests to `/api/v1/*` return 200.

If something fails, check in this order:

1. `fly logs` — any 500 errors? CORS errors?
2. Vercel deployment logs — env var warnings?
3. Supabase dashboard → "Logs" — RLS policy denials?
4. Browser Network tab — what's the actual failing request?

---

## Common issues

**"CORS error" in browser**: `CORS_ORIGIN` on Fly doesn't match Vercel
URL exactly (https vs http, trailing slash). Re-set with the exact origin.

**API cold start takes 10s**: Expected on Fly free tier — the machine
scales to zero. To eliminate, set `min_machines_running = 1` in
`fly.toml` and redeploy. Costs ~$2/mo if usage stays minimal.

**Vercel build fails on workspace packages**: If `next build` can't
find `@erp/shared` etc., the issue is Vercel's install step didn't see
the workspace. Try setting Install Command to `pnpm install --frozen-lockfile`
explicitly, and ensure Root Directory is `apps/web` (Vercel walks up to
find pnpm-workspace.yaml).

**Fly build fails at `pnpm deploy`**: pnpm 8's deploy can be flaky with
workspace deps. If it fails, swap the runner stage in `Dockerfile` for
the simpler "copy everything" form — let me know and I'll patch it.

**Supabase RLS denies prod requests**: Check `migrations/015_fix_payments_rls_jwt.sql`
landed in your Supabase project. Remote DB needs the same migrations as local.

---

## Optional next steps (skip for now)

- Custom domain ($10-15/yr at Cloudflare/Namecheap):
  - Vercel → Settings → Domains → Add → follow DNS instructions
  - Fly → `fly certs add api.yourdomain.com` → add CNAME at registrar
- Branch previews: already free on Vercel; PRs auto-deploy to preview URLs.
- Promote `auto_stop_machines = "off"` to eliminate cold starts (~$2/mo).
- Deploy `apps/ai` later — needs separate $25-50/mo plan (Streamlit + scheduler).
