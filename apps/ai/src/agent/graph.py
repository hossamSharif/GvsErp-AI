"""Phase 7 — LangGraph state machine.

The handwritten loop in ``loop.py`` is intentionally kept around for
side-by-side comparison.  This module is the *graduation*: same surface
contract (``run_graph`` mirrors ``run_agent``), but the agent's control
flow now lives in a directed state graph instead of a Python while-loop.

What the framework actually buys us:

1. **Planner / executor split** — a small upfront planner LLM call sketches
   the steps; a separate executor LLM does the real tool-calling.  The split
   gives us a place to inspect "what was the plan" vs "what did we do".
2. **Checkpointer** — every node transition snapshots the state.  Streamlit
   reruns can continue mid-conversation; HITL pauses survive process churn
   when paired with ``SqliteSaver`` (see learning note 07).
3. **Long-term memory** — the ``load_memory`` node queries
   ``ai_user_memory`` and prepends a "known facts" block to the system
   prompt before the LLM ever sees the question.
4. **LangSmith tracing** — set ``LANGSMITH_TRACING=true`` +
   ``LANGSMITH_API_KEY`` and every node + LLM call shows up as a span.
   Zero in-code instrumentation.

What it does *not* buy us (compared to the handwritten loop):
- Speed: the planner adds one extra LLM call per turn.
- Magic: the executor is still a 50-line function.  Read it.
"""

from __future__ import annotations

import hashlib
import json
import operator
from dataclasses import dataclass
from typing import Annotated, Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from litellm import completion

from src.agent.loop import AgentRun, AgentStep, PendingConfirmation
from src.agent.mcp_hub import McpHub
from src.config import DEFAULT_MODELS, settings
from src.llm.provider import PROVIDER_PREFIX
from src.memory.user_memory import format_for_prompt, list_memory
from src.tools.context import ToolContext
from src.tools.registry import dispatch, openai_tool_schemas

MAX_ITERATIONS = 8


# ── Helpers shared with loop.py ──────────────────────────────────────────


def _model_id(provider: str, model: str | None) -> str:
    return f"{PROVIDER_PREFIX[provider]}/{model or DEFAULT_MODELS[provider]}"


def confirmation_key(name: str, arguments: dict[str, Any]) -> str:
    """Stable token identifying a (tool, args) pair across LLM re-runs.

    Why not use the LLM-issued ``call_id``?  Because the LLM regenerates a
    fresh ID on every request — the ID we save when the user clicks Confirm
    becomes stale the moment the agent re-runs.  Hashing the canonical args
    JSON gives us a deterministic key that survives.
    """
    canon = json.dumps(arguments, sort_keys=True, default=str)
    digest = hashlib.sha256(canon.encode()).hexdigest()[:16]
    return f"{name}:{digest}"


# ── Graph state ──────────────────────────────────────────────────────────


class GraphState(TypedDict, total=False):
    """The single source of truth flowing between nodes.

    ``Annotated[..., operator.add]`` tells LangGraph to *append* deltas
    each node returns.  Plain fields use the default last-write-wins
    reducer.
    """

    # Conversation transcript (system + user/assistant + tool messages).
    # Each node returns ONLY the new messages it produced; reducer concatenates.
    messages: Annotated[list[dict[str, Any]], operator.add]

    # Step log for the Streamlit UI.  Mirrors what ``loop.py`` builds in
    # ``AgentRun.steps``.  Append-only.
    steps: Annotated[list[dict[str, Any]], operator.add]

    # Planner output — short numbered list of intended actions.
    plan: list[str]

    # Last-write-wins counters / flags.
    iterations: int
    final_text: str
    pending: dict[str, Any] | None

    # Pre-confirmed (tool, args) keys.  See ``confirmation_key``.
    confirmed_calls: list[str]

    # Long-term memory loaded from ai_user_memory.
    memory_facts: list[dict[str, Any]]
    user_id: str


# ── Node factories ───────────────────────────────────────────────────────
#
# We close over ``ctx``, ``mcp_hub``, ``provider``, ``model``, ``tools`` here
# because (a) they're per-turn runtime context, (b) the checkpointer can't
# pickle ErpClient / MCP sessions / etc.  Each call to ``build_graph`` returns
# a fresh compiled graph wired to *this* turn's runtime objects.


def _make_load_memory(ctx: ToolContext):
    async def load_memory(state: GraphState) -> dict[str, Any]:
        user_id = state.get("user_id") or ""
        facts = list_memory(ctx.supabase, user_id)
        if not facts:
            return {"memory_facts": []}
        block = format_for_prompt(facts)
        # A second system message with the memory facts.  Most providers handle
        # multiple system messages fine; placing it after the static system
        # prompt keeps the static instructions authoritative.
        return {
            "memory_facts": facts,
            "messages": [{"role": "system", "content": block}],
            "steps": [
                {
                    "kind": "memory_loaded",
                    "name": "load_memory",
                    "content": f"Loaded {len(facts)} fact(s) from long-term memory.",
                }
            ],
        }

    return load_memory


def _make_planner(provider: str, model: str | None):
    plan_prompt = (
        "You are a planning assistant for an ERP AI companion. "
        "Given the user's latest request, produce a SHORT numbered plan "
        "(1–3 lines) naming the tools you intend to call in order. "
        "Do NOT call tools. Do NOT answer. If the request is conversational "
        "and needs no tools, reply exactly 'no tools needed'."
    )

    async def planner(state: GraphState) -> dict[str, Any]:
        # Find the most recent user message so the planner can sketch a plan
        # for THIS turn (not the whole transcript).
        user_q = ""
        for m in reversed(state.get("messages", [])):
            if m.get("role") == "user":
                user_q = m.get("content") or ""
                break
        if not user_q:
            return {"plan": []}

        plan_messages = [
            {"role": "system", "content": plan_prompt},
            {"role": "user", "content": user_q},
        ]
        try:
            response = completion(
                model=_model_id(provider, model),
                messages=plan_messages,
                api_key=settings.api_key_for(provider),
            )
            text = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            # A failed planner shouldn't break the turn — just skip.
            return {
                "plan": [],
                "steps": [
                    {
                        "kind": "plan",
                        "name": "planner",
                        "content": f"(planner skipped: {exc})",
                    }
                ],
            }

        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        return {
            "plan": lines,
            "steps": [{"kind": "plan", "name": "planner", "content": text or "(empty)"}],
        }

    return planner


def _make_executor(
    ctx: ToolContext,
    mcp_hub: McpHub | None,
    tools: list[dict[str, Any]],
    provider: str,
    model: str | None,
):
    """One LLM-then-tools tick.  The conditional edge re-enters this node
    until the LLM stops asking for tools, or we hit the iteration cap, or
    a destructive tool surfaces a pending confirmation."""

    async def executor(state: GraphState) -> dict[str, Any]:
        messages = state.get("messages", [])
        iterations = state.get("iterations", 0)
        confirmed = set(state.get("confirmed_calls", []))

        response = completion(
            model=_model_id(provider, model),
            messages=messages,
            api_key=settings.api_key_for(provider),
            tools=tools,
            tool_choice="auto",
        )
        assistant = response.choices[0].message
        new_messages: list[dict[str, Any]] = [assistant.model_dump(exclude_none=True)]
        new_steps: list[dict[str, Any]] = []

        calls = list(getattr(assistant, "tool_calls", None) or [])

        # ── No tools called → terminal turn ──────────────────────────────
        if not calls:
            text = assistant.content or ""
            new_steps.append({"kind": "final", "name": None, "content": text})
            return {
                "messages": new_messages,
                "steps": new_steps,
                "final_text": text,
                "iterations": iterations + 1,
            }

        # ── At least one tool call → dispatch each ───────────────────────
        for call in calls:
            name = call.function.name
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            new_steps.append(
                {"kind": "tool_call", "name": name, "arguments": args}
            )

            # Confirmation gate — destructive + not pre-confirmed
            if (
                mcp_hub is not None
                and mcp_hub.is_destructive(name)
                and confirmation_key(name, args) not in confirmed
                and call.id not in confirmed  # backwards-compat
            ):
                pending = {
                    "tool_name": name,
                    "arguments": args,
                    "call_id": call.id,
                    "key": confirmation_key(name, args),
                    "description": (
                        f"Execute {name}({json.dumps(args, default=str)[:200]})"
                    ),
                }
                new_steps.append(
                    {
                        "kind": "pending_confirmation",
                        "name": name,
                        "arguments": args,
                        "content": f"Waiting for confirmation to run {name}",
                    }
                )
                return {
                    "messages": new_messages,
                    "steps": new_steps,
                    "pending": pending,
                    "iterations": iterations + 1,
                }

            # Dispatch — MCP hub for owned tools, in-process registry otherwise
            if mcp_hub is not None and mcp_hub.owns(name):
                result = await mcp_hub.call(name, args)
            else:
                result = await dispatch(name, args, ctx)

            new_steps.append({"kind": "tool_result", "name": name, "result": result})
            new_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": name,
                    "content": json.dumps(result, default=str),
                }
            )

        return {
            "messages": new_messages,
            "steps": new_steps,
            "iterations": iterations + 1,
        }

    return executor


def _continue_or_end(state: GraphState) -> str:
    """Conditional edge from executor.  END when the LLM produced final text,
    paused on confirmation, or hit the iteration cap."""
    if state.get("final_text"):
        return "end"
    if state.get("pending"):
        return "end"
    if state.get("iterations", 0) >= MAX_ITERATIONS:
        return "end"
    return "continue"


# ── Graph builder ────────────────────────────────────────────────────────


def build_graph(
    *,
    ctx: ToolContext,
    mcp_hub: McpHub | None,
    tools: list[dict[str, Any]],
    provider: str,
    model: str | None,
    checkpointer: Any | None = None,
):
    """Compose the StateGraph.  Returns the compiled runnable."""
    sg = StateGraph(GraphState)
    sg.add_node("load_memory", _make_load_memory(ctx))
    sg.add_node("planner", _make_planner(provider, model))
    sg.add_node("executor", _make_executor(ctx, mcp_hub, tools, provider, model))

    sg.add_edge(START, "load_memory")
    sg.add_edge("load_memory", "planner")
    sg.add_edge("planner", "executor")
    sg.add_conditional_edges(
        "executor",
        _continue_or_end,
        {"continue": "executor", "end": END},
    )

    return sg.compile(checkpointer=checkpointer or MemorySaver())


# ── Public entry — drop-in alternative to ``run_agent`` ──────────────────


async def run_graph(
    user_prompt: str,
    *,
    provider: str,
    model: str | None,
    system_prompt: str,
    ctx: ToolContext,
    history: list[dict[str, Any]] | None = None,
    mcp_hub: McpHub | None = None,
    confirmed_calls: set[str] | None = None,
    user_id: str = "",
    thread_id: str = "default",
    checkpointer: Any | None = None,
) -> AgentRun:
    """Run one turn through the LangGraph state machine.

    Mirrors :func:`src.agent.loop.run_agent`'s signature so the Streamlit UI
    can swap engines without changing its plumbing.

    ``thread_id`` keys into the checkpointer — re-using it across reruns lets
    LangGraph resume state.  ``confirmed_calls`` is a set of either raw
    call_ids (legacy) or :func:`confirmation_key` tokens.
    """
    # Same tools-merging logic as run_agent: hub-owned tools take priority,
    # local registry fills in docs / RAG.
    local = openai_tool_schemas()
    if mcp_hub is not None:
        owned = mcp_hub.tool_names()
        local = [s for s in local if s["function"]["name"] not in owned]
        tools = mcp_hub.all_schemas() + local
    else:
        tools = local

    initial_messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]
    if history:
        initial_messages.extend(history)
    initial_messages.append({"role": "user", "content": user_prompt})

    graph = build_graph(
        ctx=ctx,
        mcp_hub=mcp_hub,
        tools=tools,
        provider=provider,
        model=model,
        checkpointer=checkpointer,
    )

    initial_state: GraphState = {
        "messages": initial_messages,
        "steps": [],
        "plan": [],
        "iterations": 0,
        "final_text": "",
        "pending": None,
        "confirmed_calls": list(confirmed_calls or []),
        "memory_facts": [],
        "user_id": user_id,
    }

    config = {"configurable": {"thread_id": thread_id}}
    final_state = await graph.ainvoke(initial_state, config=config)

    # Translate state → AgentRun (same shape the Streamlit UI already renders)
    run = AgentRun(messages=final_state.get("messages", []))
    for s in final_state.get("steps", []):
        run.steps.append(
            AgentStep(
                kind=s.get("kind", ""),
                name=s.get("name"),
                arguments=s.get("arguments"),
                result=s.get("result"),
                content=s.get("content"),
            )
        )
    run.final_text = final_state.get("final_text") or ""
    pending = final_state.get("pending")
    if pending:
        run.pending_confirmation = PendingConfirmation(
            tool_name=pending["tool_name"],
            arguments=pending["arguments"],
            call_id=pending["call_id"],
            description=pending.get("description", ""),
        )
    return run


# ── Optional SqliteSaver loader ──────────────────────────────────────────


@dataclass
class CheckpointerHandle:
    """Carries a checkpointer + its lifecycle context manager (if any).

    SqliteSaver is an async-context object — the caller has to enter it.
    MemorySaver is plain.  This wrapper hides the difference.
    """

    saver: Any
    cm: Any | None = None

    async def __aenter__(self) -> Any:
        if self.cm is not None:
            self.saver = await self.cm.__aenter__()
        return self.saver

    async def __aexit__(self, *exc: object) -> None:
        if self.cm is not None:
            await self.cm.__aexit__(*exc)


def make_checkpointer(sqlite_path: str | None = None) -> CheckpointerHandle:
    """Best-effort SqliteSaver, falling back to in-memory.

    Install with ``uv sync --extra checkpoint-sqlite`` to enable the SQLite
    backend.  Without it (or without ``sqlite_path``) we return MemorySaver,
    which is fine for in-process HITL but loses state on restart.
    """
    if sqlite_path:
        try:
            from langgraph.checkpoint.sqlite.aio import (  # noqa: PLC0415
                AsyncSqliteSaver,
            )

            cm = AsyncSqliteSaver.from_conn_string(sqlite_path)
            return CheckpointerHandle(saver=None, cm=cm)
        except ImportError:
            pass
    return CheckpointerHandle(saver=MemorySaver())
