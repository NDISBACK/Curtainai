"""Top-level client classes — sync and async."""
from __future__ import annotations

import os
from typing import Optional

from ._http import AsyncHttpTransport, HttpTransport
from .resources.analytics import AnalyticsResource, AsyncAnalyticsResource
from .resources.extraction import AsyncExtractionResource, ExtractionResource
from .resources.queries import AsyncQueriesResource, QueriesResource
from .resources.simulation import AsyncSimulationResource, SimulationResource
from .resources.skills import AsyncSkillsResource, SkillsResource
from .resources.workspaces import AsyncWorkspacesResource, WorkspacesResource

_DEFAULT_BASE_URL = "http://localhost:3000/api/v1"


class CurtainClient:
    """
    Synchronous Curtain API client.

    Usage::

        import os
        from curtain import CurtainClient

        client = CurtainClient(
            api_key=os.environ["CURTAIN_API_KEY"],
            workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
        )

        result = client.queries.run("Customer was double-charged in April")
        if result.escalate:
            route_to_human(result.query_id)
        else:
            send_to_customer(result.decision)

    Use as a context manager to ensure the underlying session is closed::

        with CurtainClient(api_key=...) as client:
            skills = list(client.skills.iter(status="active"))
    """

    skills: SkillsResource
    queries: QueriesResource
    workspaces: WorkspacesResource
    analytics: AnalyticsResource
    extraction: ExtractionResource
    simulation: SimulationResource

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        workspace_id: Optional[str] = None,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        """
        :param api_key:      API key (``cai_<64 hex>``).  Falls back to the
            ``CURTAIN_API_KEY`` environment variable when omitted.
        :param workspace_id: Default workspace UUID.  Falls back to the
            ``CURTAIN_WORKSPACE_ID`` environment variable when omitted.
            Not required — you can pass workspace IDs directly to each call.
        :param base_url:     API base URL (default: ``http://localhost:3000/api/v1``).
            Override with the ``CURTAIN_BASE_URL`` environment variable or pass
            explicitly for production deployments.
        :param timeout:      Per-request timeout in seconds (default 30).
        """
        resolved_key = api_key or os.environ.get("CURTAIN_API_KEY", "")
        resolved_url = base_url or os.environ.get("CURTAIN_BASE_URL", _DEFAULT_BASE_URL)

        self._http = HttpTransport(
            api_key=resolved_key,
            base_url=resolved_url,
            timeout=timeout,
        )
        self._workspace_id = workspace_id or os.environ.get("CURTAIN_WORKSPACE_ID")

        self.skills = SkillsResource(self._http, self._workspace_id)
        self.queries = QueriesResource(self._http)
        self.workspaces = WorkspacesResource(self._http)
        self.analytics = AnalyticsResource(self._http)
        self.extraction = ExtractionResource(self._http)
        self.simulation = SimulationResource(self._http)

    # ── Context manager ────────────────────────────────────────────────────

    def __enter__(self) -> "CurtainClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        """Close the underlying HTTP session and release connections."""
        self._http.close()

    # ── Convenience ────────────────────────────────────────────────────────

    @property
    def workspace_id(self) -> Optional[str]:
        """Default workspace ID provided at construction time."""
        return self._workspace_id

    def __repr__(self) -> str:
        masked = "cai_***" if self._http._api_key else "<no key>"
        return f"CurtainClient(api_key={masked!r}, base_url={self._http._base_url!r})"


class AsyncCurtainClient:
    """
    Asynchronous Curtain API client for use with ``asyncio`` and frameworks
    like FastAPI, aiohttp, or Starlette.

    Usage::

        import asyncio, os
        from curtain import AsyncCurtainClient

        async def main():
            async with AsyncCurtainClient(
                api_key=os.environ["CURTAIN_API_KEY"],
                workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
            ) as client:
                result = await client.queries.run("Double-charge refund request")
                print(result.decision)

        asyncio.run(main())

    All resource methods are coroutines — remember to ``await`` them.
    """

    skills: AsyncSkillsResource
    queries: AsyncQueriesResource
    workspaces: AsyncWorkspacesResource
    analytics: AsyncAnalyticsResource
    extraction: AsyncExtractionResource
    simulation: AsyncSimulationResource

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        workspace_id: Optional[str] = None,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        """
        Same parameters as :class:`CurtainClient`.
        """
        resolved_key = api_key or os.environ.get("CURTAIN_API_KEY", "")
        resolved_url = base_url or os.environ.get("CURTAIN_BASE_URL", _DEFAULT_BASE_URL)

        self._http = AsyncHttpTransport(
            api_key=resolved_key,
            base_url=resolved_url,
            timeout=timeout,
        )
        self._workspace_id = workspace_id or os.environ.get("CURTAIN_WORKSPACE_ID")

        self.skills = AsyncSkillsResource(self._http, self._workspace_id)
        self.queries = AsyncQueriesResource(self._http)
        self.workspaces = AsyncWorkspacesResource(self._http)
        self.analytics = AsyncAnalyticsResource(self._http)
        self.extraction = AsyncExtractionResource(self._http)
        self.simulation = AsyncSimulationResource(self._http)

    # ── Async context manager ──────────────────────────────────────────────

    async def __aenter__(self) -> "AsyncCurtainClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the underlying async HTTP client."""
        await self._http.close()

    # ── Convenience ────────────────────────────────────────────────────────

    @property
    def workspace_id(self) -> Optional[str]:
        return self._workspace_id

    def __repr__(self) -> str:
        masked = "cai_***" if self._http._api_key else "<no key>"
        return f"AsyncCurtainClient(api_key={masked!r}, base_url={self._http._base_url!r})"
