"""Workspaces and API-key management resource."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import TypeAdapter

from .._http import AsyncHttpTransport, HttpTransport
from ..models import ApiKey, CreatedApiKey, Workspace

_ws_adapter: TypeAdapter[Workspace] = TypeAdapter(Workspace)
_key_adapter: TypeAdapter[ApiKey] = TypeAdapter(ApiKey)
_created_key_adapter: TypeAdapter[CreatedApiKey] = TypeAdapter(CreatedApiKey)


class WorkspacesResource:
    """
    Workspace lifecycle and API key management.

    Note: :meth:`create` does **not** require authentication — it is the
    bootstrap endpoint used to get your first API key.
    """

    def __init__(self, http: HttpTransport) -> None:
        self._http = http

    # ── Workspace CRUD ─────────────────────────────────────────────────────

    def create(self, name: str) -> Workspace:
        """
        Create a new workspace.  No API key required.

        Use :meth:`create_api_key` on the returned workspace to generate your
        first key, or run ``npx tsx scripts/bootstrap-workspace.ts`` from the
        server side.
        """
        data = self._http.post("/workspaces", json={"name": name})
        return _ws_adapter.validate_python(data)

    def get(self, workspace_id: str) -> Workspace:
        """Fetch workspace details by ID."""
        data = self._http.get(f"/workspaces/{workspace_id}")
        return _ws_adapter.validate_python(data)

    def update(
        self,
        workspace_id: str,
        *,
        name: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Workspace:
        """
        Update workspace name and/or query-engine settings.

        ``settings`` keys: ``top_k``, ``duplicate_threshold``, ``hybrid_alpha``.
        Only the keys you provide are updated.
        """
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if settings is not None:
            payload["settings"] = settings
        data = self._http.patch(f"/workspaces/{workspace_id}", json=payload)
        return _ws_adapter.validate_python(data)

    def delete(self, workspace_id: str) -> None:
        """Delete a workspace and all its data (irreversible)."""
        self._http.delete(f"/workspaces/{workspace_id}")

    # ── API Keys ───────────────────────────────────────────────────────────

    def list_api_keys(self, workspace_id: str) -> List[ApiKey]:
        """List all API keys for a workspace (raw key hashes are never returned)."""
        data = self._http.get(f"/workspaces/{workspace_id}/api-keys")
        ta: TypeAdapter[List[ApiKey]] = TypeAdapter(List[ApiKey])
        return ta.validate_python(data if isinstance(data, list) else [])

    def create_api_key(
        self,
        workspace_id: str,
        name: str,
        *,
        expires_at: Optional[str] = None,
    ) -> CreatedApiKey:
        """
        Create a new API key.

        The raw ``key`` field (``cai_<64hex>``) is returned **once** and
        never stored server-side.  Save it immediately.

        :param expires_at: Optional ISO 8601 expiry datetime.
        """
        payload: Dict[str, Any] = {"name": name}
        if expires_at is not None:
            payload["expires_at"] = expires_at
        data = self._http.post(f"/workspaces/{workspace_id}/api-keys", json=payload)
        return _created_key_adapter.validate_python(data)

    def revoke_api_key(self, workspace_id: str, key_id: str) -> None:
        """Revoke an API key immediately (irreversible)."""
        self._http.delete(f"/workspaces/{workspace_id}/api-keys/{key_id}")


# ─── Async mirror ─────────────────────────────────────────────────────────────

class AsyncWorkspacesResource:
    """Async mirror of :class:`WorkspacesResource`."""

    def __init__(self, http: AsyncHttpTransport) -> None:
        self._http = http

    async def create(self, name: str) -> Workspace:
        data = await self._http.post("/workspaces", json={"name": name})
        return _ws_adapter.validate_python(data)

    async def get(self, workspace_id: str) -> Workspace:
        data = await self._http.get(f"/workspaces/{workspace_id}")
        return _ws_adapter.validate_python(data)

    async def update(
        self,
        workspace_id: str,
        *,
        name: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Workspace:
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if settings is not None:
            payload["settings"] = settings
        data = await self._http.patch(f"/workspaces/{workspace_id}", json=payload)
        return _ws_adapter.validate_python(data)

    async def delete(self, workspace_id: str) -> None:
        await self._http.delete(f"/workspaces/{workspace_id}")

    async def list_api_keys(self, workspace_id: str) -> List[ApiKey]:
        data = await self._http.get(f"/workspaces/{workspace_id}/api-keys")
        ta: TypeAdapter[List[ApiKey]] = TypeAdapter(List[ApiKey])
        return ta.validate_python(data if isinstance(data, list) else [])

    async def create_api_key(
        self,
        workspace_id: str,
        name: str,
        *,
        expires_at: Optional[str] = None,
    ) -> CreatedApiKey:
        payload: Dict[str, Any] = {"name": name}
        if expires_at is not None:
            payload["expires_at"] = expires_at
        data = await self._http.post(f"/workspaces/{workspace_id}/api-keys", json=payload)
        return _created_key_adapter.validate_python(data)

    async def revoke_api_key(self, workspace_id: str, key_id: str) -> None:
        await self._http.delete(f"/workspaces/{workspace_id}/api-keys/{key_id}")
