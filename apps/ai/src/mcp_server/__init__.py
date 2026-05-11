"""MCP servers exposed by this app.

Phase 5: `erp_tools` — wraps the 5 Phase-2 ERP tools as an MCP stdio
server. The agent in this same repo consumes it via
`src/agent/mcp_client.py`, and external clients (Claude Desktop) can
register it through `docs/claude_desktop_config.example.json`.

Phase 6: `google_workspace` — Gmail / Drive / Calendar (per-user OAuth).
         `whatsapp` — WhatsApp Business via Meta Graph API (system token).
Both are consumed by `src/agent/mcp_hub.py` (multi-server MCP hub).
"""
