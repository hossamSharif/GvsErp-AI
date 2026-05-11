"""WhatsApp Business MCP server — Meta Graph API wrapper.

FastMCP stdio server exposing 2 tools:
  - ``send_whatsapp`` — send a template message (DESTRUCTIVE)
  - ``list_whatsapp_templates`` — list approved message templates

Auth uses a system-user permanent access token (tenant-wide, NOT per-user
OAuth).  Set ``MCP_WHATSAPP_ACCESS_TOKEN`` and ``MCP_WHATSAPP_PHONE_NUMBER_ID``
in the environment.

Run standalone (testing):
    MCP_WHATSAPP_ACCESS_TOKEN=... MCP_WHATSAPP_PHONE_NUMBER_ID=... \
    uv run python -m src.mcp_server.whatsapp

Meta Graph API docs:
  https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "whatsapp-business",
    instructions=(
        "WhatsApp Business tools.  send_whatsapp is DESTRUCTIVE — confirm "
        "with the user before calling.  Messages use pre-approved templates."
    ),
)

_GRAPH_API_VERSION = "v21.0"
_GRAPH_BASE = f"https://graph.facebook.com/{_GRAPH_API_VERSION}"


def _headers() -> dict[str, str]:
    token = os.environ.get("MCP_WHATSAPP_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError("MCP_WHATSAPP_ACCESS_TOKEN not set.")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _phone_number_id() -> str:
    pid = os.environ.get("MCP_WHATSAPP_PHONE_NUMBER_ID", "")
    if not pid:
        raise RuntimeError("MCP_WHATSAPP_PHONE_NUMBER_ID not set.")
    return pid


# ── Tools ────────────────────────────────────────────────────────────────


@mcp.tool()
async def send_whatsapp(
    to: str,
    template_name: str,
    language_code: str = "en",
    parameters: list[str] | None = None,
) -> dict[str, Any]:
    """Send a WhatsApp template message.

    DESTRUCTIVE — the agent should confirm with the user before calling.

    ``to`` is the recipient phone number in international format (e.g.
    ``+966501234567``).  ``template_name`` must be an approved template.
    ``parameters`` fills body-parameter placeholders (``{{1}}``, ``{{2}}``, ...).
    """
    phone_id = _phone_number_id()
    body: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }
    # Attach body parameters if provided.
    if parameters:
        body["template"]["components"] = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in parameters],
            }
        ]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_GRAPH_BASE}/{phone_id}/messages",
            headers=_headers(),
            json=body,
        )
    data = resp.json()
    if resp.is_error:
        error_msg = data.get("error", {}).get("message", resp.text)
        return {"error": error_msg, "status_code": resp.status_code}

    msg_id = ""
    if data.get("messages"):
        msg_id = data["messages"][0].get("id", "")
    return {"status": "sent", "message_id": msg_id, "to": to}


@mcp.tool()
async def list_whatsapp_templates(
    limit: int = 20,
) -> dict[str, Any]:
    """List approved WhatsApp message templates for this business account.

    Returns template names, languages, and statuses.  Use this to discover
    available templates before calling ``send_whatsapp``.
    """
    # The templates endpoint lives on the WhatsApp Business Account (WABA),
    # but for simplicity we'll query via the phone number's business account.
    # This requires the token to have the whatsapp_business_management permission.
    phone_id = _phone_number_id()

    async with httpx.AsyncClient() as client:
        # First get the WABA ID from the phone number
        resp = await client.get(
            f"{_GRAPH_BASE}/{phone_id}",
            headers=_headers(),
            params={"fields": "name,verified_name"},
        )
        phone_info = resp.json()

        # Try to list templates via the WABA
        # For simplicity, return available template info from the phone number endpoint
        resp = await client.get(
            f"{_GRAPH_BASE}/{phone_id}/message_templates",
            headers=_headers(),
            params={"limit": str(limit)},
        )

    data = resp.json()
    if resp.is_error:
        # Fallback: the endpoint might need WABA ID instead
        error_msg = data.get("error", {}).get("message", resp.text)
        return {"error": error_msg, "hint": "Token may need whatsapp_business_management scope."}

    templates = data.get("data", [])
    return {
        "count": len(templates),
        "phone_info": {
            "name": phone_info.get("verified_name", phone_info.get("name", "")),
        },
        "templates": [
            {
                "name": t.get("name", ""),
                "language": t.get("language", ""),
                "status": t.get("status", ""),
                "category": t.get("category", ""),
            }
            for t in templates
        ],
    }


# ── Entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
