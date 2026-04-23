# Phase 0 — Python project setup with uv

## What I learned setting up `apps/ai/`

**`uv` vs `pip` / `poetry` / `conda`**
- `uv` is Astral's all-in-one Python tooling: package manager, virtualenv manager, Python version manager, lockfile resolver. Written in Rust, ~10–100× faster than pip/poetry.
- `pip` only installs packages into the active environment. You manage `venv`, `requirements.txt`, `pip-tools` yourself.
- `poetry` is pip+virtualenv+lockfile in one — but slower and historically buggy on Windows.
- `conda` is geared at data-science binary stacks; heavy, not the right tool for a pure-Python web app.
- **My rule:** if the project isn't legacy, reach for `uv`. Single tool, fast, sane defaults.

**`pyproject.toml` anatomy (what's in ours)**
- `[project]` — metadata + `dependencies` (runtime deps)
- `[dependency-groups]` — dev-only deps (ruff, mypy) that don't ship to production
- `[tool.ruff]` / `[tool.mypy]` — tool-specific config, colocated with the project
- No `setup.py`, no `requirements.txt`. `uv.lock` (auto-generated) is the pinned resolver output.

**`uv sync` is the magic command**
- Reads `pyproject.toml`, resolves versions, creates `.venv/` if missing, installs everything to match the lockfile
- Idempotent — re-running on a clean clone reproduces the exact same environment

**`uv run python X.py`**
- Runs `X.py` inside the project's `.venv` without needing to `activate` it first
- Replaces the `source .venv/bin/activate && python X.py` dance
- Great for scripts and one-off commands

**`pydantic-settings` vs raw `os.environ`**
- `os.environ["X"]` returns `str` or raises `KeyError`. No typing, no validation, no defaults in one place.
- `pydantic-settings` → define a typed `Settings` class once, get autocomplete, type-checking, validation, defaults, and clean `.env` loading. We'll use this from Phase 1.

**What `.venv/` is (for folks from other languages)**
- A project-local Python interpreter + `site-packages/`. Like `node_modules/` but for Python.
- Never commit it. Always regenerable from `pyproject.toml` + `uv.lock`.

**Why we skipped pre-commit hooks today**
- The plan mentions ruff + mypy hooks, but wiring them on day 1 (when there's literally one file) is friction for zero gain. Revisit in Phase 1 once there are multiple modules to lint.

**Gotchas I hit (or nearly hit)**
- Windows: `winget install astral-sh.uv` works, but if winget is locked down, `pip install uv` is fine too.
- On Windows git-bash, prefer forward-slash paths or `/c/...` form; Windows backslashes break quoting.
- **Leaked API keys**: Google auto-revokes keys it detects as leaked (returns `403 "Your API key was reported as leaked"`). Lesson: never paste keys into chat, never commit `.env` files, and treat `apps/*/.env` as a secret even if `.gitignore` covers it — the key may have leaked before the gitignore was added.
- **Model names rot fast.** My first `hello_llm.py` used `gemini-2.0-flash-exp` (a name copied from older docs). That was a retired preview model → `404 NOT_FOUND`. Then `gemini-2.0-flash` gave `429 RESOURCE_EXHAUSTED, limit: 0` — the free tier quota for that model is zero on a new project. `gemini-2.5-flash-lite` worked. Rule: always query `GET /v1beta/models?key=KEY` with your actual key to see what's accessible, don't trust model names from blog posts.
- **LiteLLM's model prefix convention**: `gemini/<model>` for Google AI Studio, `anthropic/<model>` for Claude, `openai/<model>` for OpenAI. The prefix tells LiteLLM which provider to route to. Missing the prefix → cryptic auth errors.
