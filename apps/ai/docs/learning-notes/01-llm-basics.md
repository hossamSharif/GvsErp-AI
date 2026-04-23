# 01 — LLM basics, streaming, multi-provider

Phase 1 deliverables: typed config, LiteLLM wrapper, Streamlit chat with
provider dropdown + token streaming.

## Messages — the shape everything revolves around

Every chat LLM takes the same basic input: a list of `{role, content}` dicts.
Three roles matter in Phase 1:

- **`system`** — instructions the model follows for the whole conversation
  (persona, tone, guardrails). Sent once at the top.
- **`user`** — what the human typed.
- **`assistant`** — what the model replied *previously*. You send these back
  on the next turn so the model has memory; the model itself is stateless.

The "conversation" is just the full list re-sent every turn. That's why we
keep `st.session_state.messages` and rebuild `[system, *messages]` on each
send.

## System prompt

The single highest-leverage knob for behaviour. "Be concise" beats 30 lines
of post-hoc prompt engineering. Keep it short, declarative, and put
non-negotiables first ("Never send email without confirmation").

## Temperature and top_p

- `temperature` (0.0–2.0) — randomness. 0 = deterministic, good for
  tool-calling and structured output. 0.7 = default chatty. >1.0 = creative.
- `top_p` (nucleus sampling) — alternative knob; most projects pick one. Stick
  with temperature until you have a reason not to.

## Streaming vs blocking

- **Blocking** (`stream=False`) — one HTTP round-trip, full reply returned as
  a string. Simple, but the user stares at a spinner while the model types.
- **Streaming** (`stream=True`) — server-sent events; each chunk carries a
  delta. Feels instant. LiteLLM yields chunks in OpenAI-shape — read
  `chunk.choices[0].delta.content`, skip chunks with `None` (role-only
  prelude and stop signals).

Streamlit's `st.write_stream(generator)` does three jobs for you: renders
tokens as they arrive, **returns the concatenated full string** so you can
save it to history, and auto-handles formatting.

## LiteLLM — why a router from day one

LiteLLM is a thin translator: "`anthropic/claude-sonnet-4-5`" → Anthropic API
shape; "`gemini/gemini-2.5-flash-lite`" → Google API shape; both come back in
OpenAI format. Trade-offs:

- **Upside:** one import, provider switch = one string change, fewer SDKs.
- **Cost:** slightly behind bleeding-edge features (vision, thinking,
  provider-specific knobs). For Phase 1–4 we never touch those.

Provider prefix cheatsheet:

| Provider  | Prefix       | Example model               |
|-----------|--------------|------------------------------|
| Google    | `gemini/`    | `gemini-2.5-flash-lite`      |
| Anthropic | `anthropic/` | `claude-sonnet-4-5`          |
| OpenAI    | `openai/`    | `gpt-4o-mini`                |

## pydantic-settings vs os.environ

`os.environ["GOOGLE_API_KEY"]` is stringly-typed and crashes at use site with
a `KeyError`. `pydantic-settings` loads `.env` once, validates types, fails
at import if a required field is missing, and gives you autocomplete.

The pattern: one `Settings` class, one `settings = Settings()` module
singleton, every module imports `from src.config import settings`. Never
reach for `os.environ` again.

## Provider quirks seen in Phase 1

- **Gemini free tier** is flaky per-region and per-model. `gemini-2.0-flash`
  isn't available on new projects; `gemini-2.5-flash-lite` is the current
  safe free-tier pick (Q2 2026).
- **Anthropic** returns an empty string for `delta.content` on the first and
  last chunks (role and stop-reason); the `if delta:` guard handles it.
- **OpenAI** includes a `role` field in the first delta but not subsequent
  ones — same guard handles it.

## What I want to remember next phase

- Tool use in Phase 2 = same `messages` list + a `tools=[...]` parameter
  with JSON-schema descriptors. The model replies with `tool_calls` instead
  of `content`; we dispatch, append the result as a `tool` role message, loop.
- Streaming and tool-calling compose — the stream will contain `tool_calls`
  deltas that have to be accumulated. We'll cross that bridge in Phase 2.
