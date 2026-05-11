"""Live eval suite — runs each case through the LangGraph agent and asserts
the tool-call trace matches expectations.

These tests cost real LLM tokens.  They're skipped unless ``LIVE_EVALS=1`` is
exported AND a provider API key is configured.  In CI you'd run them nightly,
not on every push.

    LIVE_EVALS=1 uv run pytest tests/evals/ -v
    LIVE_EVALS=1 EVAL_ENGINE=loop uv run pytest tests/evals/   # compare engines
"""

from __future__ import annotations

import asyncio
import os

import pytest

from src.config import settings
from tests.evals.runner import install_stub_dispatch, load_cases, run_case

LIVE = os.getenv("LIVE_EVALS") == "1"
ENGINE = os.getenv("EVAL_ENGINE", "graph")  # "graph" | "loop"


pytestmark = pytest.mark.skipif(
    not LIVE or not settings.configured_providers(),
    reason="Set LIVE_EVALS=1 and configure a provider API key to run live evals.",
)


CASES = load_cases()


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_case(case, monkeypatch) -> None:
    install_stub_dispatch(monkeypatch)
    provider = settings.configured_providers()[0]
    model = settings.ai_default_model if provider == settings.ai_default_provider else None
    result = asyncio.run(run_case(case, provider=provider, model=model, engine=ENGINE))
    assert result.passed, (
        f"[{result.case_id}] {result.reason}\n"
        f"  called: {result.called}\n"
        f"  final : {result.final_text[:200]}"
    )
