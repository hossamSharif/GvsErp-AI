"""Google Workspace MCP server — Gmail, Drive, Calendar.

FastMCP stdio server exposing 6 tools for interacting with Google APIs.
Auth is env-driven: the parent process (McpHub) passes decrypted OAuth
tokens as environment variables when spawning this subprocess.

Run standalone (testing):
    MCP_GOOGLE_ACCESS_TOKEN=... MCP_GOOGLE_REFRESH_TOKEN=... \
    MCP_GOOGLE_CLIENT_ID=... MCP_GOOGLE_CLIENT_SECRET=... \
    uv run python -m src.mcp_server.google_workspace

The server refreshes the access token internally if it detects expiry.
"""

from __future__ import annotations

import base64
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Literal

import google.auth.transport.requests
import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "google-workspace",
    instructions=(
        "Google Workspace tools for Gmail, Drive, and Calendar.  "
        "Tools that send, upload, or create are DESTRUCTIVE — confirm with the "
        "user before calling them."
    ),
)

# ── Auth ─────────────────────────────────────────────────────────────────

_TOKEN_URI = "https://oauth2.googleapis.com/token"


def _credentials() -> Credentials:
    """Build OAuth credentials from env vars.  Refreshes if expired."""
    creds = Credentials(
        token=os.environ.get("MCP_GOOGLE_ACCESS_TOKEN", ""),
        refresh_token=os.environ.get("MCP_GOOGLE_REFRESH_TOKEN", ""),
        token_uri=_TOKEN_URI,
        client_id=os.environ.get("MCP_GOOGLE_CLIENT_ID", ""),
        client_secret=os.environ.get("MCP_GOOGLE_CLIENT_SECRET", ""),
    )
    if creds.expired or not creds.valid:
        creds.refresh(google.auth.transport.requests.Request())
        # Persist the refreshed token back into the env so subsequent calls
        # within this process lifetime don't re-refresh.
        os.environ["MCP_GOOGLE_ACCESS_TOKEN"] = creds.token or ""
    return creds


# ── Gmail tools ──────────────────────────────────────────────────────────


@mcp.tool()
async def send_email(
    to: str,
    subject: str,
    body: str,
    cc: str | None = None,
    bcc: str | None = None,
    attachment_url: str | None = None,
) -> dict:
    """Send an email via Gmail.

    DESTRUCTIVE — the agent should confirm with the user before calling.

    If ``attachment_url`` is provided (a public URL or Supabase signed URL),
    the file is downloaded and attached.
    """
    creds = _credentials()
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    msg = MIMEMultipart() if attachment_url else MIMEText(body, "html")
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc

    if attachment_url:
        msg.attach(MIMEText(body, "html"))
        async with httpx.AsyncClient() as client:
            resp = await client.get(attachment_url, follow_redirects=True)
            resp.raise_for_status()
        from email.mime.application import MIMEApplication

        filename = attachment_url.rsplit("/", 1)[-1].split("?")[0] or "attachment"
        att = MIMEApplication(resp.content, Name=filename)
        att["Content-Disposition"] = f'attachment; filename="{filename}"'
        msg.attach(att)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"status": "sent", "message_id": result.get("id", "")}


@mcp.tool()
async def list_emails(
    query: str = "is:inbox",
    max_results: int = 10,
) -> dict:
    """Search and list emails from Gmail.

    ``query`` uses Gmail search syntax (e.g. ``from:boss subject:urgent``).
    """
    creds = _credentials()
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    resp = service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
    messages = resp.get("messages", [])
    results = []
    for m in messages[:max_results]:
        detail = service.users().messages().get(userId="me", id=m["id"], format="metadata").execute()
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        results.append({
            "id": m["id"],
            "from": headers.get("From", ""),
            "subject": headers.get("Subject", ""),
            "date": headers.get("Date", ""),
            "snippet": detail.get("snippet", ""),
        })
    return {"count": len(results), "emails": results}


# ── Drive tools ──────────────────────────────────────────────────────────


@mcp.tool()
async def upload_to_drive(
    file_url: str,
    filename: str,
    folder_path: str = "",
    mime_type: str = "application/pdf",
) -> dict:
    """Upload a file to Google Drive.

    DESTRUCTIVE — the agent should confirm with the user before calling.

    ``file_url`` is a public URL or Supabase signed URL to download the file
    from.  ``folder_path`` like ``/Reports/2026-Q2`` creates folders as needed.
    """
    creds = _credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    # Download the file content
    async with httpx.AsyncClient() as client:
        resp = await client.get(file_url, follow_redirects=True)
        resp.raise_for_status()
    file_content = resp.content

    # Resolve or create the folder hierarchy
    parent_id = "root"
    if folder_path:
        parts = [p for p in folder_path.strip("/").split("/") if p]
        for part in parts:
            query = (
                f"name='{part}' and '{parent_id}' in parents "
                f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
            )
            existing = service.files().list(q=query, fields="files(id)").execute()
            if existing.get("files"):
                parent_id = existing["files"][0]["id"]
            else:
                folder_meta = {
                    "name": part,
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [parent_id],
                }
                created = service.files().create(body=folder_meta, fields="id").execute()
                parent_id = created["id"]

    media = MediaInMemoryUpload(file_content, mimetype=mime_type, resumable=False)
    file_meta = {"name": filename, "parents": [parent_id]}
    result = service.files().create(body=file_meta, media_body=media, fields="id,webViewLink").execute()
    return {
        "status": "uploaded",
        "file_id": result["id"],
        "web_link": result.get("webViewLink", ""),
        "folder": folder_path or "/",
    }


@mcp.tool()
async def list_drive_files(
    folder_path: str = "",
    max_results: int = 20,
) -> dict:
    """List files in a Google Drive folder.

    ``folder_path`` like ``/Reports`` navigates into that folder.
    Empty string = root.
    """
    creds = _credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    parent_id = "root"
    if folder_path:
        parts = [p for p in folder_path.strip("/").split("/") if p]
        for part in parts:
            query = (
                f"name='{part}' and '{parent_id}' in parents "
                f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
            )
            existing = service.files().list(q=query, fields="files(id)").execute()
            if existing.get("files"):
                parent_id = existing["files"][0]["id"]
            else:
                return {"error": f"Folder '{part}' not found in path '{folder_path}'."}

    query = f"'{parent_id}' in parents and trashed=false"
    resp = service.files().list(
        q=query,
        pageSize=max_results,
        fields="files(id,name,mimeType,modifiedTime,size,webViewLink)",
    ).execute()
    files = resp.get("files", [])
    return {
        "folder": folder_path or "/",
        "count": len(files),
        "files": [
            {
                "id": f["id"],
                "name": f["name"],
                "type": f.get("mimeType", ""),
                "modified": f.get("modifiedTime", ""),
                "size": f.get("size", ""),
                "link": f.get("webViewLink", ""),
            }
            for f in files
        ],
    }


# ── Calendar tools ───────────────────────────────────────────────────────


@mcp.tool()
async def create_calendar_event(
    summary: str,
    start: str,
    end: str,
    description: str = "",
    attendees: list[str] | None = None,
    timezone: str = "Asia/Riyadh",
) -> dict:
    """Create a Google Calendar event.

    DESTRUCTIVE — the agent should confirm with the user before calling.

    ``start`` and ``end`` are ISO 8601 datetime strings (e.g. ``2026-04-25T10:00:00``).
    """
    creds = _credentials()
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    event_body: dict = {
        "summary": summary,
        "start": {"dateTime": start, "timeZone": timezone},
        "end": {"dateTime": end, "timeZone": timezone},
    }
    if description:
        event_body["description"] = description
    if attendees:
        event_body["attendees"] = [{"email": e} for e in attendees]

    result = service.events().insert(calendarId="primary", body=event_body).execute()
    return {
        "status": "created",
        "event_id": result.get("id", ""),
        "link": result.get("htmlLink", ""),
        "start": start,
        "end": end,
    }


@mcp.tool()
async def list_calendar_events(
    max_results: int = 10,
    time_min: str | None = None,
) -> dict:
    """List upcoming events from the primary Google Calendar.

    ``time_min`` is an ISO 8601 datetime; defaults to now.
    """
    import datetime

    creds = _credentials()
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    if not time_min:
        time_min = datetime.datetime.now(datetime.timezone.utc).isoformat()

    resp = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=time_min,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = resp.get("items", [])
    return {
        "count": len(events),
        "events": [
            {
                "id": e.get("id", ""),
                "summary": e.get("summary", ""),
                "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
                "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
                "link": e.get("htmlLink", ""),
            }
            for e in events
        ],
    }


# ── Entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
