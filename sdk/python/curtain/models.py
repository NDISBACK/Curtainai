"""
Pydantic v2 models for every Curtain AI API response shape.

Design choices:
- ``frozen=True`` — models are immutable; prevents accidental mutation of
  server-returned data. Use ``model.model_copy(update={...})`` if you need
  a modified copy.
- ``extra="allow"`` — forward-compatible: new fields added by the server do
  not raise validation errors in older SDK versions.
- ``populate_by_name=True`` — allows both field name and alias to be used
  when constructing models programmatically.

Input/request models (``SimulationSkillInput``, ``ImportSkillPayload``) are
``frozen=False`` because callers build and mutate them before sending.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Base config ──────────────────────────────────────────────────────────────

class _FrozenBase(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="allow",
        populate_by_name=True,
    )


class _MutableBase(BaseModel):
    model_config = ConfigDict(
        frozen=False,
        extra="allow",
        populate_by_name=True,
    )


# ─── Enums / Literals ─────────────────────────────────────────────────────────

SkillStatus = Literal["pending_review", "active", "disabled"]
ExportFormat = Literal["json", "openai_functions", "mcp_tools", "langchain"]
ChangeType = Literal[
    "auto_to_escalate",
    "escalate_to_auto",
    "decision_changed",
    "confidence_shift",
]


# ─── Workspace ────────────────────────────────────────────────────────────────

class WorkspaceSettings(_FrozenBase):
    """
    Tuning parameters for the query engine.

    ``top_k``: How many candidate skills are sent to the LLM for final
    selection. Higher values improve recall at the cost of latency.

    ``hybrid_alpha``: Weight of the vector score in the RRF fusion formula.
    0.0 = keyword-only (Jaccard), 1.0 = vector-only, 0.5 = balanced.

    ``duplicate_threshold``: Jaccard / cosine similarity score above which a
    new skill is considered a duplicate of an existing one.
    """

    top_k: int = 3
    duplicate_threshold: float = 0.75
    hybrid_alpha: float = 0.5


class Workspace(_FrozenBase):
    """A Curtain workspace — the top-level tenant boundary."""

    id: str
    name: str
    settings: WorkspaceSettings
    created_at: datetime
    updated_at: datetime


# ─── API Keys ─────────────────────────────────────────────────────────────────

class ApiKey(_FrozenBase):
    """
    Safe representation of an API key (key hash is never returned).

    ``revoked_at`` is ``None`` while the key is active.
    ``expires_at`` is ``None`` for non-expiring keys.
    """

    id: str
    workspace_id: str
    key_prefix: str
    name: str
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None

    @property
    def is_active(self) -> bool:
        """``True`` if the key has not been revoked and has not expired."""
        from datetime import timezone
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at < datetime.now(tz=timezone.utc):
            return False
        return True


class CreatedApiKey(ApiKey):
    """
    Returned once on API key creation — includes the raw key value.

    The ``key`` field is **never stored server-side** and cannot be retrieved
    again. Save it immediately.
    """

    key: str  # raw cai_<64hex>


# ─── Skills ───────────────────────────────────────────────────────────────────

class Skill(_FrozenBase):
    """
    A decision pattern.

    State machine: ``pending_review`` → ``active`` (approve) or
    ``disabled`` (disable). Disabled → ``pending_review`` (enable).

    Editing ``trigger_condition``, ``decision``, or ``conditions`` on an
    *active* skill automatically resets it to ``pending_review`` and writes a
    version snapshot.
    """

    id: str
    workspace_id: str
    name: str
    trigger_condition: Optional[str] = None
    decision: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    escalation_required: bool = False
    confidence: Optional[float] = None
    status: SkillStatus
    created_at: datetime
    updated_at: datetime

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def is_pending(self) -> bool:
        return self.status == "pending_review"

    @property
    def is_disabled(self) -> bool:
        return self.status == "disabled"


class SkillVersion(_FrozenBase):
    """Immutable snapshot of a skill's content fields at a point in time."""

    id: str
    skill_id: str
    workspace_id: str
    version: int
    name: str
    trigger_condition: Optional[str] = None
    decision: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    escalation_required: bool
    confidence: Optional[float] = None
    status: SkillStatus
    changed_by: Optional[str] = None
    change_note: Optional[str] = None
    created_at: datetime


# ─── Queries ─────────────────────────────────────────────────────────────────

class QueryResult(_FrozenBase):
    """
    The response from ``POST /query`` — the core decision engine output.

    If ``escalate`` is ``True`` the engine found no suitable skill and the
    request should be forwarded to a human agent.  In that case ``skill_id``
    is ``None`` and ``confidence`` is 0.
    """

    query_id: str
    decision: Optional[str] = None
    confidence: Optional[float] = None
    skill_id: Optional[str] = None
    skill_name: Optional[str] = None
    search_method: Optional[str] = None
    escalate: bool

    @property
    def resolved(self) -> bool:
        """``True`` when the engine matched a skill (not escalated)."""
        return not self.escalate


class QueryRecord(_FrozenBase):
    """A historical query row returned by ``GET /queries``."""

    id: str
    workspace_id: str
    query: str
    output: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    matched_skill_id: Optional[str] = None
    escalated: bool
    search_method: Optional[str] = None
    created_at: datetime


class Override(_FrozenBase):
    """A human-reviewed correction for a query decision."""

    id: str
    query_id: str
    corrected_decision: str
    created_at: datetime


# ─── Extraction ───────────────────────────────────────────────────────────────

class ExtractedSkill(_FrozenBase):
    """
    A skill extracted from a conversation by ``POST /extract``.

    These are *not* persisted automatically — call ``client.skills.create()``
    for each one you want to keep, then approve them.
    """

    name: str
    trigger_condition: str
    decision: str
    conditions: Optional[Dict[str, Any]] = None
    escalation_required: bool = False
    confidence: float = 0.5


# ─── Simulation ───────────────────────────────────────────────────────────────

class SimulationSkillInput(_MutableBase):
    """
    A skill to test in a simulation run.

    If ``id`` matches an existing active skill, that skill is *replaced* in
    the simulated skill set.  Omitting ``id`` adds the skill as a net-new
    entry alongside the existing actives.
    """

    name: str
    trigger_condition: str
    decision: str
    id: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    escalation_required: bool = False
    confidence: Optional[float] = None


class DecisionSnapshot(_FrozenBase):
    """A before or after decision state within a simulation example."""

    decision: str
    confidence: float
    skill_id: Optional[str] = None
    escalate: bool


class SimulationExample(_FrozenBase):
    """Before/after comparison for a single historical query."""

    query_id: str
    query: str
    before: DecisionSnapshot
    after: DecisionSnapshot
    changed: bool = False
    change_type: Optional[ChangeType] = None


class SimulationImpactSummary(_FrozenBase):
    """Counts of each change type across all simulated queries."""

    auto_to_escalate: int = 0    # coverage loss — was resolving, now escalates
    escalate_to_auto: int = 0    # coverage gain — was escalating, now resolves
    decision_changed: int = 0    # same outcome type, different decision text
    confidence_shift: float = 0.0  # mean confidence delta across changed queries

    @property
    def net_coverage(self) -> int:
        """Positive = net coverage gain, negative = net coverage loss."""
        return self.escalate_to_auto - self.auto_to_escalate


class TopImpactedSkill(_FrozenBase):
    skill_id: str
    skill_name: str
    queries_affected: int


class SimulationResult(_FrozenBase):
    """Full output of ``POST /simulate``."""

    total_queries: int
    changed_decisions: int
    unchanged: int = 0
    impact_summary: SimulationImpactSummary
    top_impacted_skills: List[TopImpactedSkill] = Field(default_factory=list)
    examples: List[SimulationExample] = Field(default_factory=list)

    @property
    def change_rate(self) -> float:
        """Fraction of queries whose decision would change (0–1)."""
        if self.total_queries == 0:
            return 0.0
        return self.changed_decisions / self.total_queries


# ─── Analytics ────────────────────────────────────────────────────────────────

class TopSkillStat(_FrozenBase):
    skill_id: str
    skill_name: str
    match_count: int
    avg_confidence: float


class DailyBreakdown(_FrozenBase):
    day: str  # ISO date string, e.g. "2024-01-15"
    total: int
    matched: int
    escalated: int


class WorkspaceAnalytics(_FrozenBase):
    """Aggregated workspace-level metrics over a time window."""

    period: Dict[str, str]   # {"from": ISO, "to": ISO}
    total_queries: int
    matched_queries: int
    escalated_queries: int
    match_rate: float
    escalation_rate: float
    avg_confidence: float
    top_skills: List[TopSkillStat]
    daily_breakdown: List[DailyBreakdown]


class ConfidenceDistribution(_FrozenBase):
    p50: float
    p90: float
    p99: float


class DailyMatch(_FrozenBase):
    day: str
    count: int
    avg_confidence: float


class SkillAnalytics(_FrozenBase):
    """Per-skill analytics over a time window."""

    skill_id: str
    total_matches: int
    avg_confidence: float
    escalation_rate: float
    confidence_distribution: ConfidenceDistribution
    daily_matches: List[DailyMatch]
    last_matched_at: Optional[datetime] = None


# ─── Import / Export ──────────────────────────────────────────────────────────

class ImportSkillPayload(_MutableBase):
    """One skill entry for ``POST /skills/import``."""

    name: str
    trigger_condition: str
    decision: str
    conditions: Optional[Dict[str, Any]] = None
    escalation_required: bool = False
    confidence: Optional[float] = None


class ImportError(_FrozenBase):
    index: int
    name: str = ""
    message: str


class ImportResult(_FrozenBase):
    """Result of ``POST /skills/import``."""

    created: int
    skipped_duplicates: int
    errors: List[ImportError] = Field(default_factory=list)


# ─── Pagination container ─────────────────────────────────────────────────────

class Page(_MutableBase):
    """Raw paginated envelope from the server."""

    data: List[Any]
    total: int
    page: int
    limit: int

    @property
    def has_next(self) -> bool:
        return self.page * self.limit < self.total

    @property
    def total_pages(self) -> int:
        return max(1, -(-self.total // self.limit))  # ceiling division
