"""Analytics resource — workspace-level metrics."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .._http import AsyncHttpTransport, HttpTransport
from ..models import WorkspaceAnalytics


class AnalyticsResource:
    """Fetch aggregated metrics for a workspace over a date range."""

    def __init__(self, http: HttpTransport) -> None:
        self._http = http

    def get_workspace(
        self,
        workspace_id: str,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
    ) -> WorkspaceAnalytics:
        """
        Fetch workspace-level analytics.

        :param from_: ISO 8601 start datetime (e.g. ``"2024-01-01T00:00:00Z"``).
        :param to:    ISO 8601 end datetime.

        Both parameters are optional.  When omitted the server returns
        all-time totals.

        Example::

            from datetime import datetime, timedelta, timezone

            now = datetime.now(tz=timezone.utc)
            week_ago = now - timedelta(days=7)

            stats = client.analytics.get_workspace(
                workspace_id,
                from_=week_ago.isoformat(),
                to=now.isoformat(),
            )
            print(f"Match rate last 7 days: {stats.match_rate:.1%}")
        """
        params: Dict[str, Any] = {}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        data = self._http.get(
            f"/workspaces/{workspace_id}/analytics", params=params
        )
        return WorkspaceAnalytics.model_validate(data)


class AsyncAnalyticsResource:
    """Async mirror of :class:`AnalyticsResource`."""

    def __init__(self, http: AsyncHttpTransport) -> None:
        self._http = http

    async def get_workspace(
        self,
        workspace_id: str,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
    ) -> WorkspaceAnalytics:
        params: Dict[str, Any] = {}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        data = await self._http.get(
            f"/workspaces/{workspace_id}/analytics", params=params
        )
        return WorkspaceAnalytics.model_validate(data)
