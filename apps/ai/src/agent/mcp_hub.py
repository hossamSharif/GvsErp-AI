"""Multi-MCP hub — manages multiple MCP server connections.

Phase 5 had a single ``McpErpClient``.  Phase 6 adds Google Workspace and
WhatsApp servers.  ``McpHub`` generalises the pattern: it spawns all
configured MCP servers as subprocesses, caches their tool lists, and routes
tool calls to the correct server.

It also tracks which tools are *destructive* (send email, upload file, etc.)
so the agent loop can gate them behind user confirmation.

Usage:
    configs = build_mcp_configs(jwt, dry_run, google_tokens, whatsapp_ok)
    async with McpHub(configs) as hub:
        schemas = hub.all_schemas()          # merged OpenAI function schemas
        owner   = hub.owner_of("send_email") # "google" or None
        result  = await hub.call("send_email", {...})
"""

from __future__ import annotations

import json
import sys
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from src.config import settings

# Tools that perform irreversible actions — the agent loop should confirm
# with the user before executing these.
DESTRUCTIVE_TOOLS: set[str] = {
    # Gmail
    "send_email",
    # Drive
    "upload_to_drive",
    # Calendar
    "create_calendar_event",
    # WhatsApp
    "send_whatsapp",
    # ERP (Phase 2)
    "create_invoice",
}


@dataclass
class McpServerConfig:
    """Describes one MCP server to spawn."""

    name: str  # "erp", "google", "whatsapp"
    module: str  # Python module path, e.g. "src.mcp_server.erp_tools"
    env: dict[str, str] = field(default_factory=dict)


@dataclass
class _LiveServer:
    """Runtime state for a spawned MCP server."""

    config: McpServerConfig
    session: ClientSession
    tool_names: set[str] = field(default_factory=set)
    schemas: list[dict[str, Any]] = field(default_factory=list)


class McpHub:
    """Async context manager that spawns and manages multiple MCP servers."""

    def __init__(self, configs: list[McpServerConfig]) -> None:
        self._configs = configs
        self._stack = AsyncExitStack()
        self._servers: dict[str, _LiveServer] = {}
        # Reverse lookup: tool_name → server_name
        self._tool_to_server: dict[str, str] = {}

    async def __aenter__(self) -> McpHub:
        for cfg in self._configs:
            try:
                params = StdioServerParameters(
                    command=sys.executable,
                    args=["-m", cfg.module],
                    env=cfg.env,
                )
                read, write = await self._stack.enter_async_context(stdio_client(params))
                session = await self._stack.enter_async_context(ClientSession(read, write))
                await session.initialize()
                listing = await session.list_tools()
                tools = list(listing.tools)

                # Translate MCP schemas → OpenAI function-calling shape
                schemas: list[dict[str, Any]] = []
                names: set[str] = set()
                for t in tools:
                    schema = dict(t.inputSchema) if t.inputSchema else {"type": "object"}
                    schema.pop("title", None)
                    schemas.append(
                        {
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "description": t.description or "",
                                "parameters": schema,
                            },
                        }
                    )
                    names.add(t.name)
                    self._tool_to_server[t.name] = cfg.name

                self._servers[cfg.name] = _LiveServer(
                    config=cfg, session=session, tool_names=names, schemas=schemas
                )
            except Exception as exc:
                # Don't let one broken server kill the whole hub — log and skip.
                import sys as _sys

                print(
                    f"[McpHub] Failed to start MCP server '{cfg.name}': {exc}",
                    file=_sys.stderr,
                )
        return self

    async def __aexit__(self, *_: object) -> None:
        await self._stack.aclose()

    # ── Introspection ────────────────────────────────────────────────────

    def all_schemas(self) -> list[dict[str, Any]]:
        """Merged OpenAI tool schemas from all live servers."""
        out: list[dict[str, Any]] = []
        for srv in self._servers.values():
            out.extend(srv.schemas)
        return out

    def tool_names(self) -> set[str]:
        return set(self._tool_to_server.keys())

    def owns(self, tool_name: str) -> bool:
        return tool_name in self._tool_to_server

    def owner_of(self, tool_name: str) -> str | None:
        return self._tool_to_server.get(tool_name)

    def is_destructive(self, tool_name: str) -> bool:
        return tool_name in DESTRUCTIVE_TOOLS

    # ── Dispatch ─────────────────────────────────────────────────────────

    async def call(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Route a tool call to the correct MCP server."""
        server_name = self._tool_to_server.get(tool_name)
        if server_name is None:
            return {"error": f"No MCP server owns tool '{tool_name}'."}
        srv = self._servers.get(server_name)
        if srv is None:
            return {"error": f"MCP server '{server_name}' is not running."}

        result = await srv.session.call_tool(tool_name, arguments=arguments)

        # Normalise response (same logic as McpErpClient.call)
        if result.isError:
            payload = _first_text(result.content) or ""
            return {"error": payload or f"MCP tool {tool_name} returned error."}

        structured = getattr(result, "structuredContent", None)
        if structured is not None:
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


# ── Config builder ───────────────────────────────────────────────────────


def build_mcp_configs(
    jwt: str,
    *,
    dry_run: bool = False,
    google_tokens: dict[str, Any] | None = None,
    whatsapp_enabled: bool = False,
) -> list[McpServerConfig]:
    """Build the list of MCP server configs to spawn for this agent turn.

    - ERP server is always included (needs JWT).
    - Google Workspace server is included only if ``google_tokens`` is provided.
    - WhatsApp server is included only if env vars are set.
    """
    configs: list[McpServerConfig] = []

    # ERP tools (always on — Phase 5)
    configs.append(
        McpServerConfig(
            name="erp",
            module="src.mcp_server.erp_tools",
            env={
                "MCP_ERP_JWT": jwt,
                "MCP_ERP_API_BASE_URL": settings.erp_api_base_url,
                "MCP_ERP_DRY_RUN": "true" if dry_run else "false",
            },
        )
    )

    # Google Workspace (Gmail / Drive / Calendar) — needs per-user OAuth tokens
    if google_tokens:
        configs.append(
            McpServerConfig(
                name="google",
                module="src.mcp_server.google_workspace",
                env={
                    "MCP_GOOGLE_ACCESS_TOKEN": google_tokens.get("access_token", ""),
                    "MCP_GOOGLE_REFRESH_TOKEN": google_tokens.get("refresh_token", ""),
                    "MCP_GOOGLE_CLIENT_ID": (
                        google_tokens.get("client_id", settings.google_oauth_client_id)
                    ),
                    "MCP_GOOGLE_CLIENT_SECRET": (
                        google_tokens.get("client_secret", settings.google_oauth_client_secret)
                    ),
                },
            )
        )

    # WhatsApp Business — uses tenant-wide system token from env
    if whatsapp_enabled and settings.whatsapp_access_token and settings.whatsapp_phone_number_id:
        configs.append(
            McpServerConfig(
                name="whatsapp",
                module="src.mcp_server.whatsapp",
                env={
                    "MCP_WHATSAPP_ACCESS_TOKEN": settings.whatsapp_access_token,
                    "MCP_WHATSAPP_PHONE_NUMBER_ID": settings.whatsapp_phone_number_id,
                },
            )
        )

    return configs
