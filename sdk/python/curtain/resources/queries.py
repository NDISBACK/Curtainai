"""Queries resource — run decisions, browse history, submit overrides."""
from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional

from pydantic import TypeAdapter

from .._http import AsyncHttpTransport, HttpTransport
from ..models import Override, QueryRecord, QueryResult
from ..pagination import AsyncPaginator, SyncPaginator, _PageResponse

_result_adapter: TypeAdapter[QueryResult] = TypeAdapter(QueryResult)
_record_adapter: TypeAdapter[QueryRecord] = TypeAdapter(QueryRecord)
_override_adapter: TypeAdapter[Override] = TypeAdapter(Override)


class QueriesResource:
    """
    Run the Curtain decision engine and manage query history.

    The :meth:`run` method is the primary integration point for chatbots and
    support pipelines.
    """

    def __init__(self, http: HttpTransport) -> None:
        self._http = http

    def run(self, query: str) -> QueryResult:
        """
        Run a customer query through the active skill set.

        The engine embeds the query, ranks candidate skills via hybrid search
        (Jaccard + vector), and uses an LLM to pick the best match.

        :param query: Natural-language description of the customer's situation.
        :returns:     :class:`~curtain.models.QueryResult` with decision,
                      confidence, and escalation flag.

        Example::

            result = client.queries.run("Customer was double-charged in April")
            if result.escalate:
                route_to_human_agent(result.query_id)
            else:
                send_decision(result.decision)  # confidence: result.confidence
        """
        data = self._http.post("/query", json={"query": query})
        return _result_adapter.validate_python(data)

    def list(
        self,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        escalated: Optional[bool] = None,
        skill_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[QueryRecord]:
        """
        Fetch one page of historical query records.

        :param from_:     ISO 8601 start datetime filter (inclusive).
        :param to:        ISO 8601 end datetime filter (inclusive).
        :param escalated: ``True`` → only escalated, ``False`` → only matched.
        :param skill_id:  Filter to queries matched by a specific skill.
        """
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        if escalated is not None:
            params["escalated"] = str(escalated).lower()
        if skill_id:
            params["skill_id"] = skill_id

        raw = self._http.get("/queries", params=params)
        # Server returns { data: [...], total, page, limit }
        if isinstance(raw, dict):
            items = raw.get("data", [])
        else:
            items = raw or []
        ta: TypeAdapter[List[QueryRecord]] = TypeAdapter(List[QueryRecord])
        return ta.validate_python(items)

    def iter(
        self,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        escalated: Optional[bool] = None,
        skill_id: Optional[str] = None,
        page_size: int = 20,
    ) -> SyncPaginator[QueryRecord]:
        """
        Lazy iterator over all matching query records::

            for record in client.queries.iter(escalated=True):
                review(record)
        """

        def _fetch(page: int, limit: int) -> _PageResponse:
            params: Dict[str, Any] = {"page": page, "limit": limit}
            if from_:
                params["from"] = from_
            if to:
                params["to"] = to
            if escalated is not None:
                params["escalated"] = str(escalated).lower()
            if skill_id:
                params["skill_id"] = skill_id
            raw = self._http.get("/queries", params=params)
            if isinstance(raw, dict):
                return _PageResponse(
                    raw.get("data", []),
                    total=raw.get("total", 0),
                    page=raw.get("page", page),
                    limit=raw.get("limit", limit),
                )
            return _PageResponse(raw or [], total=len(raw or []), page=page, limit=limit)

        return SyncPaginator(_fetch, QueryRecord, limit=page_size)

    def override(self, query_id: str, corrected_decision: str) -> Override:
        """
        Submit a human-reviewed correction for a decision.

        The correction is stored and may be used to generate a new
        ``pending_review`` skill automatically.

        :param query_id:            UUID of the query to correct.
        :param corrected_decision:  The decision text that should have been returned.
        """
        data = self._http.post(
            "/query/override",
            json={"query_id": query_id, "corrected_decision": corrected_decision},
        )
        return _override_adapter.validate_python(data["override"] if isinstance(data, dict) and "override" in data else data)


# ─── Async mirror ─────────────────────────────────────────────────────────────

class AsyncQueriesResource:
    """Async mirror of :class:`QueriesResource`."""

    def __init__(self, http: AsyncHttpTransport) -> None:
        self._http = http

    async def run(self, query: str) -> QueryResult:
        data = await self._http.post("/query", json={"query": query})
        return _result_adapter.validate_python(data)

    async def list(
        self,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        escalated: Optional[bool] = None,
        skill_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[QueryRecord]:
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        if escalated is not None:
            params["escalated"] = str(escalated).lower()
        if skill_id:
            params["skill_id"] = skill_id
        raw = await self._http.get("/queries", params=params)
        items = raw.get("data", []) if isinstance(raw, dict) else (raw or [])
        ta: TypeAdapter[List[QueryRecord]] = TypeAdapter(List[QueryRecord])
        return ta.validate_python(items)

    def iter(
        self,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        escalated: Optional[bool] = None,
        skill_id: Optional[str] = None,
        page_size: int = 20,
    ) -> AsyncPaginator[QueryRecord]:
        async def _fetch(page: int, limit: int) -> _PageResponse:
            params: Dict[str, Any] = {"page": page, "limit": limit}
            if from_:
                params["from"] = from_
            if to:
                params["to"] = to
            if escalated is not None:
                params["escalated"] = str(escalated).lower()
            if skill_id:
                params["skill_id"] = skill_id
            raw = await self._http.get("/queries", params=params)
            if isinstance(raw, dict):
                return _PageResponse(
                    raw.get("data", []),
                    total=raw.get("total", 0),
                    page=raw.get("page", page),
                    limit=raw.get("limit", limit),
                )
            return _PageResponse(raw or [], total=len(raw or []), page=page, limit=limit)

        return AsyncPaginator(_fetch, QueryRecord, limit=page_size)

    async def override(self, query_id: str, corrected_decision: str) -> Override:
        data = await self._http.post(
            "/query/override",
            json={"query_id": query_id, "corrected_decision": corrected_decision},
        )
        return _override_adapter.validate_python(data["override"] if isinstance(data, dict) and "override" in data else data)
