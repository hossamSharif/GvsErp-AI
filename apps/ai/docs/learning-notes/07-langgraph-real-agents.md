# 07 — LangGraph + Real Agent Behaviour

## What we built
- **`src/agent/graph.py`** — full LangGraph state machine with three nodes: `load_memory` → `planner` → `executor` (looping back to itself until done). Compiled per-turn against an in-memory `MemorySaver` checkpointer.
- **`src/memory/user_memory.py`** + **migration `017_ai_user_memory.sql`** — persistent per-user key/value facts with the same `auth.jwt() -> user_metadata.tenant_id` RLS pattern used by `ai_embeddings` (014) and `ai_connected_services` (016).
- **Confirmation-key fix** — both engines now match destructive-tool confirmations on a stable hash of `(name, args)` instead of the LLM-issued `call_id` (which is regenerated on every request and was effectively useless across re-runs).
- **Sidebar engine toggle** — `loop` (handwritten Phase 2 agent) vs `graph` (LangGraph) picked at runtime, plus a Long-term Memory section to add/forget facts manually.
- **Eval harness** — `tests/evals/cases.json` (20 prompts) + `tests/evals/runner.py` + `tests/evals/test_evals.py`. Live evals stub `registry.dispatch` so we test *tool selection*, not tool execution. `LIVE_EVALS=1 uv run pytest tests/evals/` to run.
- **LangSmith env wiring** — set `LANGSMITH_API_KEY` + `LANGSMITH_TRACING=true` and every node + LLM call shows up as a span. No code changes.

## What LangGraph actually buys us (vs. the handwritten loop)

### 1. Checkpointer-based state
`MemorySaver` snapshots the full state after every node. With a stable `thread_id` per Streamlit session, re-runs continue from where they left off instead of replaying the whole turn. Swap to `SqliteSaver` (via `uv sync --extra checkpoint-sqlite`) and the state survives even an app restart.

The handwritten loop has no such notion — its only "state" is the messages list, and HITL re-runs replay from the original user prompt every time.

### 2. Planner / executor split
The planner is a tiny extra LLM call that produces a 1–3 line plan *before* the executor starts asking for tools. It's transparent in the UI (a 📋 Plan expander) and shows up as its own node in LangSmith traces. Trade-off: ~40% more tokens per turn for the visibility.

### 3. Memory injection as a graph node
Long-term facts live in `ai_user_memory`; `load_memory` queries them, formats them as a system message, and the reducer (`Annotated[list, operator.add]`) appends to `state["messages"]` automatically. The executor never knows or cares — it just sees a richer prompt.

### 4. Free observability
LangSmith picks up the env vars and starts tracing without a single instrumentation line. Compare with the handwritten loop, where every step would need explicit logging.

## Things that surprised me

- **`call_id` is not stable across runs.** The Phase 6 confirmation gate stored the LLM-issued tool-call ID, then re-ran the agent. The LLM regenerates IDs on each request, so the saved ID matched nothing on the second run — the user re-confirmed forever in a tight test loop. Fix: hash `(name, args)` with `confirmation_key()`.
- **State reducers are a real cognitive shift.** Returning `{"messages": [new_msg]}` and trusting `operator.add` to concatenate feels wrong coming from imperative code. But it's what makes nodes pure and the checkpointer trivially correct.
- **MemorySaver vs SqliteSaver isn't drop-in.** `SqliteSaver` is in a separate `langgraph-checkpoint-sqlite` package, ships an *async-context-manager* factory (`AsyncSqliteSaver.from_conn_string(...)`), and you have to enter it before you can `compile(checkpointer=...)`. `make_checkpointer()` in `graph.py` papers over this so callers just get a checkpointer.
- **LangGraph 1.x docs assumed `from langchain_core.messages import HumanMessage` everywhere.** We're using LiteLLM with raw dicts (`{"role": "user", "content": ...}`) end-to-end and it Just Works because LangGraph doesn't actually inspect the message shapes — only the reducer does. Fewer abstractions = fewer surprises.
- **Multiple system messages are fine.** Loading memory as a *second* system message (after the static one) is cleaner than mutating the static one. Gemini, Claude, GPT-4 all accept it.

## Eval design — testing the *agent*, not the LLM

The trap with eval suites: writing fragile assertions that break on minor LLM wording changes ("expected 'I will list parties' got 'Let me list parties'"). Avoided by:

1. **Stub `dispatch`** so tools always return a generic success shape. The LLM's tool *selection* is what we judge; tool *execution* is out of scope.
2. **`expects_any` semantics** — any of the listed tools satisfies the case. The LLM is allowed to do extra preliminary work (e.g. `list_parties` before `create_invoice`) without failing the test.
3. **`should_not_call`** — the negative assertion. Used for "this prompt should NOT trigger destructive actions" cases.
4. **Skipped by default** — `LIVE_EVALS=1` opt-in keeps CI fast. Run nightly, not per-push.

Pass criterion from the plan tracker: ≥18/20. The 2 we tolerate flaking are usually the ambiguous ones ("create an invoice for ACME — pick anything reasonable") where the LLM might reasonably stop and ask vs. reasonably proceed.

## How LangSmith fits in
`pip install langsmith`, set the four env vars, done. Every LangGraph node + every `litellm.completion` call (it has its own integration) becomes a span in your project. The trace tree shows: turn → planner → executor → tool_call → ... back to executor → final. Free, hosted, includes diff-vs-previous-runs view.

For evals: the same `LIVE_EVALS=1` run tagged with `LANGSMITH_PROJECT=erp-ai-companion-evals-2026-04-25` gives you a per-case trace history — invaluable when 17/20 passes today and 14/20 tomorrow with no code change.

## What I'd build next
- **Real human-in-the-loop via `interrupt()`**. Right now we set `pending` and end the graph; a more idiomatic LangGraph pattern is to interrupt mid-node and resume with `Command(resume=...)`. Doable, but the current pattern keeps the Streamlit UI flow simple — and the checkpointer already covers the persistence story.
- **Per-tool memory writes** — `save_memory` exposed as a tool so the LLM itself can record observations ("user mentioned they prefer 30-day terms"). With confirmation gating, naturally.
- **Multi-agent**: split RAG/search into its own subgraph that the executor invokes as a single tool. LangGraph supports this with `Send` / `add_subgraph`.
