"""Thin async client for the ERP REST API.

Every call goes through `_request`, which attaches the caller's JWT as a
Bearer token so the request hits Express with the user's identity. That's
what makes the chat respect RLS (tenant scoping, permissions).

`dry_run=True` short-circuits mutating verbs (POST/PUT/PATCH/DELETE): instead
of hitting the server, we echo back the would-be request so the agent can
rehearse a create/update without side effects.
"""

from __future__ import annotations

from typing import Any

import httpx

from src.config import settings


class ErpClientError(RuntimeError):
    """Raised when the ERP API returns a non-2xx response."""


class ErpClient:
    def __init__(self, jwt: str, *, base_url: str | None = None, dry_run: bool = False) -> None:
        self._jwt = jwt
        self._dry_run = dry_run
        self._client = httpx.AsyncClient(
            base_url=base_url or settings.erp_api_base_url,
            timeout=30.0,
            headers={"Authorization": f"Bearer {jwt}"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> ErpClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self._dry_run and method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
            return {
                "dry_run": True,
                "method": method.upper(),
                "path": path,
                "params": params,
                "body": json,
            }

        response = await self._client.request(method, path, params=params, json=json)
        if response.status_code >= 400:
            raise ErpClientError(
                f"{method} {path} → {response.status_code}: {response.text[:500]}"
            )
        return response.json()

    # ── parties ────────────────────────────────────────────────────────────

    async def list_parties(
        self,
        *,
        type: str | None = None,
        search: str | None = None,
        has_balance: bool | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if type:
            params["type"] = type
        if search:
            params["search"] = search
        if has_balance is not None:
            params["hasBalance"] = "true" if has_balance else "false"
        return await self._request("GET", "/parties", params=params)

    async def get_party(self, party_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/parties/{party_id}")

    # ── invoices ───────────────────────────────────────────────────────────

    async def list_invoices(
        self,
        *,
        type: str | None = None,
        status: str | None = None,
        party_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if type:
            params["type"] = type
        if status:
            params["status"] = status
        if party_id:
            params["partyId"] = party_id
        return await self._request("GET", "/invoices", params=params)

    async def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/invoices/{invoice_id}")

    async def get_invoice_by_number(self, invoice_number: str) -> dict[str, Any]:
        return await self._request("GET", f"/invoices/by-number/{invoice_number}")

    async def create_invoice(self, body: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/invoices", json=body)
