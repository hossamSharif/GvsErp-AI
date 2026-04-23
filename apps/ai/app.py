"""Phase 2 — Streamlit chat with tool-calling, auth, and doc generation.

Run:
    uv run streamlit run app.py

What's new vs Phase 1:
- Supabase email/password sign-in → JWT lives in session state.
- The chat calls a handwritten agent loop (src/agent/loop.py) that can dispatch
  ERP tools + a PDF-report tool.
- Dry-run toggle: mutating ERP calls are echoed instead of executed.
- Every tool call is rendered in the chat so the learner can see what the
  agent decided to do.
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

from src.agent.loop import AgentRun, run_agent
from src.config import DEFAULT_MODELS, settings
from src.erp_client import ErpClient
from src.rag.ingest import ingest_all
from src.rag.store import collection_size
from src.tools.context import ToolContext

st.set_page_config(page_title="ERP AI Companion", page_icon="🤖", layout="wide")
st.title("ERP AI Companion — Phase 3")

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
                        st.rerun()
                except Exception as e:  # supabase raises on bad creds
                    st.error(f"Sign-in failed: {e}")
    else:
        st.success(f"Signed in as {st.session_state.user_email}")
        if st.button("Sign out"):
            st.session_state.jwt = ""
            st.session_state.user_email = ""
            st.session_state.messages = []
            st.rerun()

    st.divider()
    dry_run = st.toggle(
        "Dry run (mutations echoed, not executed)",
        value=st.session_state.get("dry_run", True),
        help="When on, create_invoice etc. return the intended payload instead of hitting the API.",
    )
    st.session_state.dry_run = dry_run

    st.divider()
    st.header("RAG index")
    st.caption(f"Indexed chunks: {collection_size()}")
    if st.session_state.jwt and st.button("Re-index ERP"):
        with st.spinner("Pulling ERP data + embedding..."):
            async def _ingest() -> Any:
                async with ErpClient(jwt=st.session_state.jwt) as erp:
                    return await ingest_all(erp)

            try:
                report = asyncio.run(_ingest())
                st.success(
                    f"Indexed {report.parties} parties + {report.invoices} invoices "
                    f"→ {report.chunks_embedded} chunks."
                )
            except Exception as e:
                st.error(f"Ingest failed: {e}")

    if st.button("Clear chat"):
        st.session_state.messages = []
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


for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        for step in msg.get("steps", []):
            _render_step(step["kind"], step)
        if msg.get("content"):
            st.markdown(msg["content"])


# ── new turn ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are an AI companion embedded in an ERP system. "
    "You have tools to list parties, fetch invoices, create draft invoices, "
    "search the indexed knowledge base (RAG), and generate ad-hoc PDF reports. "
    "When the user asks about data, call the tool first — do not hallucinate. "
    "For qualitative questions ('summarize', 'explain our history with X', 'patterns'), "
    "call search_knowledge FIRST and cite the invoice numbers you retrieve. "
    "If search_knowledge returns zero results, tell the user to click 'Re-index ERP' "
    "in the sidebar. "
    "Be concise in the final answer: a short summary + a markdown table when tabular."
)


def _agent_history_for(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replay previous visible turns as plain user/assistant messages."""
    out: list[dict[str, Any]] = []
    for m in messages:
        if m["role"] in {"user", "assistant"} and m.get("content"):
            out.append({"role": m["role"], "content": m["content"]})
    return out


async def _run_once(user_prompt: str) -> AgentRun:
    async with ErpClient(jwt=st.session_state.jwt, dry_run=st.session_state.dry_run) as erp:
        supabase = None
        if settings.supabase_url and settings.supabase_anon_key and create_client is not None:
            supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
            supabase.postgrest.auth(st.session_state.jwt)
        ctx = ToolContext(
            erp=erp,
            supabase=supabase,
            dry_run=st.session_state.dry_run,
            provider=provider,
            model=model,
        )
        return await run_agent(
            user_prompt,
            provider=provider,
            model=model,
            system_prompt=SYSTEM_PROMPT,
            ctx=ctx,
            history=_agent_history_for(st.session_state.messages),
        )


if prompt := st.chat_input("Ask about parties, invoices, or request a PDF report..."):
    st.session_state.messages.append({"role": "user", "content": prompt, "steps": []})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            run = asyncio.run(_run_once(prompt))

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

        st.markdown(run.final_text)

    st.session_state.messages.append(
        {"role": "assistant", "content": run.final_text, "steps": assistant_steps}
    )
