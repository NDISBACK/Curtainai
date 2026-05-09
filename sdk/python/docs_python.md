# Curtain AI — Python SDK Reference

**Package:** `curtain-ai`  
**Version:** `0.1.0`  
**Requires:** Python 3.9+  
**Dependencies:** `requests`, `httpx`, `pydantic>=2.0`

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Clients](#clients)
   - [CurtainClient (sync)](#curtainclient-sync)
   - [AsyncCurtainClient (async)](#asynccurtainclient-async)
5. [Resources](#resources)
   - [queries](#queries)
   - [skills](#skills)
   - [simulation](#simulation)
   - [extraction](#extraction)
   - [workspaces](#workspaces)
   - [analytics](#analytics)
6. [Models](#models)
7. [Pagination](#pagination)
8. [Error Handling](#error-handling)
9. [Retry Behaviour](#retry-behaviour)
10. [Full Examples](#full-examples)

---

## Installation

```bash
pip install curtain-ai
```

For development / running the examples from source:

```bash
git clone <repo>
cd sdk/python
pip install -e ".[dev]"
```

---

## Quick Start

```python
from curtain import CurtainClient

client = CurtainClient(
    api_key="cai_<64 hex chars>",
    workspace_id="<workspace-uuid>",
)

result = client.queries.run("Customer was double-charged in April")

if result.escalate:
    # No skill matched — route to a human agent
    route_to_human(result.query_id)
else:
    # Send the AI-generated decision to the customer
    send_reply(result.decision)          # str
    print(f"Confidence: {result.confidence:.0%}")  # float 0–1
```

### Async (FastAPI / aiohttp)

```python
import asyncio
from curtain import AsyncCurtainClient

async def main():
    async with AsyncCurtainClient(
        api_key="cai_...",
        workspace_id="<workspace-uuid>",
    ) as client:
        result = await client.queries.run("Refund for duplicate charge")
        print(result.decision)

asyncio.run(main())
```

---

## Configuration

All parameters can be supplied as constructor arguments **or** via environment variables. The constructor argument takes precedence.

| Parameter | Env variable | Default | Description |
|---|---|---|---|
| `api_key` | `CURTAIN_API_KEY` | — | Required. Format: `cai_` + 64 hex chars |
| `workspace_id` | `CURTAIN_WORKSPACE_ID` | `None` | Default workspace UUID (optional — can be passed per-call) |
| `base_url` | `CURTAIN_BASE_URL` | `http://localhost:3000/api/v1` | Override for staging / production deployments |
| `timeout` | — | `30.0` | Per-request timeout in seconds |

```bash
export CURTAIN_API_KEY=cai_abc123...
export CURTAIN_WORKSPACE_ID=550e8400-e29b-41d4-a716-446655440000
export CURTAIN_BASE_URL=https://api.curtainai.com/api/v1
```

```python
# No arguments needed when env vars are set
from curtain import CurtainClient
client = CurtainClient()
```

**API key format:** `cai_` followed by exactly 64 lowercase hexadecimal characters.  
A `ConfigurationError` is raised immediately at construction if the format is wrong — no network call is made.

---

## Clients

### CurtainClient (sync)

Synchronous client backed by `requests.Session`. Thread-safe; the session is connection-pooled and reused across all calls.

```python
from curtain import CurtainClient

# Basic
client = CurtainClient(api_key="cai_...", workspace_id="ws-uuid")

# As context manager (auto-closes the session on exit)
with CurtainClient(api_key="cai_...") as client:
    skills = list(client.skills.iter(status="active"))

# Explicit close
client = CurtainClient(api_key="cai_...")
try:
    result = client.queries.run("...")
finally:
    client.close()
```

**Attributes:**

| Attribute | Type | Description |
|---|---|---|
| `client.skills` | `SkillsResource` | Skill CRUD, state machine, versions, analytics |
| `client.queries` | `QueriesResource` | Run decisions, browse history, submit overrides |
| `client.workspaces` | `WorkspacesResource` | Workspace lifecycle and API key management |
| `client.analytics` | `AnalyticsResource` | Workspace-level metrics |
| `client.extraction` | `ExtractionResource` | Extract skills from conversations |
| `client.simulation` | `SimulationResource` | What-if testing against historical traffic |
| `client.workspace_id` | `str \| None` | Default workspace ID from constructor |

---

### AsyncCurtainClient (async)

Async client backed by `httpx.AsyncClient`. All resource methods are coroutines — remember to `await` them.

```python
from curtain import AsyncCurtainClient

# Always use as async context manager — ensures connection cleanup
async with AsyncCurtainClient(api_key="cai_...", workspace_id="ws-uuid") as client:
    result = await client.queries.run("Customer query here")

# Manual lifecycle
client = AsyncCurtainClient(api_key="cai_...")
result = await client.queries.run("...")
await client.aclose()
```

The `AsyncCurtainClient` exposes the same resource namespaces as `CurtainClient` with async counterparts (`AsyncSkillsResource`, `AsyncQueriesResource`, etc.).

---

## Resources

### queries

Run the Curtain decision engine against your active skill set.

---

#### `client.queries.run(query)`

Run a customer query through the active skill set.

```python
result = client.queries.run("Customer was charged twice for their subscription")

# result: QueryResult
result.query_id      # str  — UUID for this query
result.decision      # str | None  — the decision text (None if escalated)
result.confidence    # float | None  — match confidence 0.0–1.0 (None if escalated)
result.escalate      # bool  — True if no skill matched
result.resolved      # bool  — convenience property: not escalate
result.skill_id      # str | None  — matched skill UUID
result.skill_name    # str | None  — matched skill name
result.search_method # str | None  — "hybrid", "jaccard_only", "no_keyword_match"
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `query` | `str` | Natural-language description of the customer's situation |

**Returns:** `QueryResult`

**Example — escalation routing:**

```python
result = client.queries.run(user_message)

if result.escalate:
    ticket_id = create_support_ticket(
        query_id=result.query_id,
        message=user_message,
    )
    reply = f"I've created ticket #{ticket_id}. An agent will follow up shortly."
else:
    reply = result.decision
    log.info("Auto-resolved", skill=result.skill_name, confidence=result.confidence)
```

---

#### `client.queries.list(...)`

Fetch one page of historical query records.

```python
records = client.queries.list(
    from_="2024-01-01T00:00:00Z",  # ISO 8601
    to="2024-01-31T23:59:59Z",
    escalated=True,                # True = only escalated, False = only matched
    skill_id="skill-uuid",         # filter by matched skill
    page=1,
    limit=20,
)

for r in records:
    print(r.id, r.query, r.escalated)
```

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `from_` | `str \| None` | `None` | ISO 8601 start datetime (inclusive) |
| `to` | `str \| None` | `None` | ISO 8601 end datetime (inclusive) |
| `escalated` | `bool \| None` | `None` | Filter by escalation status |
| `skill_id` | `str \| None` | `None` | Filter by matched skill UUID |
| `page` | `int` | `1` | Page number (1-based) |
| `limit` | `int` | `20` | Items per page (max 100) |

**Returns:** `List[QueryRecord]`

---

#### `client.queries.iter(...)`

Lazy iterator over all matching records — fetches pages on demand.

```python
for record in client.queries.iter(escalated=True, page_size=50):
    review_and_override(record)
```

**Parameters:** same as `list()` except `page`/`limit` are replaced by `page_size`.

**Returns:** `SyncPaginator[QueryRecord]` (or `AsyncPaginator` for the async client)

---

#### `client.queries.override(query_id, corrected_decision)`

Submit a human-reviewed correction. Stored and may auto-generate a new `pending_review` skill.

```python
override = client.queries.override(
    query_id="qr-uuid",
    corrected_decision="Issue a full refund and send a 10% discount code.",
)

override.id                  # str
override.query_id            # str
override.corrected_decision  # str
override.created_at          # datetime
```

**Returns:** `Override`

---

### skills

Full CRUD, state machine transitions, version history, bulk import/export, and per-skill analytics.

**Skill status machine:**

```
pending_review ──approve()──▶ active ──disable()──▶ disabled
                                                        │
disabled ◀──enable()──────────────────────────────────┘
                                            (resets to pending_review)

Editing trigger_condition / decision / conditions on an active skill
automatically resets it to pending_review and writes a version snapshot.
```

---

#### `client.skills.create(...)`

Create a new skill. Always starts in `pending_review` — call `approve()` before it matches queries.

```python
skill = client.skills.create(
    name="Duplicate Charge Refund",
    trigger_condition="Customer was charged twice for the same order or subscription",
    decision="Verify the duplicate in billing, issue a full refund, and send a confirmation email within 24 hours.",
    escalation_required=False,   # optional, default False
    confidence=0.9,              # optional threshold hint
)

# skill: Skill
skill.id          # str
skill.name        # str
skill.status      # "pending_review" | "active" | "disabled"
skill.is_pending  # bool (property)
skill.is_active   # bool (property)
skill.is_disabled # bool (property)
skill.version     # int
skill.created_at  # datetime
skill.updated_at  # datetime
```

**Raises:** `DuplicateSkillError` if a semantically similar skill already exists.

---

#### `client.skills.get(skill_id)`

```python
skill = client.skills.get("skill-uuid")
```

**Raises:** `NotFoundError` if the skill doesn't exist or belongs to another workspace.

---

#### `client.skills.update(skill_id, **fields)`

Update one or more fields. Editing content fields (`trigger_condition`, `decision`, `conditions`) on an `active` skill resets it to `pending_review` and writes a version snapshot.

```python
skill = client.skills.update(
    "skill-uuid",
    name="Duplicate Charge Refund v2",
    decision="Issue refund within 12 hours and waive next month's fee.",
)
# skill.status is now "pending_review" if it was previously "active"
```

**Parameters:** all keyword-only, all optional: `name`, `trigger_condition`, `decision`, `conditions`, `escalation_required`, `confidence`.

---

#### `client.skills.delete(skill_id)`

Permanently deletes a skill and its version history. Irreversible.

```python
client.skills.delete("skill-uuid")  # returns None
```

---

#### `client.skills.approve(skill_id)`

Promote a `pending_review` skill to `active`. It will now participate in query matching.

```python
skill = client.skills.approve("skill-uuid")
assert skill.is_active
```

---

#### `client.skills.disable(skill_id)`

Take an `active` skill out of query matching.

```python
skill = client.skills.disable("skill-uuid")
assert skill.is_disabled
```

---

#### `client.skills.enable(skill_id)`

Re-enable a `disabled` skill — resets status to `pending_review`. Call `approve()` to make it active again.

```python
skill = client.skills.enable("skill-uuid")
assert skill.is_pending
```

---

#### `client.skills.list(...)`

Fetch one page of skills.

```python
skills = client.skills.list(status="active", page=1, limit=50)
for skill in skills:
    print(f"{skill.name}  [{skill.status}]")
```

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `status` | `"pending_review" \| "active" \| "disabled" \| None` | `None` | Filter by status |
| `page` | `int` | `1` | Page number |
| `limit` | `int` | `20` | Items per page (max 100) |

**Returns:** `List[Skill]`

---

#### `client.skills.iter(...)`

Lazy iterator over all matching skills.

```python
# Iterate all active skills
for skill in client.skills.iter(status="active"):
    print(skill.name)

# Process page by page
for page in client.skills.iter(status="pending_review").pages():
    bulk_notify_reviewers(page)
```

**Returns:** `SyncPaginator[Skill]`

---

#### `client.skills.export(format, status)`

Export skills in one of four formats for use with other frameworks.

```python
# Native JSON
skills_json = client.skills.export(format="json", status="active")

# OpenAI function-calling schema
functions = client.skills.export(format="openai_functions")

# MCP tool schema (for AI agents)
tools = client.skills.export(format="mcp_tools")

# LangChain tool schema
lc_tools = client.skills.export(format="langchain")
```

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `format` | `"json" \| "openai_functions" \| "mcp_tools" \| "langchain"` | `"json"` | Output format |
| `status` | `SkillStatus` | `"active"` | Which skills to export |

**Returns:** `List[Any]`

---

#### `client.skills.import_skills(skills)`

Bulk-import skills. Each imported skill starts in `pending_review`. Duplicate skills are skipped (not errored).

```python
from curtain import ImportSkillPayload

result = client.skills.import_skills([
    ImportSkillPayload(
        name="Password Reset",
        trigger_condition="Customer cannot log in or forgot their password",
        decision="Send a password reset link to the verified email address.",
    ),
    ImportSkillPayload(
        name="Shipping Inquiry",
        trigger_condition="Customer asks about order delivery status",
        decision="Provide the current tracking status and estimated arrival date.",
    ),
])

print(f"Created: {result.created}")
print(f"Skipped (duplicates): {result.skipped_duplicates}")
for err in result.errors:
    print(f"Error at index {err.index}: {err.message}")
```

**Returns:** `ImportResult`

---

#### `client.skills.get_versions(skill_id)`

List all version snapshots for a skill (most recent first).

```python
versions = client.skills.get_versions("skill-uuid")
for v in versions:
    print(f"v{v.version}  {v.created_at.date()}  {v.trigger_condition[:60]}")
```

**Returns:** `List[SkillVersion]`

---

#### `client.skills.get_version(skill_id, version)`

Fetch a specific version snapshot.

```python
v1 = client.skills.get_version("skill-uuid", version=1)
print(v1.decision)
```

**Returns:** `SkillVersion`

---

#### `client.skills.restore_version(skill_id, version)`

Create a new `pending_review` skill from a historical version. The existing skill is not modified.

```python
restored = client.skills.restore_version("skill-uuid", version=1)
# restored is a brand-new Skill in pending_review
client.skills.approve(restored.id)
```

**Returns:** `Skill`

---

#### `client.skills.get_analytics(skill_id, from_, to)`

Per-skill performance metrics over a date range.

```python
stats = client.skills.get_analytics(
    "skill-uuid",
    from_="2024-01-01T00:00:00Z",
    to="2024-01-31T23:59:59Z",
)

stats.total_matches                          # int
stats.avg_confidence                         # float
stats.escalation_rate                        # float
stats.confidence_distribution.p50            # float
stats.confidence_distribution.p90            # float
stats.confidence_distribution.p99            # float
stats.last_matched_at                        # datetime | None
```

**Returns:** `SkillAnalytics`

---

### simulation

Test skill changes against real historical traffic **before deploying**. The endpoint is fully read-only — no skills are modified, no queries are stored.

---

#### `client.simulation.run(simulation_skills, *, query_ids, sample_size)`

Replay historical queries through a modified skill set and return a before/after comparison.

```python
from curtain import SimulationSkillInput

# Describe a modified version of an existing skill
modified = SimulationSkillInput(
    id="existing-skill-uuid",       # replaces this skill in the simulated set
    name="Refund Policy v2",
    trigger_condition="Customer requests refund for any charge or duplicate billing",
    decision="Issue refund within 12 hours and send a confirmation email.",
)

# Run against the 200 most recent queries
result = client.simulation.run([modified], sample_size=200)

print(f"Queries tested:    {result.total_queries}")
print(f"Decisions changed: {result.changed_decisions}  ({result.change_rate:.1%})")
print(f"Coverage gain:    +{result.impact_summary.escalate_to_auto}")
print(f"Coverage loss:    -{result.impact_summary.auto_to_escalate}")
print(f"Net coverage:      {result.impact_summary.net_coverage:+d}")
```

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `simulation_skills` | `List[SimulationSkillInput]` | — | Skills to test. If a skill's `id` matches an existing active skill it *replaces* it; otherwise it is added alongside existing actives |
| `query_ids` | `List[str] \| None` | `None` | Test against specific historical query UUIDs. When omitted the server samples the `sample_size` most recent queries |
| `sample_size` | `int` | `100` | Number of recent queries to sample (1–500). Ignored when `query_ids` is provided |

**Returns:** `SimulationResult`

**SimulationResult fields:**

```python
result.total_queries          # int — queries replayed
result.changed_decisions      # int — queries with a different outcome
result.unchanged              # int — queries with identical outcome
result.change_rate            # float — changed / total (computed property)

result.impact_summary.auto_to_escalate   # int — coverage LOSS
result.impact_summary.escalate_to_auto   # int — coverage GAIN
result.impact_summary.decision_changed   # int — same type, different text
result.impact_summary.confidence_shift   # float — mean confidence delta
result.impact_summary.net_coverage       # int — gain minus loss (property)

result.top_impacted_skills    # List[TopImpactedSkill]
result.examples               # List[SimulationExample] — before/after pairs
```

**Inspect before/after examples:**

```python
for ex in result.examples:
    if ex.change_type == "auto_to_escalate":
        print(f"REGRESSION  {ex.query}")
        print(f"  Before: {ex.before.decision}")
        print(f"  After:  escalated")
    elif ex.change_type == "escalate_to_auto":
        print(f"IMPROVEMENT {ex.query}")
        print(f"  After:  {ex.after.decision}")
```

**SimulationSkillInput fields:**

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Skill name |
| `trigger_condition` | `str` | Natural-language trigger description |
| `decision` | `str` | Decision text the engine should return |
| `id` | `str \| None` | Existing skill UUID to replace (omit to add as net-new) |
| `conditions` | `dict \| None` | Structured conditions (optional) |
| `escalation_required` | `bool` | Force escalation when matched (default `False`) |
| `confidence` | `float \| None` | Confidence threshold hint (optional) |

---

### extraction

Extract reusable decision skills from raw support conversation transcripts using the built-in LLM pipeline.

Extracted skills are **not persisted** — call `client.skills.create()` and `client.skills.approve()` for each one you want to keep.

---

#### `client.extraction.extract(conversation)`

```python
transcript = """
Agent: Hi, how can I help you today?
Customer: I was charged twice for my subscription last month.
Agent: I can see the duplicate charge — let me issue a refund now.
Customer: Thank you!
Agent: Done. You'll see the refund within 3–5 business days.
"""

extracted = client.extraction.extract(transcript)

for skill in extracted:
    print(f"{skill.name}  (confidence: {skill.confidence:.0%})")
    print(f"  Trigger:  {skill.trigger_condition}")
    print(f"  Decision: {skill.decision}")

    # Optionally persist the extracted skill
    new_skill = client.skills.create(
        name=skill.name,
        trigger_condition=skill.trigger_condition,
        decision=skill.decision,
    )
    client.skills.approve(new_skill.id)
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `conversation` | `str` | Raw conversation text. Max 50,000 characters |

**Returns:** `List[ExtractedSkill]`

**ExtractedSkill fields:**

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Suggested skill name |
| `trigger_condition` | `str` | Extracted trigger |
| `decision` | `str` | Extracted decision |
| `confidence` | `float` | Extraction confidence (0.0–1.0) |
| `conditions` | `dict \| None` | Structured conditions if detected |
| `escalation_required` | `bool` | Whether escalation was detected |

---

### workspaces

Workspace lifecycle (create, read, update, delete) and API key management.

---

#### `client.workspaces.create(name)`

Create a new workspace. **Does not require authentication** — this is the bootstrap endpoint.

```python
# No API key needed for workspace creation
bootstrap = CurtainClient(api_key="", base_url="http://localhost:3000/api/v1")
# Note: pass empty string — ConfigurationError is raised only for invalid format
# Actually use a dummy bootstrap approach or the unauthenticated endpoint directly

ws = client.workspaces.create("Acme Support")
print(ws.id)    # workspace UUID
print(ws.name)  # "Acme Support"
print(ws.settings.top_k)              # 3 (default)
print(ws.settings.hybrid_alpha)       # 0.5 (default)
print(ws.settings.duplicate_threshold) # 0.75 (default)
```

**Returns:** `Workspace`

---

#### `client.workspaces.get(workspace_id)`

```python
ws = client.workspaces.get("ws-uuid")
```

**Returns:** `Workspace`

---

#### `client.workspaces.update(workspace_id, *, name, settings)`

Update workspace name and/or query-engine settings.

```python
ws = client.workspaces.update(
    "ws-uuid",
    name="Acme Support (Production)",
    settings={
        "top_k": 5,            # more candidates sent to LLM
        "hybrid_alpha": 0.7,   # more weight on vector similarity
        "duplicate_threshold": 0.8,
    },
)
```

Only keys provided in `settings` are updated — omitted keys keep their current values.

**Settings keys:**

| Key | Type | Default | Description |
|---|---|---|---|
| `top_k` | `int` | `3` | Candidate skills sent to LLM for final selection |
| `hybrid_alpha` | `float` | `0.5` | Vector weight in RRF fusion. `0.0` = keyword-only, `1.0` = vector-only |
| `duplicate_threshold` | `float` | `0.75` | Similarity score above which new skills are considered duplicates |

**Returns:** `Workspace`

---

#### `client.workspaces.delete(workspace_id)`

Delete a workspace and **all its data** (skills, queries, overrides, API keys). Irreversible.

```python
client.workspaces.delete("ws-uuid")  # returns None
```

---

#### `client.workspaces.list_api_keys(workspace_id)`

List all API keys for a workspace. Raw key values are never returned after creation.

```python
keys = client.workspaces.list_api_keys("ws-uuid")
for key in keys:
    print(f"{key.name}  prefix={key.key_prefix}  active={key.is_active}")
```

**Returns:** `List[ApiKey]`

---

#### `client.workspaces.create_api_key(workspace_id, name, *, expires_at)`

Create a new API key. The raw `key` value is returned **once** and never stored server-side — save it immediately.

```python
created = client.workspaces.create_api_key(
    "ws-uuid",
    "production-key",
    expires_at="2025-12-31T23:59:59Z",  # optional ISO 8601
)

print(created.key)   # "cai_<64hex>" — save this now!
print(created.id)    # key UUID for future revocation
```

**Returns:** `CreatedApiKey` (extends `ApiKey` with `key: str`)

---

#### `client.workspaces.revoke_api_key(workspace_id, key_id)`

Revoke a key immediately. The key stops working at once. Irreversible.

```python
client.workspaces.revoke_api_key("ws-uuid", "key-uuid")
```

---

### analytics

Aggregated workspace-level metrics over a time window.

---

#### `client.analytics.get_workspace(workspace_id, *, from_, to)`

```python
from datetime import datetime, timedelta, timezone

now = datetime.now(tz=timezone.utc)
week_ago = now - timedelta(days=7)

stats = client.analytics.get_workspace(
    "ws-uuid",
    from_=week_ago.isoformat(),
    to=now.isoformat(),
)

stats.total_queries      # int
stats.matched_queries    # int
stats.escalated_queries  # int
stats.match_rate         # float (0.0–1.0)
stats.escalation_rate    # float (0.0–1.0)
stats.avg_confidence     # float (0.0–1.0)

for skill in stats.top_skills:
    print(f"{skill.skill_name}: {skill.match_count} matches  avg={skill.avg_confidence:.2f}")

for day in stats.daily_breakdown:
    print(f"{day.day}: {day.total} queries, {day.escalated} escalated")
```

Both `from_` and `to` are optional. When omitted the server returns all-time totals.

**Returns:** `WorkspaceAnalytics`

---

## Models

All response models are **immutable** (`frozen=True`) and **forward-compatible** (`extra="allow"` — unknown fields from newer API versions are silently accepted).

Input models (`SimulationSkillInput`, `ImportSkillPayload`) are mutable so you can build them incrementally.

### QueryResult

| Field | Type | Description |
|---|---|---|
| `query_id` | `str` | UUID of this query |
| `decision` | `str \| None` | Decision text (None when escalated) |
| `confidence` | `float \| None` | Match confidence 0–1 (None when escalated) |
| `escalate` | `bool` | True if no skill matched |
| `skill_id` | `str \| None` | Matched skill UUID |
| `skill_name` | `str \| None` | Matched skill name |
| `search_method` | `str \| None` | `"hybrid"`, `"jaccard_only"`, `"no_keyword_match"` |
| `resolved` *(property)* | `bool` | `not escalate` |

### QueryRecord

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Record UUID |
| `workspace_id` | `str` | Workspace |
| `query` | `str` | Original query text |
| `output` | `dict \| None` | Full decision trace as stored |
| `escalated` | `bool` | Whether this query was escalated |
| `search_method` | `str \| None` | Search method used |
| `created_at` | `datetime` | When the query was run |

### Skill

| Field | Type | Description |
|---|---|---|
| `id` | `str` | UUID |
| `workspace_id` | `str` | Owner workspace |
| `name` | `str` | Human-readable name |
| `trigger_condition` | `str \| None` | Natural-language trigger |
| `decision` | `str \| None` | Decision text |
| `status` | `SkillStatus` | `"pending_review"`, `"active"`, `"disabled"` |
| `version` | `int` | Current version number |
| `escalation_required` | `bool` | Always escalate when matched |
| `confidence` | `float \| None` | Confidence threshold hint |
| `created_at` | `datetime` | — |
| `updated_at` | `datetime` | — |
| `is_active` *(property)* | `bool` | `status == "active"` |
| `is_pending` *(property)* | `bool` | `status == "pending_review"` |
| `is_disabled` *(property)* | `bool` | `status == "disabled"` |

### SimulationResult

| Field | Type | Description |
|---|---|---|
| `total_queries` | `int` | Queries replayed |
| `changed_decisions` | `int` | Queries with different outcome |
| `unchanged` | `int` | Queries with identical outcome |
| `impact_summary` | `SimulationImpactSummary` | Change type breakdown |
| `top_impacted_skills` | `List[TopImpactedSkill]` | Most-affected skills |
| `examples` | `List[SimulationExample]` | Before/after query pairs |
| `change_rate` *(property)* | `float` | `changed / total` |

### SimulationImpactSummary

| Field | Type | Description |
|---|---|---|
| `auto_to_escalate` | `int` | Queries that were auto-resolved but would now escalate (coverage loss) |
| `escalate_to_auto` | `int` | Queries that were escalated but would now be auto-resolved (coverage gain) |
| `decision_changed` | `int` | Same outcome type, different decision text |
| `confidence_shift` | `float` | Mean confidence delta across changed queries |
| `net_coverage` *(property)* | `int` | `escalate_to_auto - auto_to_escalate` |

### Workspace

| Field | Type | Description |
|---|---|---|
| `id` | `str` | UUID |
| `name` | `str` | Display name |
| `settings` | `WorkspaceSettings` | Engine tuning parameters |
| `created_at` | `datetime` | — |
| `updated_at` | `datetime` | — |

### ApiKey / CreatedApiKey

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Key UUID (use for revocation) |
| `workspace_id` | `str` | — |
| `name` | `str` | Human-readable label |
| `key_prefix` | `str` | First few chars for identification |
| `expires_at` | `datetime \| None` | Expiry (None = never expires) |
| `revoked_at` | `datetime \| None` | Revocation time (None = active) |
| `last_used_at` | `datetime \| None` | Last successful authentication |
| `created_at` | `datetime` | — |
| `is_active` *(property)* | `bool` | Not revoked and not expired |
| `key` *(CreatedApiKey only)* | `str` | Raw `cai_<64hex>` — shown once |

---

## Pagination

List endpoints that can return large datasets expose both a single-page `list()` method and a lazy-iterator `iter()` method.

### Single page

```python
page = client.skills.list(status="active", page=2, limit=50)
# Returns List[Skill] — you manage page numbers yourself
```

### Lazy iterator (recommended for large datasets)

```python
# Yields one Skill at a time, fetches next page automatically
for skill in client.skills.iter(status="active", page_size=50):
    process(skill)

# Yield one full page (List[T]) at a time — good for bulk operations
for page in client.skills.iter(status="active").pages():
    bulk_index(page)
```

### Async iteration

```python
async for skill in client.skills.iter(status="active"):
    await process(skill)

async for page in client.skills.iter().apages():
    await bulk_index(page)
```

Both `SyncPaginator` and `AsyncPaginator` are generic — `SyncPaginator[Skill]`, `AsyncPaginator[QueryRecord]`, etc.

---

## Error Handling

Every non-2xx response is mapped to a typed exception. Catch broadly with `CurtainError` or narrow to a specific subclass.

```
CurtainError
├── ConfigurationError       bad api_key format or base_url
├── TransportError           network failure, timeout, DNS error
└── APIError
    ├── AuthenticationError  401 — key missing, revoked, or expired
    ├── PermissionError      403 — key lacks access to this resource
    ├── NotFoundError        404 — resource not found (also used for cross-workspace access)
    ├── ValidationError      400 — request body/params failed server validation
    ├── DuplicateSkillError  409 — semantically similar skill already exists
    ├── UnprocessableError   422 — LLM pipeline returned malformed output
    ├── RateLimitError       429 — raised after all retries exhausted
    └── ServerError          500/502/503 — internal server error
```

### Example — comprehensive handler

```python
import time
from curtain.exceptions import (
    ConfigurationError,
    TransportError,
    AuthenticationError,
    RateLimitError,
    NotFoundError,
    DuplicateSkillError,
    ServerError,
    CurtainError,
)

try:
    result = client.queries.run(user_message)

except ConfigurationError as e:
    # Misconfigured at startup — fix the api_key or base_url
    raise RuntimeError(f"SDK misconfigured: {e.message}") from e

except AuthenticationError:
    # The API key is invalid or revoked — re-generate from the dashboard
    raise RuntimeError("API key invalid. Regenerate from the Curtain dashboard.")

except RateLimitError as e:
    # SDK retried automatically — all retries exhausted
    wait = e.retry_after or 60
    log.warning(f"Rate limit hit — backing off {wait}s")
    time.sleep(wait)
    result = client.queries.run(user_message)  # retry once more

except NotFoundError:
    # Workspace or resource doesn't exist in this environment
    log.error("Resource not found — check workspace_id")

except TransportError as e:
    # Network failure — the server was never reached
    log.error(f"Network error: {e.message}")
    result = _fallback_response()

except ServerError as e:
    # Server error — log correlation_id for support
    log.error(f"Server error [{e.correlation_id}]: {e.message}")
    result = _fallback_response()

except CurtainError as e:
    # Catch-all for anything else from the SDK
    log.error(f"Curtain error {e.http_status}: {e.message}")
```

### DuplicateSkillError on create

```python
from curtain.exceptions import DuplicateSkillError

try:
    skill = client.skills.create(
        name="Refund Policy",
        trigger_condition="Customer requests a refund",
        decision="Issue refund within 24 hours.",
    )
except DuplicateSkillError as e:
    print(f"Duplicate detected: {e.message}")
    # Fetch the existing skill instead
    existing = client.skills.list(status="active")
```

### All exception attributes

| Attribute | Available on | Type | Description |
|---|---|---|---|
| `message` | all | `str` | Human-readable error description |
| `http_status` | `APIError` subclasses | `int \| None` | HTTP status code |
| `correlation_id` | `APIError` subclasses | `str \| None` | Server-side trace ID for support |
| `retry_after` | `RateLimitError` | `float \| None` | Suggested wait time in seconds |

---

## Retry Behaviour

The SDK automatically retries on transient failures before raising an exception.

| Trigger | Retried? | Behaviour |
|---|---|---|
| `429 Rate Limited` | Yes | Retries with exponential back-off (or `Retry-After` header value) |
| `500 Internal Server Error` | Yes | Retries with exponential back-off |
| `502 Bad Gateway` | Yes | Retries with exponential back-off |
| `503 Service Unavailable` | Yes | Retries with exponential back-off |
| `4xx` (except 429) | No | Raises immediately |
| Network timeout / connection refused | No | Raises `TransportError` immediately |

**Back-off schedule:** `1s → 2s → 4s` (3 total attempts).  
If a `Retry-After` header is present on a 429 response, that value is used instead.

`RateLimitError` is only raised when **all 3 attempts are exhausted**.

---

## Full Examples

### 1. Bootstrap a new workspace

```python
import os
from curtain import CurtainClient

# No API key needed for workspace creation
# Pass a dummy placeholder — the /workspaces endpoint is unauthenticated
client = CurtainClient(api_key="cai_" + "0" * 64, base_url="http://localhost:3000/api/v1")

ws = client.workspaces.create("Acme Support")
print(f"Workspace: {ws.id}")

key = client.workspaces.create_api_key(ws.id, "primary")
print(f"API key: {key.key}")   # save this — shown only once

# From now on:
os.environ["CURTAIN_API_KEY"] = key.key
os.environ["CURTAIN_WORKSPACE_ID"] = ws.id
```

### 2. Chatbot handler (async / FastAPI)

```python
import os
from curtain import AsyncCurtainClient
from curtain.exceptions import CurtainError

client = AsyncCurtainClient(
    api_key=os.environ["CURTAIN_API_KEY"],
    workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
    base_url=os.environ.get("CURTAIN_BASE_URL", "http://localhost:3000/api/v1"),
)

async def handle_message(session_id: str, text: str) -> dict:
    try:
        result = await client.queries.run(text)
    except CurtainError:
        return {"reply": "Sorry, I'm having trouble right now. Please try again.", "escalated": True}

    if result.escalate:
        await enqueue_for_human(session_id, text, result.query_id)
        return {
            "reply": f"I've flagged this for a support agent. Reference: {result.query_id[:8].upper()}",
            "escalated": True,
            "query_id": result.query_id,
        }

    return {
        "reply": result.decision,
        "escalated": False,
        "confidence": result.confidence,
        "query_id": result.query_id,
    }

# In FastAPI:
# @app.on_event("shutdown")
# async def shutdown():
#     await client.aclose()
```

### 3. Safe skill deploy with simulation gate

```python
from curtain import CurtainClient, SimulationSkillInput

client = CurtainClient(
    api_key=os.environ["CURTAIN_API_KEY"],
    workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
)

SKILL_ID = "your-skill-uuid"
COVERAGE_LOSS_THRESHOLD = 5   # reject if more than 5 queries would regress

proposed = SimulationSkillInput(
    id=SKILL_ID,
    name="Refund Policy v3",
    trigger_condition="Customer requests refund for any charge",
    decision="Issue refund within 6 hours.",
)

result = client.simulation.run([proposed], sample_size=500)
print(f"Coverage change: {result.impact_summary.net_coverage:+d}")

if result.impact_summary.auto_to_escalate > COVERAGE_LOSS_THRESHOLD:
    print(f"REJECTED — {result.impact_summary.auto_to_escalate} regressions exceed threshold {COVERAGE_LOSS_THRESHOLD}")
else:
    # Safe to deploy — apply the update
    skill = client.skills.update(
        SKILL_ID,
        trigger_condition=proposed.trigger_condition,
        decision=proposed.decision,
    )
    client.skills.approve(SKILL_ID)
    print(f"Deployed. Coverage gain: +{result.impact_summary.escalate_to_auto}")
```

### 4. Extract and import skills from a ticket export

```python
tickets = load_zendesk_export("tickets.json")   # your own loader

imported = 0
for ticket in tickets[:50]:
    extracted = client.extraction.extract(ticket["conversation"])
    for skill in extracted:
        if skill.confidence < 0.7:
            continue
        try:
            new_skill = client.skills.create(
                name=skill.name,
                trigger_condition=skill.trigger_condition,
                decision=skill.decision,
            )
            client.skills.approve(new_skill.id)
            imported += 1
        except DuplicateSkillError:
            pass  # already covered

print(f"Imported {imported} new skills from ticket export")
```

### 5. Weekly analytics report

```python
from datetime import datetime, timedelta, timezone

now = datetime.now(tz=timezone.utc)
week_ago = now - timedelta(days=7)

stats = client.analytics.get_workspace(
    os.environ["CURTAIN_WORKSPACE_ID"],
    from_=week_ago.isoformat(),
    to=now.isoformat(),
)

print(f"=== Last 7 days ===")
print(f"Total queries:   {stats.total_queries:,}")
print(f"Match rate:      {stats.match_rate:.1%}")
print(f"Escalation rate: {stats.escalation_rate:.1%}")
print(f"Avg confidence:  {stats.avg_confidence:.2f}")
print()
print("Top skills:")
for s in stats.top_skills[:5]:
    print(f"  {s.skill_name:<40} {s.match_count:>4} matches  conf={s.avg_confidence:.2f}")
```

---

## Running Tests

```bash
cd sdk/python
pip install -e ".[dev]"
pytest tests/ -v
```

All 32 tests use mocked HTTP (no live server required):
- `test_http.py` — transport layer, key validation, retry behaviour, error mapping
- `test_skills.py` — skills resource CRUD and pagination
- `test_queries.py` — query resource, escalation, overrides
- `test_simulation.py` — simulation resource and payload serialisation
- `test_async_client.py` — async client with `respx` (httpx mock)
