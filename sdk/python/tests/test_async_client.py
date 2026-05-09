"""Tests for the async client using respx (httpx mock)."""
from __future__ import annotations

import pytest
import respx
import httpx

from curtain import AsyncCurtainClient

VALID_KEY = "cai_" + "a" * 64
BASE = "http://test.local/api/v1"


@pytest.mark.asyncio
@respx.mock
async def test_async_query_run():
    respx.post(f"{BASE}/query").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "query_id": "qr-1",
                    "decision": "Issue refund",
                    "confidence": 0.9,
                    "escalate": False,
                    "skill_id": "s1",
                    "skill_name": "Refund",
                    "search_method": "hybrid",
                },
            },
        )
    )
    async with AsyncCurtainClient(api_key=VALID_KEY, base_url=BASE) as client:
        result = await client.queries.run("I was double charged")
    assert result.query_id == "qr-1"
    assert result.resolved is True


@pytest.mark.asyncio
@respx.mock
async def test_async_skills_list():
    skill = {
        "id": "s1",
        "workspace_id": "ws-1",
        "name": "Refund",
        "trigger_condition": "double charge",
        "decision": "Issue refund",
        "status": "active",
        "version": 1,
        "confidence": None,
        "escalation_required": False,
        "conditions": None,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }
    respx.get(f"{BASE}/skills").mock(
        return_value=httpx.Response(200, json={"success": True, "data": [skill]})
    )
    async with AsyncCurtainClient(api_key=VALID_KEY, base_url=BASE) as client:
        skills = await client.skills.list()
    assert len(skills) == 1
    assert skills[0].name == "Refund"


@pytest.mark.asyncio
@respx.mock
async def test_async_context_manager_closes():
    """Verify the async context manager exits cleanly even without any calls."""
    async with AsyncCurtainClient(api_key=VALID_KEY, base_url=BASE):
        pass  # just test no exception on __aexit__
