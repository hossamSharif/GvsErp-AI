"""Long-term per-user memory backed by the ``ai_user_memory`` table.

Persistent key/value facts about the user that survive across chat sessions —
"preferred_currency=USD", "reply_language=ar", "default_warehouse=<uuid>".

The Phase 7 LangGraph agent calls :func:`list_memory` on entry and prepends
:func:`format_for_prompt` to the system prompt; tools (or the user via the
sidebar) call :func:`save_memory` to record new facts.

Supabase RLS scopes every read/write to the caller's user_id+tenant_id, so
these helpers don't need to filter manually.
"""

from __future__ import annotations

from typing import Any

_TABLE = "ai_user_memory"


def list_memory(supabase: Any, user_id: str) -> list[dict[str, Any]]:
    """Return the user's memory facts as ``[{key, value, updated_at}, …]``.

    Returns an empty list on any failure (table missing, RLS denies, etc.) so
    the agent can keep functioning even before migration 017 is applied.
    """
    if supabase is None or not user_id:
        return []
    try:
        resp = (
            supabase.table(_TABLE)
            .select("key, value, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
    except Exception:
        return []
    return list(resp.data or [])


def save_memory(
    supabase: Any,
    user_id: str,
    tenant_id: str,
    key: str,
    value: str,
) -> None:
    """Upsert one memory fact.  No-op if any required arg is empty."""
    if supabase is None or not user_id or not tenant_id or not key:
        return
    row = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "key": key,
        "value": value,
        "updated_at": "now()",
    }
    supabase.table(_TABLE).upsert(row, on_conflict="user_id,key").execute()


def delete_memory(supabase: Any, user_id: str, key: str) -> None:
    """Forget a fact."""
    if supabase is None or not user_id or not key:
        return
    supabase.table(_TABLE).delete().eq("user_id", user_id).eq("key", key).execute()


def format_for_prompt(facts: list[dict[str, Any]]) -> str:
    """Render facts as a system-message block.  Empty string if no facts."""
    lines = [f"- {f['key']}: {f['value']}" for f in facts if f.get("key")]
    if not lines:
        return ""
    header = "Known facts about this user (carry these over from prior conversations):"
    return header + "\n" + "\n".join(lines)
