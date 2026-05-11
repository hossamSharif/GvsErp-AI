# 06 — Consuming MCP Servers: External Integrations

## What we built
- **Google Workspace MCP server** (`src/mcp_server/google_workspace.py`) — 6 tools wrapping Gmail, Drive, and Calendar APIs via a single FastMCP stdio server.
- **WhatsApp Business MCP server** (`src/mcp_server/whatsapp.py`) — 2 tools wrapping Meta Graph API (template messages + template listing).
- **Multi-MCP hub** (`src/agent/mcp_hub.py`) — replaces the single `McpErpClient` from Phase 5. Spawns multiple MCP server subprocesses, merges their tool schemas, routes calls to the correct server.
- **Token vault** — `ai_connected_services` table (migration 016) + Fernet encryption in Python (`src/mcp_clients/token_store.py`). OAuth tokens encrypted before INSERT, decrypted on load.
- **Google OAuth flow** (`src/mcp_clients/google_oauth.py`) — three-legged OAuth 2.0 via `google-auth-oauthlib`. Streamlit captures the callback `?code=` from query params.
- **Destructive-action confirmation gate** — tools like `send_email`, `upload_to_drive`, `create_calendar_event`, `send_whatsapp` pause the agent loop and show a Confirm/Cancel UI.

## Key concepts

### MCP as a universal tool boundary
- Phase 5: one MCP server (ERP tools), one client.
- Phase 6: three servers (ERP + Google + WhatsApp), one hub client.
- The agent loop doesn't care how many servers exist — `McpHub.owns(name)` routes transparently.
- Adding a new service = new MCP server + add to `build_mcp_configs()`. Zero agent loop changes.

### OAuth 2.0 — the three-legged flow
1. **Build auth URL** — includes scopes, `access_type=offline` (for refresh token), `prompt=consent`.
2. **User authorizes** — Google redirects back with `?code=...`.
3. **Exchange code** — POST to Google's token endpoint → `access_token` + `refresh_token`.
4. **Refresh** — access tokens expire (~1h); refresh tokens are long-lived. `refresh_if_needed()` handles this transparently.

### Token vaulting — why encrypt at rest?
- OAuth tokens are as sensitive as passwords — anyone with a valid access_token can read your email.
- **Fernet** (AES-128-CBC + HMAC-SHA256) encrypts the JSON token blob before it hits the database.
- The encryption key (`TOKEN_ENCRYPTION_KEY`) lives in `.env`, never in the DB.
- Even if the DB is compromised, tokens are useless without the key.
- `pgcrypto` extension is enabled for `gen_random_uuid()` but actual crypto is Python-side (simpler, no key in SQL).

### Destructive-action confirmation
- Sending email, uploading files, creating events = irreversible. Agent must not fire-and-forget.
- The hub tracks `DESTRUCTIVE_TOOLS` — a set of tool names.
- Agent loop checks `hub.is_destructive(name)` before dispatch.
- If destructive + not pre-confirmed → return `PendingConfirmation`, pause the loop.
- Streamlit shows the tool name + arguments + Confirm/Cancel buttons.
- On Confirm → re-run agent with `confirmed_calls={call_id}` → skips the gate for that specific call.

### Why build MCP servers instead of consuming community ones?
- **More learning** — implementing the Google API wrappers teaches OAuth, scopes, API pagination, error handling.
- **Full control** — auth model matches our token vault exactly (env-driven tokens passed at subprocess spawn).
- **Reliability** — no dependency on community server maintenance or compatibility.
- **Portfolio value** — "I built MCP servers for 4 different APIs" > "I configured someone else's server".

## Things that surprised me
- Google's `googleapiclient.discovery.build()` is synchronous and can't be easily awaited — but FastMCP tools are async. Since each tool call is independent and short-lived, the blocking call is fine for now.
- `st.query_params` in Streamlit makes OAuth callbacks surprisingly clean — no need for a separate callback server.
- Fernet keys are URL-safe base64 — they look like random strings but are exactly 32 bytes decoded (256 bits). Generate with `Fernet.generate_key()`.
- MCP server subprocess spawning is fast (~100ms) but adds up with 3 servers. Phase 7's LangGraph will use long-lived sessions.

## Compose workflow: the "glue" is the LLM
The agent naturally chains tools when prompted:
> "Generate a PDF of overdue invoices, save it to Drive under /Reports, and email the link"

1. `generate_report_pdf` → returns signed URL
2. `upload_to_drive(file_url=signed_url, folder_path="/Reports")` → returns Drive link (CONFIRM)
3. `send_email(to=..., body=...drive_link...)` → sends email (CONFIRM)

No explicit "pipeline" code — the LLM decides the tool sequence, the hub routes each call, and the confirmation gate protects destructive steps. This is the power of tool-use agents.
