# Generative AI Companion App for ErpSystem2025 — Learning-First Plan (v2)

## Progress

**Last session:** 2026-04-23 — Phase 3 complete (Chroma in-memory + LangChain utilities, `search_knowledge` tool, `generate_party_summary_pdf` with RAG-grounded narrative, Streamlit re-index button).
**Next up:** Phase 4 — Pipelines + pgvector migration (APScheduler daily re-embed, Supabase `ai_embeddings` table + RLS + ivfflat, swap Chroma → `SupabaseVectorStore`, Excel export tool).

### Phase 0 — Bootstrap ✅ (2026-04-19)
- [x] uv installed (0.8.17)
- [x] apps/ai/ skeleton tree
- [x] pyproject.toml + 84 deps synced
- [x] .env / .env.example / .gitignore / README.md
- [x] hello_llm.py runs — Gemini smoke test ✓
- [x] Learning note `docs/learning-notes/00-uv-python-setup.md`
- **Notes:** leaked key auto-revoked by Google (rotated); `gemini-2.0-flash-exp` retired; `gemini-2.0-flash` has no free-tier quota on new projects; settled on **`gemini-2.5-flash-lite`** as the working free-tier default.

### Phase 1 — Chat UI + multi-provider LLM ✅ (2026-04-21)
- [x] `src/config.py` (pydantic-settings — typed env loader)
- [x] `src/llm/provider.py` (LiteLLM wrapper, provider switch)
- [x] `app.py` (Streamlit chat, conversation history in `st.session_state`)
- [x] Provider dropdown (Gemini / Claude / OpenAI — show only those with keys set)
- [x] Token-by-token streaming via `st.write_stream`
- [x] Learning note `01-llm-basics.md`
- **Notes:** `stream_chat` guards on `if delta:` to skip Anthropic/OpenAI empty role/stop chunks; `settings.configured_providers()` drives the dropdown so unset keys never appear. Smoke-tested end-to-end with Gemini (`Hello there, friend.`).

### Phase 2 — Tool use + first doc generation ✅ (2026-04-22)
- [x] `src/erp_client.py` (async httpx + JWT injection)
- [x] Supabase sign-in flow in Streamlit → JWT in session
- [x] 5 ERP tools: `list_parties`, `get_party`, `list_invoices`, `get_invoice`, `create_invoice`
- [x] Handwritten agent loop `src/agent/loop.py` (~60 LOC, no framework)
- [x] `--dry-run` guardrail mode
- [x] `generate_report_pdf` tool (WeasyPrint + Jinja2, Supabase-signed URL)
- [x] Learning note `02-tool-use-handwritten-loop.md`
- **Notes:** Tool registry in `src/tools/registry.py` unions ERP + docs tools; Pydantic `model_json_schema()` drives the OpenAI tool schema (single source of truth, also validates dispatched args). `ToolContext` dataclass threads the ERP client + Supabase client + dry-run flag through every handler — no globals. WeasyPrint import is lazy inside `_render_pdf` because on Windows it needs GTK runtime; rest of app still imports without it. PDF sink falls back to local `file://` URI when Supabase Storage isn't configured or the upload fails.

### Phase 3 — RAG with Chroma in-memory + LangChain ✅ (2026-04-23)
- [x] Add deps: `chromadb langchain langchain-community langchain-google-genai langchain-chroma`
- [x] `src/rag/ingest.py` (pull invoices/parties → embed via `text-embedding-004`)
- [x] `src/rag/retrieve.py` (Chroma retriever + metadata-scoped `search_by_party`)
- [x] `search_knowledge` tool
- [x] `generate_party_summary_pdf` (RAG-powered narrative, inner LLM call via provider abstraction)
- [x] Learning note `03-rag-chroma-langchain.md`
- **Notes:** LangChain 1.x split Chroma into its own `langchain-chroma` package — added it alongside `langchain-community`. In-memory `Chroma(...)` with no `persist_directory`; `reset_store()` drops the collection so every re-ingest is a full refresh (idempotent upsert deferred to Phase 4). `ToolContext` extended with `provider`/`model` so tools that need their own LLM call (narrative synthesis) use the user's chosen backend. Metadata filtering on `party_id` is what makes the narrative trustworthy — semantic search alone pulls in other parties. Streamlit sidebar gets a "Re-index ERP" button + chunk-count status line.

### Phase 4 — Pipelines + pgvector migration
- [ ] `src/pipelines/scheduler.py` — APScheduler (daily re-embed, hourly balance snapshot)
- [ ] Supabase migration: `CREATE EXTENSION vector` + `ai_embeddings` table + RLS + ivfflat index
- [ ] Swap vector store: Chroma → `SupabaseVectorStore` (same retriever interface)
- [ ] Backfill + parity test
- [ ] Excel export tool (openpyxl + matplotlib chart embed)
- [ ] Learning note `04-pipelines-pgvector-migration.md`

### Phase 5 — MCP fundamentals: build your own server
- [ ] Install official `mcp` Python SDK
- [ ] `src/mcp_server/erp_tools.py` (stdio transport exposes Phase 2 tools)
- [ ] Refactor agent into MCP client of its own server (clean boundary)
- [ ] Register in Claude Desktop config + verify external call works
- [ ] Learning note `05-mcp-build-server.md`

### Phase 6 — External MCP integrations
- [ ] Gmail MCP server wired (per-user OAuth, attachment send)
- [ ] Drive MCP server wired (upload + folder listing)
- [ ] Calendar MCP server wired (event create + list)
- [ ] `ai_connected_services` table with `pgcrypto` token vault
- [ ] Custom `src/mcp_server/whatsapp.py` (Meta Graph API, system-user token)
- [ ] Destructive-action confirmation gate in Streamlit
- [ ] Compose demo: `generate_pdf → upload_to_drive → send_gmail_link`
- [ ] Learning note `06-mcp-consume-servers.md`

### Phase 7 — Graduate to LangGraph + real agent behaviour
- [ ] Add `langgraph` + `langsmith` deps
- [ ] `src/agent/graph.py` — state machine, keep old `loop.py` for comparison
- [ ] Planner/executor split
- [ ] Checkpointer (SQLite → Postgres later)
- [ ] Human-in-the-loop gate on destructive tools
- [ ] `ai_user_memory` table + long-term memory retrieval
- [ ] `tests/evals/` — 20 scripted prompts, pytest, LangSmith tracing
- [ ] Learning note `07-langgraph-real-agents.md`

### How to use this tracker
- At the end of each working session, I tick off what got done, update **Last session** and **Next up**, and commit.
- At the start of the next session, read **Last session** + **Next up** + current phase's checklist; pick up from the first unticked box.
- Phase is "complete" only when every box is ticked **and** the Verification row for that phase in the table below passes.

---

## Context

You want to build a **separate Python application** that sits alongside the existing ERP monorepo and leverages its API + Supabase database. The app itself is a vehicle for a bigger goal: **learning generative AI hands-on**. You're new to Python (coming from other languages), and this is your first gen-AI project.

The app must be far more than a chatbot. It needs to:
- Perform real actions against the ERP (list parties, create invoices, query reports) via tool-calling
- **Generate documents on demand** during a conversation — ad-hoc analytical PDFs and Excel reports
- **Connect to external services** (Gmail, Google Drive, Calendar, WhatsApp Business) so the agent can email, archive, schedule, and notify
- Reason in multi-step workflows that chain all of the above

While you do this you will practice, in order: **Python fundamentals → LLM basics → multi-provider abstraction → tool use → RAG → vector stores → pipelines → MCP (both building and consuming) → framework graduation (LangChain → LangGraph) → OAuth basics → document rendering → external-app integrations → real agent behaviour**.

**Why a companion app (not inside `apps/web`):**
- Isolation — break it freely, never touch ERP code
- Language fit — Python owns the AI ecosystem (best SDKs, best RAG, best MCP, best notebooks)
- Real integration practice — calling the ERP via its real API + JWT is the same pattern you'll use for every external system you ever build against
- Portfolio value — a standalone AI service is more demonstrable than a widget buried in an ERP

**Intended outcome after ~8–10 weeks:** a working `apps/ai/` service where you can say
> *"Pull overdue invoices for ACME Corp this quarter, render a PDF summary, save it to our Drive, and email the link to the customer contact."*

…and the agent authenticates, retrieves context via RAG, calls the ERP API, generates the PDF, saves to Drive via an MCP server, sends the email via an MCP server, and reports back — all orchestrated through a LangGraph state machine you wrote yourself and can explain line by line.

---

## Architecture

```
┌──────────────────┐    ┌─────────────────────────────────────────────┐
│  Streamlit UI    │───▶│  apps/ai/  (NEW — Python)                   │
│  chat + actions  │    │  ┌───────────────────────────────────────┐  │
└──────────────────┘    │  │ LLM layer — LiteLLM (multi-provider)  │  │
                        │  │   Gemini / Claude / OpenAI / Ollama   │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ Agent orchestration                   │  │
                        │  │   Ph 2: handwritten loop (~60 LOC)    │  │
                        │  │   Ph 5–6: LangGraph state machine     │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ RAG                                   │  │
                        │  │   Ph 3: Chroma in-memory + LangChain  │  │
                        │  │   Ph 4: migrate to pgvector           │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ Doc generation (WeasyPrint, openpyxl) │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ ERP client (httpx + JWT)              │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ MCP hub                               │  │
                        │  │   Build:  ERP tools MCP server        │  │
                        │  │   Consume: Gmail / Drive / Calendar   │  │
                        │  │   Custom: WhatsApp MCP wrapper        │  │
                        │  ├───────────────────────────────────────┤  │
                        │  │ Pipelines (APScheduler)               │  │
                        │  └───────────────────────────────────────┘  │
                        └───────┬────────────────┬──────────────┬─────┘
                                │                │              │
                                ▼                ▼              ▼
                  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐
                  │ apps/api existing │  │ Supabase       │  │ External MCPs   │
                  │ Express /api/v1   │  │ Postgres +     │  │ Gmail / Drive / │
                  │                   │  │ pgvector (Ph4) │  │ Calendar / WA   │
                  └──────────────────┘  └────────────────┘  └─────────────────┘
```

**Key architectural commitments:**

- **Placement:** `apps/ai/` — same monorepo, Python island. pnpm ignores it; `uv` (Astral's fast Python package manager) runs it.
- **ERP auth, two modes:** service-role key for pipelines (backend-to-backend, bypasses RLS); user JWT for chat actions (respects RLS, tenant-scoped).
- **Vector store, two eras:**
  - **Phase 3 — Chroma in-memory.** Zero infra. `pip install chromadb` → 20-line RAG. Low friction, ideal for learning.
  - **Phase 4 — migrate to pgvector in the existing Supabase project.** Do it as a deliberate exercise so you *feel* why persistence, multi-tenancy, and RLS matter.
- **Multi-provider LLM:** **LiteLLM** as a thin router from day 1. Gemini default (your key is already set), Claude and OpenAI configurable via dropdown.
- **Framework progression — earn the framework:**

| Phase    | Agent stack                     | Why |
|----------|---------------------------------|-----|
| 0–2      | Raw LiteLLM + handwritten loop  | Internalize messages, tool schemas, the while-loop. Once. |
| 3        | Raw loop + **LangChain** (RAG utilities only — loaders, splitters, retrievers) | Stop reinventing plumbing; use the proven utility layer |
| 5–6      | Graduate to **LangGraph** + **LangSmith** tracing | Industry-standard agent orchestration, checkpointers, human-in-the-loop, multi-agent routing |

You always know what's under the hood because you wrote it.

---

## Scope — v1 is the Invoices + Parties module

Narrow and ship. Cloning to Inventory / HR / Accounting afterward is mechanical.

**v1 must correctly handle these messages:**
1. *"List top 10 parties by outstanding balance."* → tool call → API → formatted table
2. *"Show me invoice INV-2026-001."* → tool call → API → structured display
3. *"Create a sales invoice for party X with items [...]."* → RAG for item lookup → API POST → confirmation
4. *"Summarize our activity with ACME Corp this quarter."* → RAG → LLM synthesis citing real invoice numbers
5. *"What changed in last week's invoices?"* → pipeline-ingested context → LLM summary
6. *"Generate a PDF report of overdue invoices."* → query → render via WeasyPrint → signed URL
7. *"Email that report to finance@acme.com."* → Gmail MCP server → send with attachment
8. *"Save it to our Drive under /Reports/2026-Q2."* → Drive MCP server → upload + confirm path

---

## Feature cluster — Document generation (ad-hoc only)

**Principle:** do NOT duplicate ERP logic. Official invoice PDFs belong to the ERP API (single source of truth for format). The AI app generates **only what the ERP can't** — analytical summaries, comparison reports, custom dashboards, narrative briefings.

**Tech choices:**
- **WeasyPrint** (HTML + CSS → PDF) — easy learning curve, Arabic/RTL support built in, great for report-style output
- **Jinja2** — templating engine; learn it once, it transfers everywhere (Flask, FastAPI, Ansible, many others)
- **openpyxl** — Excel workbooks with formulas, multi-sheet, styling
- **matplotlib** — charts embedded into PDFs/Excel
- **BytesIO** — in-memory generation, no temp files
- **Supabase Storage bucket** — persist generated files, serve via signed URLs (fits your existing stack, already has auth)

**Where doc gen threads through the roadmap:**
- **Phase 2:** first simple PDF tool — tabular report (WeasyPrint + Jinja2) from live ERP data
- **Phase 3:** RAG-powered narrative PDF — retrieved invoice history rendered as a customer summary
- **Phase 4:** Excel exports with formulas + embedded charts (openpyxl + matplotlib)
- **Phase 6:** docs chained into external actions (generate → upload to Drive → email link)

**Skills you gain across these:** Python binary I/O + streaming, Jinja2 templating, PDF/CSS typography, RTL + i18n for Arabic, chart rendering pipelines, MIME / content-disposition / signed URLs, file-storage architecture decisions.

---

## Feature cluster — External app integrations (MCP-first)

**Your pick: consume existing MCP servers rather than hand-roll SDK integrations.** This gives you breadth + deep MCP practice. The auth story varies per service; you chose **decide-later per-service**, so we wire per-user OAuth where MCP servers require it (Gmail / Drive / Calendar) and a simpler service-account token for WhatsApp Business.

**Services chosen:** Gmail, Google Drive, Google Calendar, WhatsApp Business / SMS.

**Reality check on MCP ecosystem maturity (Q2 2026):**
- Google Workspace (Gmail / Drive / Calendar): **community MCP servers exist** — they handle OAuth, token storage, common operations. You consume them.
- WhatsApp Business: **no mature MCP server available** — you'll write a thin custom MCP wrapper around the Meta Graph API. This becomes a learning bonus (you *build* an MCP server, not just consume one) and contributes to the ecosystem.

**Skills you gain:**
- **MCP client integration** — stdio and HTTP transports, MCP config files, Claude Desktop registration
- **OAuth 2.0 fundamentals** — even when MCP handles it, understanding auth-code flow, refresh tokens, scope design by reading the MCP server's implementation
- **Token vaulting patterns** — per-user encrypted storage in Supabase (learn `pgcrypto`)
- **Building your own MCP server** — stdio transport, tool schemas, resources, prompts (WhatsApp wrapper)
- **Destructive-action guardrails** — sending an email is irreversible; you design confirmation UX
- **Composable tool chains** — `generate_invoice_pdf → upload_to_drive → email_link_to_party` in one agent turn

---

## Roadmap — one phase ≈ one week

Each phase ends with (a) a commit-worthy deliverable, (b) a learning artifact in `apps/ai/docs/learning-notes/NN-topic.md` (short, one page, your words).

### Phase 0 — Bootstrap (Days 1–2)
**Topic: Python project setup**
- Install `uv` (`winget install astral-sh.uv` on Windows, or `pip install uv`)
- `apps/ai/pyproject.toml`, `uv sync` produces `.venv`
- Pre-commit hooks: `ruff` (lint+format) and `mypy` (types) — forces good Python habits early
- `.env` loader via `pydantic-settings` — typed config, not stringly-typed dicts
- First script: `hello_llm.py` — call Gemini via LiteLLM, print response
- **Learning note:** "uv vs pip vs poetry", "pyproject.toml anatomy", "pydantic-settings vs os.environ"

### Phase 1 — Chat UI + multi-provider LLM (Days 3–7)
**Topic: LLM basics, streaming, Python async**
- Streamlit chat app (`apps/ai/app.py`) — ~30 lines, conversation in `st.session_state`
- `src/llm/provider.py` — LiteLLM wrapper; provider switch via dropdown (Gemini / Claude / OpenAI)
- Streaming responses (token-by-token) — teaches Python async generators and `st.write_stream`
- **Deliverable:** chat with 3 providers from one UI, streaming
- **Learning note:** "system prompts", "temperature/top_p", "streaming vs blocking", "provider quirks"

### Phase 2 — Tool use + first doc generation (Week 2)
**Topic: Function calling, API clients, auth, HTML→PDF basics**
- `src/erp_client.py` — `httpx.AsyncClient` around `/api/v1`, JWT injection
- Auth flow: Supabase sign-in from Streamlit → JWT in session → every tool call
- 5 ERP tools, each a typed Python function with a Pydantic schema:
  `list_parties`, `get_party`, `list_invoices`, `get_invoice`, `create_invoice`
- **Handwritten agent loop** (`src/agent/loop.py`, ~60 lines — write it yourself, no framework):
  ```
  while True:
      response = llm.chat(messages, tools=tool_schemas)
      if response.tool_calls:
          for call in response.tool_calls:
              result = dispatch(call)
              messages.append(tool_result_message(call.id, result))
      else:
          return response.content
  ```
- **First doc tool:** `generate_report_pdf(title, rows)` — WeasyPrint + Jinja2 HTML template, returns Supabase-signed URL
- Guardrail: `--dry-run` mode prints the API call instead of executing; use it while iterating
- **Deliverable:** agent lists parties, creates an invoice, generates a tabular PDF
- **Learning note:** "function-calling schemas", "agent loop anatomy", "WeasyPrint + Jinja2", "why not LangChain yet"

### Phase 3 — RAG with Chroma in-memory (Week 3)
**Topic: Embeddings, chunking, retrieval; start using LangChain**
- `pip install chromadb langchain langchain-community langchain-google-genai`
- Use LangChain utilities:
  - **Document Loaders** (JSON loader for ERP data, PDF loader for uploaded docs)
  - **Text Splitters** (`RecursiveCharacterTextSplitter`)
  - **Retrievers** (Chroma `as_retriever`)
- Embedding model: Google `text-embedding-004` (free tier, 768-dim, same API key)
- Ingestion script (`src/rag/ingest.py`): pull invoices + parties for a tenant, build documents, embed, upsert into Chroma
- Add a `search_knowledge(query, k=5)` tool — the agent now consults RAG before qualitative questions
- RAG-powered PDF: `generate_party_summary_pdf(party_id)` — retrieves history, WeasyPrint renders
- **Deliverable:** *"summarize our history with ACME"* cites real invoice numbers from retrieval
- **Learning note:** "embedding vs keyword search", "chunking strategies", "LangChain retriever abstraction", "why start with Chroma not pgvector"

### Phase 4 — Pipelines + pgvector migration (Week 4)
**Topic: Scheduled jobs, idempotency, production vector stores**
- `src/pipelines/scheduler.py` — APScheduler jobs
  - Daily: re-embed updated invoices (track `last_synced_at` per source)
  - Hourly: snapshot outstanding-balance cache per party
- **Migrate Chroma → pgvector** (the deliberate exercise):
  1. `CREATE EXTENSION IF NOT EXISTS vector;` migration
  2. `ai_embeddings(id, tenant_id, source_table, source_id, content, embedding vector(768), metadata jsonb)`
  3. RLS policies matching existing tables (same `tenant_id` pattern)
  4. `CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops);`
  5. Swap LangChain vectorstore from `Chroma` to `SupabaseVectorStore` — same retriever interface
  6. Backfill existing Chroma data; verify retrieval parity with a scripted test
- Excel export tool: `generate_excel_report(query)` — openpyxl + matplotlib chart embed
- Document pipeline (stretch): upload PDF → pypdf extract → chunk → embed → store
- **Deliverable:** RAG fresh automatically, pgvector persistence with RLS, Excel export works
- **Learning note:** "idempotent pipelines", "backfill vs incremental", "why RLS + pgvector is non-trivial", "in-memory vs persistent vector stores"

### Phase 5 — MCP fundamentals: build your own server (Week 5)
**Topic: Model Context Protocol — tools as a portable interface**
- Install official `mcp` Python SDK
- `src/mcp_server/erp_tools.py` — wrap the 5 ERP tools from Phase 2 as an MCP server (stdio transport)
- Refactor: your own agent becomes a **client** of your own MCP server. Enforces a clean boundary — the agent no longer imports tools directly.
- Register the ERP MCP server in Claude Desktop's config. Verify Claude Desktop can call `list_parties` and `get_invoice` without ever running Streamlit. **This is portfolio gold** — a demo that lands.
- **Deliverable:** ERP tools callable from any MCP-compatible client
- **Learning note:** "MCP protocol", "tools vs resources vs prompts", "stdio vs HTTP transport", "Claude Desktop MCP config"

### Phase 6 — Consume external MCP servers: Gmail / Drive / Calendar / WhatsApp (Week 6)
**Topic: OAuth (via MCP), token vaulting, destructive-action guardrails, building an MCP server**
- Wire community MCP servers:
  - **Gmail MCP server** — send email with attachment (for PDF delivery)
  - **Google Drive MCP server** — upload file, list folders
  - **Google Calendar MCP server** — create events, list upcoming
  - Connect flow: Streamlit "Connect Gmail" button → OAuth consent → token stored encrypted in Supabase via `pgcrypto`
- **Build WhatsApp Business MCP wrapper** (`src/mcp_server/whatsapp.py`) — no mature community server exists, so this is your second MCP server-build. Uses Meta Graph API with a system-user access token. Tool: `send_whatsapp(to, template_id, params)`.
- **Agent confirmation gate:** any MCP tool marked `destructive: true` (send email, create calendar event, send WhatsApp) requires a Streamlit confirm-click before execution.
- Compose across MCPs: agent turn example — *"email last month's revenue PDF to finance"* → `generate_revenue_pdf` → `upload_to_drive` → `send_gmail_with_link` — three tools, three servers, one agent turn.
- **Deliverable:** agent sends real emails, saves real files to Drive, sends real WhatsApp messages — with user confirmation on each write
- **Learning note:** "MCP client config", "OAuth scopes by service", "pgcrypto for token vaulting", "WhatsApp Business API auth", "confirmation UX patterns"

### Phase 7 — Graduate to LangGraph + real agent behaviour (Weeks 7–8)
**Topic: State machines, planner/executor, evaluation, observability**
- Install `langgraph` and `langsmith` (LangSmith free tier = excellent tracing)
- **Rewrite the Phase 2 agent loop as a LangGraph state machine**. Keep the old `loop.py` for comparison — you'll *see* what the framework gives and what it costs.
- Introduce:
  - **Planner/executor split** — a small planner LLM decomposes the request; executor runs steps; orchestrator node routes
  - **Checkpointer** — persist state across runs (SQLite locally, or Postgres)
  - **Human-in-the-loop gate** — any destructive tool call pauses the graph, waits for Streamlit approval, resumes
  - **Long-term memory** — `ai_user_memory` table with Supabase, retrieved into system prompt ("user prefers USD, Arabic replies")
- **Evaluation harness** (`tests/evals/`) — 20 scripted prompts with expected tool-call sequences; pytest-based; run nightly; track regressions with LangSmith
- **Deliverable:** *"Reconcile last week's overdue invoices and draft payment reminder emails to each party"* runs end-to-end as a multi-step LangGraph workflow with pause-for-approval gates, full tracing in LangSmith
- **Learning note:** "LangGraph vs raw loop — what the framework actually gives you", "checkpointers", "LangSmith traces", "eval design"

---

## Vibe-coding method — learn while you ship

The trap: you ship working code you can't read a month later because AI wrote it for you. Counter with this **strict per-concept loop**:

1. **15-min primary-source read** — official docs, not blog summaries. (Python docs, LangChain docs, MCP spec, Google API docs.)
2. **30-min solo attempt** — smallest version, no AI. Broken is fine.
3. **Pair with Claude** to refactor and idiomize. **Ask "why" on every suggestion.** Reject anything you can't explain aloud.
4. **Rubber-duck commit message** — must explain *why* the code looks this way in plain English. If you can't write it, you don't understand it.
5. **Learning note** — append 5–10 bullets to `apps/ai/docs/learning-notes/NN-topic.md`. Your future self is the audience.

**Red flags (stop and reset):**
- Claude proposes a 200-line helper on Day 3 → you're being carried. Ask for the 20-line version.
- You accept code importing a package you've never heard of → stop, look it up, then continue.
- Tests pass but you can't explain a failure mode → you lucked into it, not learned it.

**Green flags (you're compounding):**
- You reject a Claude suggestion because you know a simpler way.
- You catch a bug Claude introduced.
- You can predict the next framework's API shape from fundamentals alone.

---

## Critical files / paths to create

```
apps/ai/
├── pyproject.toml              # uv project + deps
├── .env.example                # documents every required var
├── app.py                      # Streamlit entry
├── src/
│   ├── config.py               # pydantic-settings
│   ├── llm/
│   │   └── provider.py         # LiteLLM wrapper
│   ├── erp_client.py           # httpx + JWT
│   ├── tools/                  # one file per tool, Pydantic-schema'd
│   ├── agent/
│   │   ├── loop.py             # handwritten (Phase 2) — keep forever for comparison
│   │   └── graph.py            # LangGraph state machine (Phase 7)
│   ├── rag/
│   │   ├── ingest.py
│   │   ├── retrieve.py
│   │   └── stores.py           # Chroma adapter (Ph 3) + pgvector adapter (Ph 4)
│   ├── docs/
│   │   ├── pdf.py              # WeasyPrint + Jinja2
│   │   ├── excel.py            # openpyxl + matplotlib
│   │   └── templates/          # Jinja2 HTML + .xlsx templates
│   ├── pipelines/
│   │   └── scheduler.py        # APScheduler jobs
│   ├── mcp_server/
│   │   ├── erp_tools.py        # Ph 5 — ERP tools as MCP server
│   │   └── whatsapp.py         # Ph 6 — WhatsApp MCP wrapper
│   ├── mcp_clients/
│   │   └── config.py           # Gmail / Drive / Calendar MCP server config
│   └── memory/
│       └── user_memory.py      # Ph 7 — long-term memory via Supabase
├── docs/
│   └── learning-notes/         # 1-page notes per topic
│       ├── 00-uv-python-setup.md
│       ├── 01-llm-basics.md
│       ├── 02-tool-use-handwritten-loop.md
│       ├── 03-rag-chroma-langchain.md
│       ├── 04-pipelines-pgvector-migration.md
│       ├── 05-mcp-build-server.md
│       ├── 06-mcp-consume-servers.md
│       └── 07-langgraph-real-agents.md
└── tests/
    ├── test_erp_client.py
    ├── test_agent_loop.py
    ├── test_rag.py
    └── evals/                  # Ph 7 — 20 scripted prompts with expected tool calls
```

**Existing files referenced (read-only from the AI app):**
- `apps/api/src/middleware/auth.ts` — understand JWT claims shape
- `apps/api/src/routes/index.ts` — canonical endpoint list
- `packages/database/src/types/database.types.ts` — schema reference

**Supabase migrations the plan adds (via existing migration workflow):**
- Phase 4: `CREATE EXTENSION vector;` + `ai_embeddings` table + RLS + ivfflat index
- Phase 6: `ai_connected_services(user_id, service, encrypted_tokens, scopes, connected_at)` with `pgcrypto`
- Phase 7: `ai_user_memory(user_id, key, value, updated_at)` + RLS

---

## First step (start today)

1. Install `uv` (`winget install astral-sh.uv` on Windows)
2. `mkdir apps/ai && cd apps/ai && uv init`
3. `uv add litellm streamlit pydantic-settings python-dotenv`
4. Copy `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_*` from root `.env` into `apps/ai/.env`
5. Write `hello_llm.py`: ~10 lines calling Gemini via LiteLLM, print the reply
6. Run it. Commit. That's Phase 0 half done.

---

## Verification — how to know each phase actually works

| Phase | Test | Pass criteria |
|-------|------|---------------|
| 0 | `uv run python hello_llm.py` | Prints coherent Gemini reply |
| 1 | `uv run streamlit run app.py` | Chat works for all 3 providers, streams tokens |
| 2 | *"list parties"* in chat | ERP API hit, real data displayed; `generate_report_pdf` returns signed URL |
| 3 | *"summarize history with ACME"* | Response cites specific invoice numbers from Chroma retrieval |
| 4 | `uv run python -m pipelines.scheduler` for 5 min, then query same prompt | Fresh data retrieved from **pgvector**; 2nd pipeline run is idempotent (log shows skips) |
| 5 | Configure ERP MCP server in Claude Desktop, restart, ask *"list parties"* there | Works end-to-end outside your app |
| 6 | *"email last month's revenue PDF to finance@acme.com and save it to Drive"* | Real email sent (confirmation click required); file appears in Drive; WhatsApp sends on separate prompt |
| 7 | `uv run pytest tests/evals/` | ≥18/20 scripted prompts pass; LangSmith shows full multi-step traces |

---

## Open decisions (fine to defer, logged here)

- **Deployment** — local-only during learning. When ready: Fly.io or Railway for cheap Python + Streamlit.
- **Observability** — LangSmith from Phase 7; skip in earlier phases (too much infra, not enough traces to matter).
- **Vector DB alternative** — stick with Chroma → pgvector. A Qdrant sidebar experiment after Phase 7 is nice to have, not must have.
- **Existing web app integration** — defer. The FastAPI `/chat` endpoint comes for free when you decide to embed.
- **OAuth auth model per service** — resolved per-MCP-server at integration time; Gmail/Drive/Calendar inherit community MCP server's per-user model; WhatsApp uses a tenant-wide system-user token.
