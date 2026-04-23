# apps/ai — Generative AI Companion

Python companion app for ErpSystem2025. See `docs/genAiAppPlan.md` in the repo root for the full learning-first plan and roadmap.

## Quick start

```bash
cd apps/ai

# 1. Sync deps (uv reads pyproject.toml, creates .venv, installs everything)
uv sync

# 2. Copy env template and fill in your keys
cp .env.example .env
# edit .env — at minimum set GOOGLE_API_KEY

# 3. Smoke test — first Gemini call
uv run python hello_llm.py
```

If step 3 prints a coherent Gemini reply, Phase 0 is complete.

## Phase progression

| Phase | Topic | Entry point |
|---|---|---|
| 0 | Bootstrap | `hello_llm.py` |
| 1 | Chat UI + multi-provider | `app.py` |
| 2 | Tool use + first PDF | `src/agent/loop.py` |
| 3 | RAG (Chroma) | `src/rag/` |
| 4 | Pipelines + pgvector | `src/pipelines/scheduler.py` |
| 5 | MCP server (ERP tools) | `src/mcp_server/erp_tools.py` |
| 6 | External MCPs + WhatsApp | `src/mcp_server/whatsapp.py` |
| 7 | LangGraph agents | `src/agent/graph.py` |

Learning notes for each phase live in `docs/learning-notes/`.
