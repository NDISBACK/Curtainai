"""Skills resource — full CRUD + state machine + versions + analytics."""
from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional

from pydantic import TypeAdapter

from .._http import AsyncHttpTransport, HttpTransport
from ..models import (
    ExportFormat,
    ImportResult,
    ImportSkillPayload,
    Skill,
    SkillAnalytics,
    SkillStatus,
    SkillVersion,
)
from ..pagination import AsyncPaginator, SyncPaginator, _PageResponse

_skill_adapter: TypeAdapter[Skill] = TypeAdapter(Skill)
_version_adapter: TypeAdapter[SkillVersion] = TypeAdapter(SkillVersion)


class SkillsResource:
    """
    Manage decision skills in your workspace.

    All mutating methods (create, update, approve, disable, enable) return
    the updated :class:`~curtain.models.Skill` object.
    """

    def __init__(self, http: HttpTransport, workspace_id: Optional[str]) -> None:
        self._http = http
        self._ws = workspace_id

    # ── CRUD ──────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        name: str,
        trigger_condition: str,
        decision: str,
        conditions: Optional[Dict[str, Any]] = None,
        escalation_required: bool = False,
        confidence: Optional[float] = None,
    ) -> Skill:
        """
        Create a new skill.

        New skills always start in ``pending_review`` status and must be
        approved before they participate in query matching.

        :raises DuplicateSkillError: if a semantically similar skill exists.
        """
        payload: Dict[str, Any] = {
            "name": name,
            "trigger_condition": trigger_condition,
            "decision": decision,
            "escalation_required": escalation_required,
        }
        if conditions is not None:
            payload["conditions"] = conditions
        if confidence is not None:
            payload["confidence"] = confidence
        data = self._http.post("/skills", json=payload)
        return _skill_adapter.validate_python(data)

    def get(self, skill_id: str) -> Skill:
        """Fetch a single skill by ID."""
        data = self._http.get(f"/skills/{skill_id}")
        return _skill_adapter.validate_python(data)

    def update(
        self,
        skill_id: str,
        *,
        name: Optional[str] = None,
        trigger_condition: Optional[str] = None,
        decision: Optional[str] = None,
        conditions: Optional[Dict[str, Any]] = None,
        escalation_required: Optional[bool] = None,
        confidence: Optional[float] = None,
    ) -> Skill:
        """
        Update one or more fields on a skill.

        Editing ``trigger_condition``, ``decision``, or ``conditions`` on an
        *active* skill automatically resets it to ``pending_review`` and
        writes a version snapshot.
        """
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if trigger_condition is not None:
            payload["trigger_condition"] = trigger_condition
        if decision is not None:
            payload["decision"] = decision
        if conditions is not None:
            payload["conditions"] = conditions
        if escalation_required is not None:
            payload["escalation_required"] = escalation_required
        if confidence is not None:
            payload["confidence"] = confidence
        data = self._http.patch(f"/skills/{skill_id}", json=payload)
        return _skill_adapter.validate_python(data)

    def delete(self, skill_id: str) -> None:
        """Permanently delete a skill."""
        self._http.delete(f"/skills/{skill_id}")

    # ── State machine ──────────────────────────────────────────────────────

    def approve(self, skill_id: str) -> Skill:
        """Promote a ``pending_review`` skill to ``active``."""
        data = self._http.patch(f"/skills/{skill_id}/approve", json={})
        return _skill_adapter.validate_python(data["skill"] if isinstance(data, dict) and "skill" in data else data)

    def disable(self, skill_id: str) -> Skill:
        """Disable an active skill (it will no longer match queries)."""
        data = self._http.patch(f"/skills/{skill_id}/disable", json={})
        return _skill_adapter.validate_python(data)

    def enable(self, skill_id: str) -> Skill:
        """Re-enable a disabled skill (resets status to ``pending_review``)."""
        data = self._http.patch(f"/skills/{skill_id}/enable", json={})
        return _skill_adapter.validate_python(data)

    # ── Listing ────────────────────────────────────────────────────────────

    def list(
        self,
        *,
        status: Optional[SkillStatus] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[Skill]:
        """Return one page of skills."""
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        data = self._http.get("/skills", params=params)
        ta: TypeAdapter[List[Skill]] = TypeAdapter(List[Skill])
        return ta.validate_python(data if isinstance(data, list) else [])

    def iter(
        self,
        *,
        status: Optional[SkillStatus] = None,
        page_size: int = 20,
    ) -> SyncPaginator[Skill]:
        """
        Return a lazy iterator over all skills matching the filter.

        Fetches pages on demand — never loads all skills into memory at once::

            for skill in client.skills.iter(status="active"):
                print(skill.name)
        """

        def _fetch(page: int, limit: int) -> _PageResponse:
            params: Dict[str, Any] = {"page": page, "limit": limit}
            if status:
                params["status"] = status
            raw = self._http.get("/skills", params=params)
            if isinstance(raw, dict):
                items = raw.get("data", [])
                return _PageResponse(
                    items,
                    total=raw.get("total", len(items)),
                    page=raw.get("page", page),
                    limit=raw.get("limit", limit),
                )
            items = raw if isinstance(raw, list) else []
            return _PageResponse(items, total=len(items), page=page, limit=limit)

        return SyncPaginator(_fetch, Skill, limit=page_size)

    # ── Export / Import ────────────────────────────────────────────────────

    def export(
        self,
        *,
        format: ExportFormat = "json",
        status: SkillStatus = "active",
    ) -> List[Any]:
        """
        Export skills in one of four formats.

        ``"json"``              — native Curtain skill objects
        ``"openai_functions"``  — OpenAI function-calling schema
        ``"mcp_tools"``         — Model Context Protocol tool schema
        ``"langchain"``         — LangChain tool schema
        """
        data = self._http.get(
            "/skills/export", params={"format": format, "status": status}
        )
        return data if isinstance(data, list) else []

    def import_skills(self, skills: List[ImportSkillPayload]) -> ImportResult:
        """
        Bulk-import skills.  Each imported skill starts in ``pending_review``.

        Returns a summary with counts of created, skipped, and errored skills.
        """
        payload = {"skills": [s.model_dump(exclude_none=True) for s in skills]}
        data = self._http.post("/skills/import", json=payload)
        return ImportResult.model_validate(data)

    # ── Versions ───────────────────────────────────────────────────────────

    def get_versions(self, skill_id: str) -> List[SkillVersion]:
        """List all version snapshots for a skill."""
        data = self._http.get(f"/skills/{skill_id}/versions")
        ta: TypeAdapter[List[SkillVersion]] = TypeAdapter(List[SkillVersion])
        return ta.validate_python(data if isinstance(data, list) else [])

    def get_version(self, skill_id: str, version: int) -> SkillVersion:
        """Fetch a specific version snapshot."""
        data = self._http.get(f"/skills/{skill_id}/versions/{version}")
        return _version_adapter.validate_python(data)

    def restore_version(self, skill_id: str, version: int) -> Skill:
        """
        Create a new ``pending_review`` skill from a historical version.

        The current skill is not modified; a new sibling skill is created
        with the name ``"{original_name} (restored v{version})"``.
        """
        data = self._http.post(
            f"/skills/{skill_id}/versions/{version}/restore", json={}
        )
        return _skill_adapter.validate_python(data)

    # ── Analytics ──────────────────────────────────────────────────────────

    def get_analytics(
        self,
        skill_id: str,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
    ) -> SkillAnalytics:
        """
        Fetch analytics for a specific skill.

        :param from_: ISO 8601 start datetime (inclusive).
        :param to:    ISO 8601 end datetime (inclusive).
        """
        params: Dict[str, Any] = {}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        data = self._http.get(f"/skills/{skill_id}/analytics", params=params)
        return SkillAnalytics.model_validate(data)


# ─── Async mirror ─────────────────────────────────────────────────────────────

class AsyncSkillsResource:
    """Async mirror of :class:`SkillsResource`."""

    def __init__(self, http: AsyncHttpTransport, workspace_id: Optional[str]) -> None:
        self._http = http
        self._ws = workspace_id

    async def create(
        self,
        *,
        name: str,
        trigger_condition: str,
        decision: str,
        conditions: Optional[Dict[str, Any]] = None,
        escalation_required: bool = False,
        confidence: Optional[float] = None,
    ) -> Skill:
        payload: Dict[str, Any] = {
            "name": name,
            "trigger_condition": trigger_condition,
            "decision": decision,
            "escalation_required": escalation_required,
        }
        if conditions is not None:
            payload["conditions"] = conditions
        if confidence is not None:
            payload["confidence"] = confidence
        data = await self._http.post("/skills", json=payload)
        return _skill_adapter.validate_python(data)

    async def get(self, skill_id: str) -> Skill:
        data = await self._http.get(f"/skills/{skill_id}")
        return _skill_adapter.validate_python(data)

    async def update(
        self,
        skill_id: str,
        *,
        name: Optional[str] = None,
        trigger_condition: Optional[str] = None,
        decision: Optional[str] = None,
        conditions: Optional[Dict[str, Any]] = None,
        escalation_required: Optional[bool] = None,
        confidence: Optional[float] = None,
    ) -> Skill:
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if trigger_condition is not None:
            payload["trigger_condition"] = trigger_condition
        if decision is not None:
            payload["decision"] = decision
        if conditions is not None:
            payload["conditions"] = conditions
        if escalation_required is not None:
            payload["escalation_required"] = escalation_required
        if confidence is not None:
            payload["confidence"] = confidence
        data = await self._http.patch(f"/skills/{skill_id}", json=payload)
        return _skill_adapter.validate_python(data)

    async def delete(self, skill_id: str) -> None:
        await self._http.delete(f"/skills/{skill_id}")

    async def approve(self, skill_id: str) -> Skill:
        data = await self._http.patch(f"/skills/{skill_id}/approve", json={})
        return _skill_adapter.validate_python(data["skill"] if isinstance(data, dict) and "skill" in data else data)

    async def disable(self, skill_id: str) -> Skill:
        data = await self._http.patch(f"/skills/{skill_id}/disable", json={})
        return _skill_adapter.validate_python(data)

    async def enable(self, skill_id: str) -> Skill:
        data = await self._http.patch(f"/skills/{skill_id}/enable", json={})
        return _skill_adapter.validate_python(data)

    async def list(
        self,
        *,
        status: Optional[SkillStatus] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[Skill]:
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        data = await self._http.get("/skills", params=params)
        ta: TypeAdapter[List[Skill]] = TypeAdapter(List[Skill])
        return ta.validate_python(data if isinstance(data, list) else [])

    def iter(
        self,
        *,
        status: Optional[SkillStatus] = None,
        page_size: int = 20,
    ) -> AsyncPaginator[Skill]:
        async def _fetch(page: int, limit: int) -> _PageResponse:
            params: Dict[str, Any] = {"page": page, "limit": limit}
            if status:
                params["status"] = status
            raw = await self._http.get("/skills", params=params)
            if isinstance(raw, dict):
                items = raw.get("data", [])
                return _PageResponse(
                    items,
                    total=raw.get("total", len(items)),
                    page=raw.get("page", page),
                    limit=raw.get("limit", limit),
                )
            items = raw if isinstance(raw, list) else []
            return _PageResponse(items, total=len(items), page=page, limit=limit)

        return AsyncPaginator(_fetch, Skill, limit=page_size)

    async def export(
        self, *, format: ExportFormat = "json", status: SkillStatus = "active"
    ) -> List[Any]:
        data = await self._http.get(
            "/skills/export", params={"format": format, "status": status}
        )
        return data if isinstance(data, list) else []

    async def import_skills(self, skills: List[ImportSkillPayload]) -> ImportResult:
        payload = {"skills": [s.model_dump(exclude_none=True) for s in skills]}
        data = await self._http.post("/skills/import", json=payload)
        return ImportResult.model_validate(data)

    async def get_versions(self, skill_id: str) -> List[SkillVersion]:
        data = await self._http.get(f"/skills/{skill_id}/versions")
        ta: TypeAdapter[List[SkillVersion]] = TypeAdapter(List[SkillVersion])
        return ta.validate_python(data if isinstance(data, list) else [])

    async def get_version(self, skill_id: str, version: int) -> SkillVersion:
        data = await self._http.get(f"/skills/{skill_id}/versions/{version}")
        return _version_adapter.validate_python(data)

    async def restore_version(self, skill_id: str, version: int) -> Skill:
        data = await self._http.post(
            f"/skills/{skill_id}/versions/{version}/restore", json={}
        )
        return _skill_adapter.validate_python(data)

    async def get_analytics(
        self,
        skill_id: str,
        *,
        from_: Optional[str] = None,
        to: Optional[str] = None,
    ) -> SkillAnalytics:
        params: Dict[str, Any] = {}
        if from_:
            params["from"] = from_
        if to:
            params["to"] = to
        data = await self._http.get(f"/skills/{skill_id}/analytics", params=params)
        return SkillAnalytics.model_validate(data)
