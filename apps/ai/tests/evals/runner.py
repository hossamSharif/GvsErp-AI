"""Eval harness — drive the agent through each case and judge the trace.

Tools are stubbed via monkey-patching ``src.tools.registry.dispatch`` so we
don't need a live ERP API or seeded Supabase data — the eval focuses on
*tool selection*, not tool execution.  Real LLM calls still happen, so the
runner needs an API key.

Two assertions per case:
  * ``expects_any``     — at least one of these tool names was called.
                          Empty list means we expect zero tool calls.
  * ``should_not_call`` — none of these tool names were called.

Usage:
    from tests.evals.runner import run_case, load_cases, build_stub_ctx
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.agent.graph import run_graph
from src.agent.loop import run_agent
from src.tools import registry as registry_module
from src.tools.context import ToolContext

CASES_PATH = Path(__file__).parent / "cases.json"


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    called: list[str]
    expects_any: list[str]
    should_not_call: list[str]
    final_text: str
    reason: str = ""


# A tiny system prompt — keeps the eval focused on tool selection without
# the production prompt pulling in details that change frequently.
EVAL_SYSTEM_PROMPT = (
    "You are an ERP AI agent with tools to list parties, fetch and create invoices, "
    "search the indexed knowledge base, and generate PDF/Excel reports. "
    "Pick tools based on what the user actually asks for. Do NOT call tools "
    "for greetings, definitional questions, or pure planning prompts."
)


class _StubErp:
    """Minimal stand-in so ToolContext doesn't need a real ErpClient."""

    async def __aenter__(self) -> _StubErp:  # pragma: no cover - unused
        return self

    async def __aexit__(self, *_: object) -> None:  # pragma: no cover
        return None


def build_stub_ctx() -> ToolContext:
    return ToolContext(erp=_StubErp(), supabase=None, dry_run=True)


def install_stub_dispatch(monkeypatch: Any) -> None:
    """Replace registry.dispatch so any tool returns a canned shape."""

    async def stub_dispatch(name: str, raw_args: dict[str, Any], _ctx: Any) -> dict[str, Any]:
        # Return a shape that looks plausibly like real tool output so the
        # LLM doesn't trip on schema surprises.
        return {
            "ok": True,
            "tool": name,
            "echo": raw_args,
            "items": [],
            "stub": True,
        }

    monkeypatch.setattr(registry_module, "dispatch", stub_dispatch)


async def run_case(
    case: dict[str, Any],
    *,
    provider: str,
    model: str | None,
    engine: str = "graph",
) -> CaseResult:
    """Execute one case and return a structured result."""
    ctx = build_stub_ctx()
    runner = run_graph if engine == "graph" else run_agent
    kwargs: dict[str, Any] = dict(
        provider=provider,
        model=model,
        system_prompt=EVAL_SYSTEM_PROMPT,
        ctx=ctx,
        history=None,
        confirmed_calls=None,
    )
    if engine == "graph":
        kwargs.update(user_id="", thread_id=f"eval-{case['id']}")

    run = await runner(case["prompt"], **kwargs)

    called = [s.name for s in run.steps if s.kind == "tool_call" and s.name]
    expects = list(case.get("expects_any", []))
    forbid = list(case.get("should_not_call", []))

    reasons: list[str] = []
    if expects:
        if not any(e in called for e in expects):
            reasons.append(f"expected one of {expects}, got {called}")
    else:
        if called:
            reasons.append(f"expected NO tool calls, got {called}")
    for f in forbid:
        if f in called:
            reasons.append(f"forbidden tool '{f}' was called")

    return CaseResult(
        case_id=case["id"],
        passed=not reasons,
        called=called,
        expects_any=expects,
        should_not_call=forbid,
        final_text=run.final_text,
        reason="; ".join(reasons),
    )
