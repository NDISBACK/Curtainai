# Curtain AI Python SDK

Official Python client for the [Curtain](https://github.com/curtainai/curtain) decision engine API.

## Installation

```bash
pip install curtain-ai
```

Requires Python 3.9+.

## Quick start

```python
from curtain import CurtainClient

client = CurtainClient(
    api_key="cai_...",          # or set CURTAIN_API_KEY env var
    workspace_id="ws-uuid",     # or set CURTAIN_WORKSPACE_ID env var
)

result = client.queries.run("Customer was double-charged in April")

if result.escalate:
    route_to_human_agent(result.query_id)
else:
    send_to_customer(result.decision)   # result.confidence: 0.0–1.0
```

## Async

```python
import asyncio
from curtain import AsyncCurtainClient

async def main():
    async with AsyncCurtainClient(api_key="cai_...", workspace_id="ws-uuid") as client:
        result = await client.queries.run("I need a refund")
        print(result.decision)

asyncio.run(main())
```

## Configuration

| Parameter | Env var | Default |
|-----------|---------|---------|
| `api_key` | `CURTAIN_API_KEY` | required |
| `workspace_id` | `CURTAIN_WORKSPACE_ID` | optional |
| `base_url` | `CURTAIN_BASE_URL` | `http://localhost:3000/api/v1` |
| `timeout` | — | `30.0` s |

## Resources

### `client.queries`

```python
# Run a query
result = client.queries.run("Customer wants to cancel subscription")
# result.escalate      → bool
# result.decision      → str | None
# result.confidence    → float | None
# result.query_id      → str

# List history (one page)
records = client.queries.list(from_="2024-01-01T00:00:00Z", escalated=True)

# Iterate all pages lazily
for record in client.queries.iter(skill_id="skill-uuid"):
    process(record)

# Submit a human correction
override = client.queries.override(query_id, "The correct decision text")
```

### `client.skills`

```python
# CRUD
skill = client.skills.create(
    name="Refund Policy",
    trigger_condition="Customer was charged twice",
    decision="Issue a full refund within 24 hours.",
)
skill = client.skills.get(skill.id)
skill = client.skills.update(skill.id, decision="Issue refund within 12 hours.")
client.skills.delete(skill.id)

# State machine
skill = client.skills.approve(skill.id)   # pending_review → active
skill = client.skills.disable(skill.id)   # active → disabled
skill = client.skills.enable(skill.id)    # disabled → pending_review

# Pagination
skills = client.skills.list(status="active", page=1, limit=50)
for skill in client.skills.iter(status="active"):   # lazy, all pages
    print(skill.name)

# Import / export
client.skills.import_skills([ImportSkillPayload(...)])
data = client.skills.export(format="openai_functions")

# Version history
versions = client.skills.get_versions(skill.id)
restored = client.skills.restore_version(skill.id, version=1)

# Analytics
stats = client.skills.get_analytics(skill.id, from_="2024-01-01T00:00:00Z")
```

### `client.simulation`

Test skill changes against real historical traffic — **fully read-only**.

```python
from curtain import SimulationSkillInput

modified = SimulationSkillInput(
    id="existing-skill-uuid",     # replaces this skill in the test
    name="Refund Policy v2",
    trigger_condition="Customer requests refund for any charge",
    decision="Issue refund within 12 hours and send confirmation email.",
)

result = client.simulation.run([modified], sample_size=200)

print(f"Queries tested:    {result.total_queries}")
print(f"Decisions changed: {result.changed_decisions} ({result.change_rate:.1%})")
print(f"Coverage gain:    +{result.impact_summary.escalate_to_auto}")
print(f"Coverage loss:    -{result.impact_summary.auto_to_escalate}")
print(f"Net coverage:      {result.impact_summary.net_coverage:+d}")
```

### `client.extraction`

```python
transcript = """
Agent: Hi, how can I help?
Customer: I was charged twice for my subscription last month.
Agent: I can see the duplicate — issuing a refund now.
"""

skills = client.extraction.extract(transcript)
for skill in skills:
    print(skill.name, "— confidence:", skill.confidence)
    new = client.skills.create(
        name=skill.name,
        trigger_condition=skill.trigger_condition,
        decision=skill.decision,
    )
    client.skills.approve(new.id)
```

### `client.workspaces`

```python
ws = client.workspaces.create("Acme Support")           # no auth needed
ws = client.workspaces.get(workspace_id)
ws = client.workspaces.update(workspace_id, name="Acme Support v2")
client.workspaces.delete(workspace_id)

created = client.workspaces.create_api_key(workspace_id, "ci-key")
print(created.key)   # shown once — save it!

keys = client.workspaces.list_api_keys(workspace_id)
client.workspaces.revoke_api_key(workspace_id, key_id)
```

### `client.analytics`

```python
from datetime import datetime, timedelta, timezone

now = datetime.now(tz=timezone.utc)
stats = client.analytics.get_workspace(
    workspace_id,
    from_=(now - timedelta(days=7)).isoformat(),
    to=now.isoformat(),
)
print(f"Match rate last 7 days: {stats.match_rate:.1%}")
```

## Error handling

```python
from curtain.exceptions import (
    AuthenticationError,   # 401
    NotFoundError,         # 404
    RateLimitError,        # 429
    ServerError,           # 5xx
    TransportError,        # network failure
    CurtainError,          # base class for all SDK errors
)

try:
    result = client.queries.run(user_message)
except RateLimitError as e:
    time.sleep(e.retry_after or 1)
    result = client.queries.run(user_message)
except AuthenticationError:
    raise RuntimeError("Invalid or expired API key")
except CurtainError as e:
    logger.error("Curtain error", status=e.http_status, msg=e.message)
```

## Development

```bash
cd sdk/python
pip install -e ".[dev]"

pytest tests/ -v
mypy curtain/ --strict
ruff check curtain/
```

## License

MIT
