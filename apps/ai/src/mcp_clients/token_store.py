"""Encrypted token vault backed by Supabase `ai_connected_services` table.

Tokens are Fernet-encrypted in Python before INSERT — the database only ever
sees opaque ciphertext.  Fernet is symmetric AES-128-CBC with HMAC-SHA256
(from the `cryptography` package).  The encryption key lives in
TOKEN_ENCRYPTION_KEY (env / .env).

Usage:
    from src.mcp_clients.token_store import save_tokens, load_tokens

    await save_tokens(supabase, user_id, tenant_id, "gmail",
                      {"access_token": "...", "refresh_token": "..."},
                      scopes=["https://www.googleapis.com/auth/gmail.send"])

    tokens = await load_tokens(supabase, user_id, "gmail")
    # tokens == {"access_token": "...", "refresh_token": "..."} or None
"""

from __future__ import annotations

import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from src.config import settings

# ---------------------------------------------------------------------------
# Encrypt / decrypt helpers
# ---------------------------------------------------------------------------


def _fernet() -> Fernet:
    key = settings.token_encryption_key
    if not key:
        raise RuntimeError(
            "TOKEN_ENCRYPTION_KEY is not set.  Generate one with:\n"
            '  python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode())


def encrypt_tokens(tokens: dict[str, Any]) -> str:
    """Return a base64 Fernet ciphertext string (safe for TEXT column)."""
    return _fernet().encrypt(json.dumps(tokens).encode()).decode()


def decrypt_tokens(ciphertext: str) -> dict[str, Any]:
    """Decrypt a ciphertext string back into the token dict.

    Raises ``InvalidToken`` if the key is wrong or the data is corrupted.
    """
    plaintext = _fernet().decrypt(ciphertext.encode())
    data = json.loads(plaintext)
    if not isinstance(data, dict):
        raise InvalidToken("Decrypted payload is not a JSON object.")
    return data


# ---------------------------------------------------------------------------
# Supabase CRUD wrappers (synchronous — Supabase-py client is sync)
# ---------------------------------------------------------------------------

_TABLE = "ai_connected_services"


def save_tokens(
    supabase: Any,
    user_id: str,
    tenant_id: str,
    service: str,
    tokens: dict[str, Any],
    scopes: list[str] | None = None,
) -> None:
    """Upsert encrypted tokens for *service*.  Overwrites if exists."""
    row = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "service": service,
        "encrypted_tokens": encrypt_tokens(tokens),
        "scopes": scopes or [],
        "updated_at": "now()",
    }
    supabase.table(_TABLE).upsert(row, on_conflict="user_id,service").execute()


def load_tokens(supabase: Any, user_id: str, service: str) -> dict[str, Any] | None:
    """Return decrypted token dict, or ``None`` if the service isn't connected."""
    resp = (
        supabase.table(_TABLE)
        .select("encrypted_tokens")
        .eq("user_id", user_id)
        .eq("service", service)
        .maybe_single()
        .execute()
    )
    if resp.data is None:
        return None
    try:
        return decrypt_tokens(resp.data["encrypted_tokens"])
    except (InvalidToken, KeyError):
        return None


def delete_tokens(supabase: Any, user_id: str, service: str) -> None:
    """Disconnect a service — remove the stored tokens."""
    supabase.table(_TABLE).delete().eq("user_id", user_id).eq("service", service).execute()


def list_connected_services(supabase: Any, user_id: str) -> list[str]:
    """Return the list of service names the user has connected."""
    resp = (
        supabase.table(_TABLE)
        .select("service")
        .eq("user_id", user_id)
        .execute()
    )
    return [row["service"] for row in (resp.data or [])]
