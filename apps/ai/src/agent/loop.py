"""Handwritten agent loop — no framework.

  while True:
      ask the LLM (with tool schemas)
      if it called tools: run them, append results, loop
      else: return the assistant's final text

Keep this short and readable forever — Phase 7 will replace it with a
LangGraph state machine, and we want the diff to be dramatic.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from litellm import completion

from src.config import DEFAULT_MODELS, settings
from src.llm.provider import PROVIDER_PREFIX
from src.tools.context import ToolContext
from src.tools.registry import dispatch, openai_tool_schemas

MAX_ITERATIONS = 8


@dataclass
class AgentStep:
    kind: str  # "tool_call" | "tool_result" | "final"
    name: str | None = None
    arguments: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    content: str | None = None


@dataclass
class AgentRun:
    messages: list[dict[str, Any]] = field(default_factory=list)
    steps: list[AgentStep] = field(default_factory=list)
    final_text: str = ""


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
) -> AgentRun:
    """Run the loop until the LLM stops asking for tools.

    `history` is the prior turns (for multi-turn chat). System + current user
    are appended internally.
    """
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})

    tools = openai_tool_schemas()
    run = AgentRun(messages=messages)

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
