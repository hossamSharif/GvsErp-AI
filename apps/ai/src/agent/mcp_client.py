"""MCP client for our own ERP tools server.

Why: Phase 2's agent called ERP tool handlers via a plain Python import.
Phase 5 forces the agent→tools boundary to travel over MCP (stdio JSON-RPC)
so swapping the server for one written in another language — or hosted
elsewhere — needs zero agent changes.

Shape: one async context manager per agent turn. On __aenter__ we spawn
the FastMCP server as a subprocess, initialize the session, and cache
the tool list. On __aexit__ we tear down the session + subprocess.

Kept deliberately thin. A Phase-7 LangGraph rewrite will manage a long-
lived session; for now one-per-turn is simple and cheap enough.
"""

from __future__ import annotations

import json
import sys
from contextlib import AsyncExitStack
from typing import TYPE_CHECKING, Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from src.config import settings

if TYPE_CHECKING:
    from mcp.types import Tool


class McpErpClient:
    """Async context-managed client for the `erp-tools` MCP server."""

    def __init__(self, jwt: str, *, dry_run: bool = False) -> None:
        self._params = StdioServerParameters(
            # sys.executable keeps us inside the parent's venv — avoids
            # spawning a system Python that wouldn't have `mcp` installed.
            command=sys.executable,
            args=["-m", "src.mcp_server.erp_tools"],
            env={
                "MCP_ERP_JWT": jwt,
                "MCP_ERP_API_BASE_URL": settings.erp_api_base_url,
                "MCP_ERP_DRY_RUN": "true" if dry_run else "false",
            },
        )
        self._stack = AsyncExitStack()
        self._session: ClientSession | None = None
        self._tools: list[Tool] = []

    async def __aenter__(self) -> McpErpClient:
        read, write = await self._stack.enter_async_context(stdio_client(self._params))
        self._session = await self._stack.enter_async_context(ClientSession(read, write))
        await self._session.initialize()
        listing = await self._session.list_tools()
        self._tools = list(listing.tools)
        return self

    async def __aexit__(self, *_: object) -> None:
        await self._stack.aclose()

    # ── introspection used by the agent loop ────────────────────────────

    def tool_names(self) -> set[str]:
        return {t.name for t in self._tools}

    def owns(self, name: str) -> bool:
        return name in self.tool_names()

    def openai_schemas(self) -> list[dict[str, Any]]:
        """Translate MCP `Tool` descriptors into the OpenAI function-calling
        shape LiteLLM expects. FastMCP already emits JSON Schema; we just
        re-wrap it."""
        out: list[dict[str, Any]] = []
        for t in self._tools:
            schema = dict(t.inputSchema) if t.inputSchema else {"type": "object"}
            # OpenAI's schema validator rejects stray "title" fields at the root.
            schema.pop("title", None)
            out.append(
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description or "",
                        "parameters": schema,
                    },
                }
            )
        return out

    # ── dispatch ────────────────────────────────────────────────────────

    async def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Invoke a remote tool; normalize the result back into a plain dict
        the agent can serialize into a tool-message."""
        if self._session is None:
            raise RuntimeError("McpErpClient used outside its async-with block.")

        result = await self._session.call_tool(name, arguments=arguments)

        # FastMCP may return either structured JSON (when the tool's return
        # type is a Pydantic model) or a single TextContent carrying a JSON
        # blob. Our handlers return plain dicts, which land as text — parse
        # it. `isError=True` still carries content, so bubble it as an error.
        if result.isError:
            payload = _first_text(result.content) or ""
            return {"error": payload or f"MCP tool {name} returned error."}

        structured = getattr(result, "structuredContent", None)
        if structured is not None:
            # FastMCP wraps dict returns as {"result": {...}} in the
            # structured payload; unwrap once for ergonomic tool messages.
            if isinstance(structured, dict) and set(structured.keys()) == {"result"}:
                inner = structured["result"]
                return inner if isinstance(inner, dict) else {"result": inner}
            return structured if isinstance(structured, dict) else {"result": structured}

        text = _first_text(result.content)
        if text is None:
            return {}
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {"text": text}
        return parsed if isinstance(parsed, dict) else {"result": parsed}


def _first_text(content: list[Any]) -> str | None:
    for part in content or []:
        text = getattr(part, "text", None)
        if text:
            return str(text)
    return None
