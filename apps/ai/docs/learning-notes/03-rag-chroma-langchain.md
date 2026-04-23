# 03 — RAG with Chroma in-memory + LangChain utilities

Phase 3 deliverables: `src/rag/{store,retrieve,ingest}.py`, two new tools
(`search_knowledge`, `generate_party_summary_pdf`), a Streamlit "Re-index
ERP" button, a narrative PDF template.

## RAG in one line

The model doesn't know your data. RAG = "before you answer, go look it up."
Implementation is: embed every record once, store vectors, at query time
embed the question, pull the nearest records, paste them into the prompt.

## Embeddings — text → fixed-length vector

`text-embedding-004` (Google, free tier, 768-dim) turns any string into a
768-float vector. Semantically similar strings map to nearby vectors
(cosine distance). "customer with overdue balance" and "ACME Corp, 1,234
USD outstanding" land close; the model-style tokenizer doesn't.

One API key (`GOOGLE_API_KEY`) covers chat + embeddings — same SDK, same
quota pool. LangChain's `GoogleGenerativeAIEmbeddings` is a thin wrapper
that exposes `.embed_documents(list[str])` and `.embed_query(str)`.

## Chroma — the vector store

Chroma is a Python library with a default in-memory mode. `Chroma(...)`
with no `persist_directory` = a fresh collection per process, wiped on
exit. Perfect for Phase 3: zero infra, instant feedback, forces me to
think about the re-ingest loop.

`add_documents(docs)` embeds each doc's `page_content` and stores
`(embedding, metadata, id)`. `as_retriever(search_kwargs={"k": 5})`
returns a retriever whose `.invoke(query)` embeds the query and returns
the 5 nearest docs as LangChain `Document` objects.

Phase 4 swaps Chroma for `SupabaseVectorStore` (pgvector). Same retriever
interface → the `search_knowledge` tool doesn't change.

## Why I still used the splitter on short docs

`RecursiveCharacterTextSplitter(chunk_size=800)` is a no-op for my current
party/invoice docs (they're under 800 chars). I ran them through anyway
because:

- The pattern is the interesting thing: "loader → splitter → embedder →
  store" generalises to every RAG pipeline I'll build.
- The moment I add line-item detail or PDF attachments in Phase 4, the
  splitter starts earning its keep with zero code changes.

Splitters exist because embedding models have a token limit AND because
similarity is blurry over long text — chunking keeps each vector focused
on one idea.

## Metadata is doing half the work

Chroma lets me attach `metadata: dict` to each document. I set:

- `source_table`, `source_id` — so the agent can hop from a retrieval hit
  back to a canonical record (Phase 4 will need this for re-embed).
- `party_id`, `party_name` — so I can filter retrieval by party
  (`search_by_party` passes `filter={"party_id": ...}` to Chroma).
- `invoice_number`, `status` — so the narrative can cite them without a
  second round-trip.

Without metadata filtering, a "summarize ACME" query pulls the top-k
semantically similar rows across *all* parties. With metadata filtering,
I get ACME's records only, period. Same retriever, one extra kwarg.

## Ingestion — reset-and-rebuild

```python
chunks = splitter.split_documents(party_docs + invoice_docs)
reset_store()          # drop collection
get_store().add_documents(chunks)  # re-embed everything
```

This is wasteful — re-embedding unchanged data costs tokens and time. I
did it deliberately:

1. The in-memory store is gone at process exit anyway, so idempotent
   upsert buys nothing at Phase 3.
2. Phase 4 has to design proper incremental ingest with
   `last_synced_at`, source-id dedupe, RLS, etc. If Phase 3 already
   shipped that, Phase 4 wouldn't *teach* me anything.

Deliberate simplification beats accidental complexity.

## Narrative synthesis inside a tool

`generate_party_summary_pdf` was tempting to write as pure retrieval +
table. Making it call the LLM *inside the tool* was the more interesting
choice: the agent turn becomes

1. user: "summarize ACME"
2. agent → `generate_party_summary_pdf(party_id=...)`
3. tool → retrieves → **inner LLM call** → narrative → WeasyPrint → URL
4. agent → "Here is the PDF" + URL

I thread `provider`/`model` through `ToolContext` so the synthesis uses
the user's selected LLM, not a hard-coded one. Same three-provider switch
as the chat.

## Grounding prompts

The narrative system prompt does three things:

- Tells the model its role (*one-paragraph summary*).
- Demands citations (`cite the invoice number in parentheses`).
- Closes the hallucination door (`do not invent data`; if docs are empty,
  say so).

Combined with the agent-turn system prompt that says "call
search_knowledge BEFORE answering qualitative questions", the agent
mostly stays grounded. "Mostly" because an LLM will still confabulate if
you let it — evals in Phase 7 will measure how often.

## What changed in the architecture diagram

Before: `LLM ↔ tools ↔ ERP API`.
Now: `LLM ↔ tools ↔ {ERP API, Chroma retriever}`.

Chroma is the first persistent-ish data store the AI app owns. Phase 4
will make it actually persistent (pgvector in Supabase) with RLS so the
index respects tenant boundaries. In-memory Phase 3 trusts the JWT of
whoever ran the ingest — single-tenant per process, good enough.

## What I want to remember next phase

- In-memory = single process, single tenant, reset on reload. Acceptable
  cost for zero infra.
- pgvector moves the store server-side, needs an extension install, a
  table, RLS policies, an ivfflat index, and a Supabase-specific
  LangChain wrapper. Same retriever interface → callers unchanged.
- "Use LangChain utilities, not its agents" is the phase mantra. Loaders
  + splitters + retrievers + vectorstore wrappers all live here; agent
  orchestration stays handwritten until Phase 7.
- Metadata-scoped retrieval is the difference between "fuzzy
  similarity" and "trustworthy answer." Invest in metadata.
