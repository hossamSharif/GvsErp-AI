# 02 — Tool use, handwritten agent loop, HTML→PDF

Phase 2 deliverables: async ERP client with JWT, 5 Pydantic-schema'd tools, a
tool registry, a ~60-LOC agent loop, a WeasyPrint PDF tool, Supabase sign-in
in Streamlit, dry-run guardrail.

## Tool use — one new input, one new output

Tool calling is three changes to the Phase 1 chat call:

1. **Extra input** to `completion(...)`: `tools=[...]`, a list of JSON-schema
   descriptors shaped like `{type:"function", function:{name, description,
   parameters}}`. The model reads these as a menu.
2. **Extra output** on the assistant message: `tool_calls`, a list of
   `{id, function:{name, arguments}}` where `arguments` is a **JSON string**
   the model generated to match the schema.
3. **Extra role** on the way back: we append `{role:"tool", tool_call_id, name,
   content}` messages with the tool's result (serialized as JSON), and call
   `completion()` again. Repeat until there are no more `tool_calls`.

The stateless part still holds — every turn re-sends the full list.

## Why Pydantic → JSON Schema

Writing JSON schemas by hand is miserable and they drift from the code. A
Pydantic `BaseModel` gives me, for free:

- A JSON schema via `.model_json_schema()` (feed to the LLM).
- Runtime validation via `.model_validate(raw_args)` (catch the LLM
  hallucinating a field before it hits my ERP).
- Python type checking in the handler.

One definition, three jobs. This is the lesson I don't want to un-learn when
a framework later papers over it.

## Agent loop anatomy

```
while iterations < MAX:
    resp = llm.chat(messages, tools=tool_schemas)
    messages.append(resp.assistant_message)
    if resp.tool_calls:
        for call in resp.tool_calls:
            result = dispatch(call.name, json.loads(call.arguments))
            messages.append({role: "tool", tool_call_id: call.id, content: json(result)})
        continue
    return resp.content
```

Things that are NOT magic:

- The loop terminates because the model stops emitting `tool_calls` when it
  thinks it has enough info to answer.
- `MAX_ITERATIONS` exists because a broken model or a broken tool can loop
  forever. Cheap insurance.
- Tool results must be serializable JSON — `json.dumps(result, default=str)`
  covers datetimes/UUIDs without the model seeing a Python `repr`.

## Why the registry pattern

Tools live in two modules (`src/tools/erp.py`, `src/docs/pdf.py`) but the
agent needs a single surface. `src/tools/registry.py` owns the union:
`openai_tool_schemas()` for the LLM, `dispatch(name, args, ctx)` for
execution. Adding a tool is one entry in `_SPECS`. Removing is one deletion.

## `ToolContext` — the "what can this call see" handle

Every handler takes `(args, ctx: ToolContext)`. The context owns: the
authenticated ERP client, an (optional) Supabase client, and the dry-run flag.
No globals. Swapping auth, toggling dry-run, or mocking for tests = construct
a different context. This is the only concession to clean architecture I
want at Phase 2.

## Auth model — two JWT flows, one token

- Streamlit signs in via `supabase.auth.sign_in_with_password()` and stores
  the resulting `access_token` in `st.session_state.jwt`.
- Every ERP call includes `Authorization: Bearer <jwt>`. The Express API's
  `requireAuth` middleware validates the Supabase JWT, extracts `tenant_id`,
  and every query is RLS-scoped. Nothing in the AI app needs to know about
  tenants — the server enforces it.

## Dry-run — cheap, loud, essential

`ErpClient(..., dry_run=True)` short-circuits POST/PUT/PATCH/DELETE and
returns `{"dry_run": true, "method", "path", "body"}` instead. The LLM sees
this as "tool call succeeded, here's the payload it would have sent." We
eyeball it before flipping dry-run off. Saves one "oops I created 17 draft
invoices" story.

## WeasyPrint + Jinja2 — the "report" recipe

- Write HTML with a `@page { size: A4; margin: ... }` block and CSS as if
  it's a web page. WeasyPrint renders that HTML to PDF; no separate PDF API.
- Jinja2 fills template variables and auto-escapes them (critical when data
  comes from ERP — a party name with `<` breaks the document).
- `HTML(string=html).write_pdf()` returns `bytes`. We either upload those to
  Supabase Storage and return a signed URL, or save locally and return a
  `file://` URI — same tool contract either way.

### Windows gotcha

WeasyPrint is pure-Python but its text/layout layers call into GTK (Pango,
Cairo, GObject) via CFFI. On Windows you have to install the GTK runtime
before `import weasyprint` works. That's why `pdf.py` imports WeasyPrint
*inside* `_render_pdf` — so the rest of the app still runs on a box without
GTK, and the error message fires only when the tool is invoked.

## Why not LangChain yet

LangChain would give me an `Agent`/`AgentExecutor`, a tool abstraction, and
automatic `ToolCall` → `ToolResult` plumbing. I'd lose:

- The "aha" of seeing the message list morph turn by turn.
- Knowing what the tool schema JSON actually looks like.
- Being able to debug by `print(messages)` — no framework in the way.

Phase 3 brings LangChain in for RAG **utilities** (loaders, splitters,
retrievers) — not the agent. Phase 7 graduates to LangGraph. By then I'll
know what I'm trading away.

## What I want to remember next phase

- A "tool result" is just another message — the LLM has no privileged
  access; everything it knows about the world flows through the message list.
- Validation belongs at the boundary (LLM → dispatch), not scattered through
  each handler.
- The dry-run pattern generalises: any time an agent can do something
  expensive or destructive, wire the same echo-instead-of-execute toggle.
- RAG is another tool: `search_knowledge(query) → passages`. Phase 3 is
  mostly about how to *build the index* the tool reads from, not about the
  tool plumbing — that's Phase 2's job, already done.
