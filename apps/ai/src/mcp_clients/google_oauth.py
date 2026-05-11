"""Google OAuth 2.0 helper for Gmail / Drive / Calendar.

Implements the three-legged OAuth flow used by the Streamlit sidebar:

1. ``build_auth_url()`` → user clicks the link, authorizes in Google's UI.
2. Google redirects back with ``?code=...`` in the query string.
3. ``exchange_code(code)`` → swaps the auth code for access + refresh tokens.
4. Tokens are encrypted and persisted via ``token_store.save_tokens``.
5. ``refresh_if_needed(tokens)`` refreshes an expired access_token.

Dependencies: ``google-auth``, ``google-auth-oauthlib``.
"""

from __future__ import annotations

from typing import Any

import google.auth.transport.requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from src.config import settings

# Scopes requested when the user clicks "Connect Google".
# Combine Gmail send, Drive file management, Calendar events.
GOOGLE_SCOPES: list[str] = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def _client_config() -> dict[str, Any]:
    """Build the client config dict expected by google_auth_oauthlib.Flow."""
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise RuntimeError(
            "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set "
            "in apps/ai/.env.  Create them at "
            "https://console.cloud.google.com/apis/credentials."
        )
    return {
        "web": {
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_oauth_redirect_uri],
        }
    }


def build_auth_url() -> str:
    """Return the Google OAuth consent-screen URL the user should visit.

    Includes ``access_type=offline`` so we get a refresh_token, and
    ``prompt=consent`` to force the consent screen every time (guarantees
    we always receive a new refresh_token).
    """
    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )
    url, _state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    return url


def exchange_code(code: str) -> dict[str, Any]:
    """Exchange an authorization code for tokens.

    Returns a dict with ``access_token``, ``refresh_token``, ``token_uri``,
    ``client_id``, ``client_secret``, and ``scopes`` — everything needed
    to reconstruct a ``Credentials`` object later.
    """
    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds: Credentials = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or GOOGLE_SCOPES),
    }


def refresh_if_needed(tokens: dict[str, Any]) -> dict[str, Any]:
    """Refresh the access token if it's expired.  Returns an updated dict.

    Always safe to call — if the token is still valid, this is a no-op.
    """
    creds = Credentials(
        token=tokens.get("access_token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=tokens.get("client_id", settings.google_oauth_client_id),
        client_secret=tokens.get("client_secret", settings.google_oauth_client_secret),
        scopes=tokens.get("scopes", GOOGLE_SCOPES),
    )
    if creds.expired or not creds.valid:
        creds.refresh(google.auth.transport.requests.Request())
        tokens = {**tokens, "access_token": creds.token}
    return tokens
