"""Handwritten agent loop — no framework.

  while True:
      ask the LLM (with tool schemas)
      if it called tools: run them, append results, loop
      else: return the assistant's final text

Keep this short and readable forever — Phase 7 will replace it with a
LangGraph state machine, and we want the diff to be dramatic.

Phase 6 additions:
  - ``McpHub`` replaces ``McpErpClient`` — multiple MCP servers in one turn.
  - Destructive-action confirmation gate: tools marked destructive pause the
    loop and return a ``PendingConfirmation`` so the Streamlit UI can show
    a confirm/cancel dialog.  Pre-confirmed tool calls skip the gate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from litellm import completion

from src.agent.mcp_hub import McpHub
from src.config import DEFAULT_MODELS, settings
from src.llm.provider import PROVIDER_PREFIX
from src.tools.context import ToolContext
from src.tools.registry import dispatch, openai_tool_schemas

MAX_ITERATIONS = 8


def _confirmation_key(name: str, arguments: dict[str, Any]) -> str:
    """Stable token for a (tool, args) pair across LLM re-runs.

    LLMs regenerate ``call_id`` on every request, so a call_id captured before
    a confirmation click is stale by the time the agent re-runs. Hashing the
    canonical args JSON gives us a deterministic key.  Mirrors
    :func:`src.agent.graph.confirmation_key` — keep the implementations in sync.
    """
    import hashlib

    canon = json.dumps(arguments, sort_keys=True, default=str)
    digest = hashlib.sha256(canon.encode()).hexdigest()[:16]
    return f"{name}:{digest}"


@dataclass
class AgentStep:
    kind: str  # "tool_call" | "tool_result" | "final" | "pending_confirmation"
    name: str | None = None
    arguments: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    content: str | None = None


@dataclass
class PendingConfirmation:
    """Represents a destructive tool call awaiting user confirmation."""

    tool_name: str
    arguments: dict[str, Any]
    call_id: str
    description: str = ""


@dataclass
class AgentRun:
    messages: list[dict[str, Any]] = field(default_factory=list)
    steps: list[AgentStep] = field(default_factory=list)
    final_text: str = ""
    pending_confirmation: PendingConfirmation | None = None


def _model_id(provider: str, model: str | None) -> str:
    return f"{PROVIDER_PREFIX[provider]}/{model or DEFAULT_MODELS[provider]}"


def _tool_calls_of(message: Any) -> list[Any]:
    raw = getattr(message, "tool_calls", None) or []
    return list(raw)


async def run_agent(
    user_prompt: str,
    *,
    provider: str,
    model: str | None,
    system_prompt: str,
    ctx: ToolContext,
    history: list[dict[str, Any]] | None = None,
    mcp_hub: McpHub | None = None,
    confirmed_calls: set[str] | None = None,
) -> AgentRun:
    """Run the loop until the LLM stops asking for tools.

    ``history`` is the prior turns (for multi-turn chat). System + current user
    are appended internally.

    ``mcp_hub``, when provided, takes ownership of any tool whose name it
    exposes — the loop pulls those schemas from the hub and routes their calls
    over stdio JSON-RPC instead of the in-process registry. Tools the hub does
    NOT own (docs, RAG) still dispatch locally.

    ``confirmed_calls`` is a set of tool-call IDs the user has already
    approved (via the Streamlit confirmation UI). If a destructive tool call's
    ID is in this set, the confirmation gate is skipped.
    """
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})

    local = openai_tool_schemas()
    if mcp_hub is not None:
        owned = mcp_hub.tool_names()
        local = [s for s in local if s["function"]["name"] not in owned]
        tools = mcp_hub.all_schemas() + local
    else:
        tools = local
    run = AgentRun(messages=messages)

    confirmed = confirmed_calls or set()

    for _ in range(MAX_ITERATIONS):
        response = completion(
            model=_model_id(provider, model),
            messages=messages,
            api_key=settings.api_key_for(provider),
            tools=tools,
            tool_choice="auto",
        )
        assistant = response.choices[0].message
        messages.append(assistant.model_dump(exclude_none=True))

        calls = _tool_calls_of(assistant)
        if not calls:
            run.final_text = assistant.content or ""
            run.steps.append(AgentStep(kind="final", content=run.final_text))
            return run

        for call in calls:
            name = call.function.name
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            run.steps.append(AgentStep(kind="tool_call", name=name, arguments=args))

            # ── Confirmation gate ────────────────────────────────────
            if (
                mcp_hub is not None
                and mcp_hub.is_destructive(name)
                and _confirmation_key(name, args) not in confirmed
                and call.id not in confirmed  # legacy fallback
            ):
                run.pending_confirmation = PendingConfirmation(
                    tool_name=name,
                    arguments=args,
                    call_id=call.id,
                    description=f"Execute {name}({json.dumps(args, default=str)[:200]})",
                )
                run.steps.append(
                    AgentStep(
                        kind="pending_confirmation",
                        name=name,
                        arguments=args,
                        content=f"Waiting for confirmation to run {name}",
                    )
                )
                return run

            # ── Dispatch ─────────────────────────────────────────────
            if mcp_hub is not None and mcp_hub.owns(name):
                result = await mcp_hub.call(name, args)
            else:
                result = await dispatch(name, args, ctx)
            run.steps.append(AgentStep(kind="tool_result", name=name, result=result))

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": name,
                    "content": json.dumps(result, default=str),
                }
            )

    run.final_text = (
        "Agent stopped after reaching the max tool-iteration limit without a final answer."
    )
    run.steps.append(AgentStep(kind="final", content=run.final_text))
    return run
