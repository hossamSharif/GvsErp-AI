"""Streamlit chat shell — wires the handwritten agent loop into a UI.

Run:
    uv run streamlit run app.py

Highlights by phase:
- Ph 2: Supabase sign-in → JWT, agent loop with ERP tools + PDF tool, dry-run toggle.
- Ph 3: RAG sidebar (Re-index button), chunk count, search_knowledge / party-summary tools.
- Ph 4: backend label (chroma | pgvector), tenant_id surfaced from user_metadata,
  shared supabase client used for both chat-tool dispatch and pgvector ingest;
  ingest report shows inserted/updated/skipped/deleted when on pgvector.
- Ph 5: MCP toggle — route ERP tools through stdio MCP server or in-process.
- Ph 6: Connected Services (Google OAuth + WhatsApp), multi-MCP hub, destructive-
  action confirmation gate, compose demo (PDF → Drive → Email).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import streamlit as st

try:
    from supabase import create_client
except ImportError:  # pragma: no cover - defensive, deps already declared
    create_client = None  # type: ignore[assignment]

from src.agent.graph import confirmation_key, run_graph
from src.agent.loop import AgentRun, PendingConfirmation, run_agent
from src.agent.mcp_hub import McpHub, build_mcp_configs
from src.config import DEFAULT_MODELS, settings
from src.erp_client import ErpClient
from src.memory.user_memory import delete_memory, list_memory, save_memory
from src.rag.ingest import ingest_all
from src.rag.store import backend_label, collection_size
from src.tools.context import ToolContext

# Phase 7: LangSmith picks these up by name — exporting them here means the
# user only has to fill .env, no extra wiring at the call sites.
import os as _os
if settings.langsmith_api_key:
    _os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key)
if settings.langsmith_tracing:
    _os.environ.setdefault("LANGSMITH_TRACING", "true")
if settings.langsmith_project:
    _os.environ.setdefault("LANGSMITH_PROJECT", settings.langsmith_project)

st.set_page_config(page_title="ERP AI Companion", page_icon="🤖", layout="wide")
st.title("ERP AI Companion — Phase 7")

configured = settings.configured_providers()
if not configured:
    st.error("No LLM provider configured. Set at least one *_API_KEY in apps/ai/.env.")
    st.stop()


# ── sidebar ────────────────────────────────────────────────────────────

with st.sidebar:
    st.header("LLM")
    default_index = (
        configured.index(settings.ai_default_provider)
        if settings.ai_default_provider in configured
        else 0
    )
    provider = st.selectbox("Provider", configured, index=default_index)
    model = st.text_input("Model", value=DEFAULT_MODELS[provider])

    st.divider()
    st.header("ERP session")

    if "jwt" not in st.session_state:
        st.session_state.jwt = ""
        st.session_state.user_email = ""
        st.session_state.user_id = ""
        st.session_state.tenant_id = ""

    if not st.session_state.jwt:
        with st.form("signin"):
            email = st.text_input("Email")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Sign in")
        if submitted:
            if not (settings.supabase_url and settings.supabase_anon_key):
                st.error("Supabase URL / anon key missing in apps/ai/.env.")
            elif create_client is None:
                st.error("supabase-py not installed.")
            else:
                try:
                    sb = create_client(settings.supabase_url, settings.supabase_anon_key)
                    res = sb.auth.sign_in_with_password({"email": email, "password": password})
                    if res.session is None:
                        st.error("No session returned — check credentials.")
                    else:
                        st.session_state.jwt = res.session.access_token
                        st.session_state.user_email = email
                        st.session_state.user_id = str(res.user.id) if res.user else ""
                        meta = (res.user.user_metadata or {}) if res.user else {}
                        st.session_state.tenant_id = str(meta.get("tenant_id") or "")
                        st.rerun()
                except Exception as e:
                    st.error(f"Sign-in failed: {e}")
    else:
        st.success(f"Signed in as {st.session_state.user_email}")
        if st.session_state.tenant_id:
            st.caption(f"Tenant: {st.session_state.tenant_id[:8]}…")
        if st.button("Sign out"):
            st.session_state.jwt = ""
            st.session_state.user_email = ""
            st.session_state.user_id = ""
            st.session_state.tenant_id = ""
            st.session_state.messages = []
            st.session_state.pop("google_tokens", None)
            st.session_state.pop("connected_services", None)
            st.rerun()

    st.divider()
    dry_run = st.toggle(
        "Dry run (mutations echoed, not executed)",
        value=st.session_state.get("dry_run", True),
        help="When on, create_invoice etc. return the intended payload instead of hitting the API.",
    )
    st.session_state.dry_run = dry_run

    use_mcp = st.toggle(
        "Route tools through MCP servers",
        value=st.session_state.get("use_mcp", True),
        help=(
            "When on, ERP + external tools are dispatched over MCP (stdio). "
            "Off = in-process dispatch (Phase 2 path). Docs + RAG tools are local either way."
        ),
    )
    st.session_state.use_mcp = use_mcp

    # Phase 7: handwritten loop vs LangGraph state machine.  Same surface
    # contract — the only diff the user feels is an extra planner step
    # (and richer LangSmith traces).
    _engine_default = (
        "graph" if settings.agent_engine == "graph" else "loop"
    )
    if "agent_engine" not in st.session_state:
        st.session_state.agent_engine = _engine_default
    agent_engine = st.radio(
        "Agent engine",
        ["loop", "graph"],
        index=["loop", "graph"].index(st.session_state.agent_engine),
        format_func=lambda v: (
            "Handwritten loop (Ph 2)" if v == "loop" else "LangGraph state machine (Ph 7)"
        ),
        help=(
            "loop  = ~80-line while-loop, fast, no checkpointer.\n"
            "graph = planner/executor split, MemorySaver checkpoint, "
            "long-term memory injection, LangSmith tracing."
        ),
    )
    st.session_state.agent_engine = agent_engine

    # ── Connected Services (Phase 6) ─────────────────────────────────

    st.divider()
    st.header("Connected Services")

    # Build supabase client for sidebar operations (token store, RAG, etc.)
    sb_client = None
    if (
        st.session_state.jwt
        and settings.supabase_url
        and settings.supabase_anon_key
        and create_client is not None
    ):
        sb_client = create_client(settings.supabase_url, settings.supabase_anon_key)
        sb_client.postgrest.auth(st.session_state.jwt)

    # -- Google OAuth flow -----------------------------------------------
    _google_configured = bool(
        settings.google_oauth_client_id and settings.google_oauth_client_secret
    )
    _google_connected = "google_tokens" in st.session_state and st.session_state.google_tokens

    if _google_configured:
        if _google_connected:
            st.success("Google (Gmail / Drive / Calendar) connected")
            if st.button("Disconnect Google"):
                if sb_client and st.session_state.user_id:
                    try:
                        from src.mcp_clients.token_store import delete_tokens

                        for svc in ("gmail", "drive", "calendar"):
                            delete_tokens(sb_client, st.session_state.user_id, svc)
                    except Exception:
                        pass
                st.session_state.pop("google_tokens", None)
                st.rerun()
        else:
            # Check if we have a code in query params (OAuth callback)
            code = st.query_params.get("code")
            if code:
                try:
                    from src.mcp_clients.google_oauth import exchange_code
                    from src.mcp_clients.token_store import save_tokens

                    tokens = exchange_code(code)
                    st.session_state.google_tokens = tokens
                    # Persist encrypted tokens
                    if sb_client and st.session_state.user_id and settings.token_encryption_key:
                        for svc in ("gmail", "drive", "calendar"):
                            save_tokens(
                                sb_client,
                                st.session_state.user_id,
                                st.session_state.tenant_id,
                                svc,
                                tokens,
                                scopes=tokens.get("scopes", []),
                            )
                    st.query_params.clear()
                    st.rerun()
                except Exception as e:
                    st.error(f"OAuth exchange failed: {e}")
                    st.query_params.clear()
            else:
                # Try loading from DB on first load
                if (
                    sb_client
                    and st.session_state.user_id
                    and settings.token_encryption_key
                ):
                    try:
                        from src.mcp_clients.token_store import load_tokens

                        stored = load_tokens(sb_client, st.session_state.user_id, "gmail")
                        if stored:
                            from src.mcp_clients.google_oauth import refresh_if_needed

                            st.session_state.google_tokens = refresh_if_needed(stored)
                            st.rerun()
                    except Exception:
                        pass

                # Show connect button
                try:
                    from src.mcp_clients.google_oauth import build_auth_url

                    auth_url = build_auth_url()
                    st.link_button("Connect Google", auth_url)
                except Exception as e:
                    st.warning(f"Cannot build OAuth URL: {e}")
    else:
        st.caption("Google: not configured (set GOOGLE_OAUTH_CLIENT_ID/SECRET)")

    # -- WhatsApp status -------------------------------------------------
    _whatsapp_ok = bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id)
    if _whatsapp_ok:
        st.success("WhatsApp Business connected")
    else:
        st.caption("WhatsApp: not configured (set WHATSAPP_ACCESS_TOKEN)")

    # ── Long-term memory (Phase 7) ───────────────────────────────────

    st.divider()
    st.header("Long-term memory")
    if st.session_state.jwt and sb_client and st.session_state.user_id:
        try:
            facts = list_memory(sb_client, st.session_state.user_id)
        except Exception as e:
            facts = []
            st.caption(f"(memory disabled: {e})")
        if facts:
            for f in facts:
                col_k, col_v, col_x = st.columns([2, 4, 1])
                col_k.caption(f["key"])
                col_v.caption(f.get("value", ""))
                if col_x.button("✕", key=f"del_mem_{f['key']}", help="Forget this fact"):
                    delete_memory(sb_client, st.session_state.user_id, f["key"])
                    st.rerun()
        else:
            st.caption("No facts stored yet.")

        with st.expander("Add a fact"):
            with st.form("add_memory"):
                mk = st.text_input("Key", placeholder="preferred_currency")
                mv = st.text_input("Value", placeholder="USD")
                if st.form_submit_button("Save") and mk and mv:
                    if not st.session_state.tenant_id:
                        st.error("tenant_id missing — re-sign-in.")
                    else:
                        try:
                            save_memory(
                                sb_client,
                                st.session_state.user_id,
                                st.session_state.tenant_id,
                                mk.strip(),
                                mv.strip(),
                            )
                            st.rerun()
                        except Exception as e:
                            st.error(f"Save failed: {e}")
    else:
        st.caption("Sign in to manage long-term memory.")

    # ── RAG index ─────────────────────────────────────────────────────

    st.divider()
    st.header("RAG index")
    st.caption(f"Backend: `{backend_label()}`")
    st.caption(f"Indexed chunks: {collection_size(sb_client)}")
    if st.session_state.jwt and st.button("Re-index ERP"):
        if settings.rag_backend == "pgvector" and not st.session_state.tenant_id:
            st.error(
                "tenant_id missing from your user_metadata — re-sign-in or check signup."
            )
        else:
            with st.spinner("Pulling ERP data + embedding..."):

                async def _ingest() -> Any:
                    async with ErpClient(jwt=st.session_state.jwt) as erp:
                        return await ingest_all(
                            erp,
                            supabase=sb_client,
                            tenant_id=st.session_state.tenant_id or None,
                        )

                try:
                    report = asyncio.run(_ingest())
                    summary = (
                        f"Indexed {report.parties} parties + {report.invoices} invoices "
                        f"→ {report.chunks_embedded} chunks."
                    )
                    if settings.rag_backend == "pgvector":
                        summary += (
                            f" (inserted {report.inserted}, updated {report.updated}, "
                            f"skipped {report.skipped}, deleted {report.deleted})"
                        )
                    st.success(summary)
                    if report.errors:
                        for err in report.errors:
                            st.warning(err)
                except Exception as e:
                    st.error(f"Ingest failed: {e}")

    if st.button("Clear chat"):
        st.session_state.messages = []
        st.session_state.pop("pending_confirmation", None)
        st.rerun()


# ── state ──────────────────────────────────────────────────────────────

if "messages" not in st.session_state:
    st.session_state.messages = []  # display-only history

if not st.session_state.jwt:
    st.info("Sign in from the sidebar to start talking to the ERP.")
    st.stop()


# ── render prior chat ─────────────────────────────────────────────────

def _render_step(step_kind: str, payload: dict[str, Any]) -> None:
    if step_kind == "tool_call":
        with st.expander(f"🔧 {payload['name']}", expanded=False):
            st.code(json.dumps(payload.get("arguments", {}), indent=2), language="json")
    elif step_kind == "tool_result":
        with st.expander(f"↩ {payload['name']} result", expanded=False):
            st.code(
                json.dumps(payload.get("result", {}), indent=2, default=str)[:4000],
                language="json",
            )
    elif step_kind == "pending_confirmation":
        st.warning(f"⏳ Awaiting confirmation: **{payload.get('name', '')}**")
    elif step_kind == "plan":
        with st.expander("📋 Plan", expanded=False):
            st.markdown(payload.get("content") or "(empty)")
    elif step_kind == "memory_loaded":
        st.caption(f"🧠 {payload.get('content', '')}")


for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        for step in msg.get("steps", []):
            _render_step(step["kind"], step)
        if msg.get("content"):
            st.markdown(msg["content"])


# ── confirmation UI ──────────────────────────────────────────────────

if "pending_confirmation" in st.session_state and st.session_state.pending_confirmation:
    pc: PendingConfirmation = st.session_state.pending_confirmation
    st.warning(f"**{pc.tool_name}** wants to execute a destructive action:")
    with st.expander("Action details", expanded=True):
        st.code(json.dumps(pc.arguments, indent=2, default=str), language="json")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Confirm", type="primary", use_container_width=True):
            # Re-run the agent with this call pre-confirmed.  We save BOTH
            # the LLM-issued call_id (legacy) AND a stable args-hash key
            # (Phase 7 — the LLM regenerates call_ids on every request, so
            # call_id alone wouldn't survive the re-run).
            confirmed = st.session_state.get("confirmed_calls", set())
            confirmed.add(pc.call_id)
            confirmed.add(confirmation_key(pc.tool_name, pc.arguments))
            st.session_state.confirmed_calls = confirmed
            st.session_state.pop("pending_confirmation", None)
            # Re-run with the original prompt
            st.session_state.rerun_prompt = st.session_state.get("last_prompt", "")
            st.rerun()
    with col2:
        if st.button("Cancel", use_container_width=True):
            st.session_state.pop("pending_confirmation", None)
            # Add a cancellation message
            st.session_state.messages.append(
                {
                    "role": "assistant",
                    "content": f"Action **{pc.tool_name}** was cancelled by the user.",
                    "steps": [],
                }
            )
            st.rerun()

    st.stop()  # Don't render chat input while confirmation is pending


# ── new turn ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are an AI companion embedded in an ERP system. "
    "You have tools to list parties, fetch invoices, create draft invoices, "
    "search the indexed knowledge base (RAG), and generate ad-hoc PDF/Excel reports. "
    "When the user asks about data, call the tool first — do not hallucinate. "
    "For qualitative questions ('summarize', 'explain our history with X', 'patterns'), "
    "call search_knowledge FIRST and cite the invoice numbers you retrieve. "
    "If search_knowledge returns zero results, tell the user to click 'Re-index ERP' "
    "in the sidebar.\n\n"
    "You also have tools for external services (when connected):\n"
    "- Gmail: send_email, list_emails\n"
    "- Google Drive: upload_to_drive, list_drive_files\n"
    "- Google Calendar: create_calendar_event, list_calendar_events\n"
    "- WhatsApp: send_whatsapp, list_whatsapp_templates\n\n"
    "IMPORTANT: Tools that send emails, upload files, create events, or send messages "
    "are destructive. The system will ask the user to confirm before executing them. "
    "When you plan to use a destructive tool, explain to the user WHAT you are about "
    "to do BEFORE calling the tool, so they know what they're confirming.\n\n"
    "For compose workflows (e.g. 'generate PDF, save to Drive, email the link'), "
    "chain the tools in sequence — generate first, then upload, then email. Each "
    "destructive step will be confirmed independently.\n\n"
    "Be concise in the final answer: a short summary + a markdown table when tabular."
)


def _agent_history_for(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replay previous visible turns as plain user/assistant messages."""
    out: list[dict[str, Any]] = []
    for m in messages:
        if m["role"] in {"user", "assistant"} and m.get("content"):
            out.append({"role": m["role"], "content": m["content"]})
    return out


async def _run_once(user_prompt: str, confirmed_calls: set[str] | None = None) -> AgentRun:
    async with ErpClient(jwt=st.session_state.jwt, dry_run=st.session_state.dry_run) as erp:
        supabase = sb_client
        ctx = ToolContext(
            erp=erp,
            supabase=supabase,
            dry_run=st.session_state.dry_run,
            provider=provider,
            model=model,
        )
        engine = st.session_state.get("agent_engine", "loop")
        kwargs: dict[str, Any] = dict(
            provider=provider,
            model=model,
            system_prompt=SYSTEM_PROMPT,
            ctx=ctx,
            history=_agent_history_for(st.session_state.messages),
            confirmed_calls=confirmed_calls,
        )
        if engine == "graph":
            # Stable thread_id across reruns of this Streamlit session so the
            # checkpointer can resume rather than start fresh each time.
            thread_id = st.session_state.setdefault(
                "graph_thread_id", f"thread-{id(st.session_state)}"
            )
            kwargs.update(user_id=st.session_state.user_id, thread_id=thread_id)
            runner = run_graph
        else:
            runner = run_agent

        if st.session_state.get("use_mcp", True):
            google_tokens = st.session_state.get("google_tokens")
            configs = build_mcp_configs(
                jwt=st.session_state.jwt,
                dry_run=st.session_state.dry_run,
                google_tokens=google_tokens,
                whatsapp_enabled=_whatsapp_ok,
            )
            async with McpHub(configs) as hub:
                return await runner(user_prompt, **kwargs, mcp_hub=hub)
        return await runner(user_prompt, **kwargs)


def _handle_agent_run(prompt: str, run: AgentRun) -> None:
    """Process the agent run — render steps, handle confirmations."""
    assistant_steps: list[dict[str, Any]] = []
    for s in run.steps:
        if s.kind == "tool_call":
            payload = {"kind": "tool_call", "name": s.name, "arguments": s.arguments or {}}
            assistant_steps.append(payload)
            _render_step("tool_call", payload)
        elif s.kind == "tool_result":
            payload = {"kind": "tool_result", "name": s.name, "result": s.result or {}}
            assistant_steps.append(payload)
            _render_step("tool_result", payload)
        elif s.kind == "pending_confirmation":
            payload = {"kind": "pending_confirmation", "name": s.name}
            assistant_steps.append(payload)
        elif s.kind == "plan":
            payload = {"kind": "plan", "name": s.name, "content": s.content or ""}
            assistant_steps.append(payload)
            _render_step("plan", payload)
        elif s.kind == "memory_loaded":
            payload = {"kind": "memory_loaded", "name": s.name, "content": s.content or ""}
            assistant_steps.append(payload)
            _render_step("memory_loaded", payload)

    if run.pending_confirmation:
        st.session_state.pending_confirmation = run.pending_confirmation
        st.session_state.last_prompt = prompt
        # Save partial steps so far
        st.session_state.messages.append(
            {"role": "assistant", "content": "", "steps": assistant_steps}
        )
        st.rerun()

    st.markdown(run.final_text)
    st.session_state.messages.append(
        {"role": "assistant", "content": run.final_text, "steps": assistant_steps}
    )


# Handle re-run after confirmation
rerun_prompt = st.session_state.pop("rerun_prompt", None)
if rerun_prompt:
    with st.chat_message("assistant"):
        with st.spinner("Executing confirmed action..."):
            confirmed = st.session_state.pop("confirmed_calls", set())
            run = asyncio.run(_run_once(rerun_prompt, confirmed_calls=confirmed))
        _handle_agent_run(rerun_prompt, run)

# Normal chat input
elif prompt := st.chat_input("Ask about parties, invoices, or request a PDF report..."):
    st.session_state.messages.append({"role": "user", "content": prompt, "steps": []})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            run = asyncio.run(_run_once(prompt))
        _handle_agent_run(prompt, run)
