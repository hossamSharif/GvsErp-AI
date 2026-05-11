# 05 — MCP fundamentals: build your own server

Phase 5 deliverables: a FastMCP stdio server wrapping the 5 Phase-2 ERP
tools (`src/mcp_server/erp_tools.py`), an async-context-manager client
that the agent uses to consume its own server
(`src/agent/mcp_client.py`), a toggle in Streamlit to pick MCP vs
in-process dispatch, and a Claude Desktop config example so the same
tools are callable from outside our app.

## Why bother — the boundary is the point

In Phase 2 the agent `import`ed its tool handlers and called Python
functions. That's fast and simple; it's also a dead-end once you want:

- a different host — Claude Desktop, Cursor, a CLI — to use the same
  tools,
- the tools rewritten in another language / moved to another host,
- a real authorization surface between "agent" and "things it can touch".

MCP (Model Context Protocol) gives you one wire format for all three.
The server publishes tools / resources / prompts; the client talks
JSON-RPC over stdio (or HTTP+SSE). Phase 5 forces the boundary to exist
even when the client and server ship in the same repo — because *once*
you've done it for one pair, moving the server elsewhere is config, not
refactor.

## FastMCP in one file

The low-level MCP SDK lets you register handlers for each JSON-RPC
method. FastMCP is a thin decorator layer on top that infers schemas
from type hints and docstrings:

```python
mcp = FastMCP("erp-tools")

@mcp.tool()
async def list_parties(
    type: Literal["customer", "supplier"] | None = None,
    search: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List customers or suppliers."""
    async with _client() as erp:
        return await erp.list_parties(type=type, search=search, limit=limit)

def main() -> None:
    mcp.run()   # defaults to stdio transport
```

That's it. `Literal` → `enum` in JSON Schema. `| None` + default → optional.
Docstring first line → tool description. A `BaseModel` in the signature
(see `InvoiceItem` in `create_invoice`) → a `$defs` ref that clients
understand. `mcp.run()` with no arg speaks stdio — the default
Claude Desktop / Cursor / Inspector transport.

## Passing auth into a headless server

The server has no UI, so it can't prompt for credentials. MCP servers
conventionally read config from env, and Claude Desktop's
`claude_desktop_config.json` has a per-server `env` block exactly for
this. Ours takes three vars:

- `MCP_ERP_JWT` — Supabase access token (required)
- `MCP_ERP_API_BASE_URL` — defaults to `http://localhost:3001/api/v1`
- `MCP_ERP_DRY_RUN` — echo mutations instead of POSTing

`ErpClient` is built fresh inside each tool call (httpx handles the
pooling); this keeps one tool's failure from poisoning another's
connection state, at the cost of one TCP setup per call — cheap for a
learning-stage app.

## The client — `stdio_client` + `ClientSession`

Consuming the server from our own agent is three concentric async
contexts:

```python
async with stdio_client(params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        result = await session.call_tool("list_parties", {"limit": 5})
```

`stdio_client` spawns the server subprocess and gives you framed
read/write streams. `ClientSession` layers JSON-RPC on top; `initialize`
completes the MCP handshake (capabilities + protocol version).

I wrapped all three in `McpErpClient`, an async-with class that uses
`AsyncExitStack` to keep the teardown clean regardless of where an
exception is thrown. One client per chat turn — a cleaner Phase-7
rewrite will keep a session alive for the whole app lifetime.

## One small translation — MCP tools → OpenAI schemas

FastMCP emits MCP-flavoured tool descriptors (`name`, `description`,
`inputSchema`); LiteLLM's `completion(tools=...)` wants the OpenAI shape
(`{type:"function", function:{name, description, parameters}}`). The
translation is four lines — copy fields, drop the root `title`, wrap in
`{"type":"function", "function": {...}}`. Once you see the schemas side
by side it's obvious they describe the same thing; MCP is just a couple
of keys stricter.

## Routing in the agent loop

The loop now accepts an optional `mcp_erp`. If present:

1. Pull its schemas, concat with the local registry's schemas minus any
   names MCP already owns. Same LLM sees the same menu; it doesn't care
   which backend serves which tool.
2. On each `tool_call`, ask `mcp_erp.owns(name)`. If yes → `mcp_erp.call(...)`;
   else → `dispatch(name, args, ctx)` as before.

Docs + RAG tools stay local because they need `ToolContext.supabase`
and the user's chosen LLM provider — threading all that through MCP
would be busywork. The plan's "clean boundary" is specifically the 5
Phase-2 ERP tools, and that's what we ported.

## Result shape — structured vs text

FastMCP wraps a `dict` return as a TextContent carrying JSON text, not
`structuredContent`. (`structuredContent` gets populated when the tool's
return type is a Pydantic model.) Our handlers return dicts, so the
client does `json.loads(result.content[0].text)` and hands a plain dict
back to the loop — indistinguishable from the in-process path. The
`_first_text` helper and the structured-content branch in `call()` are
there for future tools that return Pydantic models.

## Claude Desktop — portfolio moment

The config snippet in `docs/claude_desktop_config.example.json` is the
whole story: a `command`, some `args`, and an `env` block. Paste it into
`%APPDATA%\Claude\claude_desktop_config.json`, restart, and "list
parties" in Claude Desktop makes a round-trip through our Express API.
No web UI, no Streamlit, just our tools exposed as reusable capabilities.

## What I want to remember next phase

- MCP treats "tools" as first-class. If something is worth letting an
  agent do, it's worth shipping as an MCP tool — then every MCP host
  gets it for free.
- `stdio_client` is subprocess + framing; `ClientSession` is the RPC
  layer. You rarely need to look inside either, but knowing the split
  makes `AsyncExitStack` failures easier to read.
- `sys.executable` when spawning a Python subprocess is the "spawn a
  python that has my deps" trick. Avoids the classic "works on my
  machine, Claude Desktop can't find `mcp`" failure.
- Schema translation MCP↔OpenAI is boring and four lines long. No
  library needed. The fact that it's boring is the point — interop is
  where you want *no* cleverness.
- Phase 6 consumes MCP servers we didn't write (Gmail, Drive,
  Calendar). The machinery is identical — `stdio_client` + `ClientSession`
  + schema translation. The only new thing is per-user OAuth, which
  those servers handle. The Phase-5 client is the template.
