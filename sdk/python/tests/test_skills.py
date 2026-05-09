"""Tests for the skills resource."""
from __future__ import annotations

import pytest
import responses as resp_lib

from curtain import CurtainClient

VALID_KEY = "cai_" + "a" * 64
BASE = "http://test.local/api/v1"

SKILL_PAYLOAD = {
    "id": "skill-uuid-1",
    "workspace_id": "ws-1",
    "name": "Refund Policy",
    "trigger_condition": "Customer requests refund",
    "decision": "Issue refund within 24h",
    "status": "active",
    "version": 1,
    "confidence": None,
    "escalation_required": False,
    "conditions": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}


@resp_lib.activate
def test_create_skill():
    resp_lib.add(
        resp_lib.POST,
        f"{BASE}/skills",
        json={"success": True, "data": SKILL_PAYLOAD},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    skill = client.skills.create(
        name="Refund Policy",
        trigger_condition="Customer requests refund",
        decision="Issue refund within 24h",
    )
    assert skill.id == "skill-uuid-1"
    assert skill.name == "Refund Policy"
    assert skill.is_active


@resp_lib.activate
def test_list_skills_returns_list():
    resp_lib.add(
        resp_lib.GET,
        f"{BASE}/skills",
        json={"success": True, "data": [SKILL_PAYLOAD, {**SKILL_PAYLOAD, "id": "skill-uuid-2"}]},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    skills = client.skills.list()
    assert len(skills) == 2
    assert skills[0].id == "skill-uuid-1"


@resp_lib.activate
def test_approve_skill():
    approved = {**SKILL_PAYLOAD, "status": "active"}
    resp_lib.add(
        resp_lib.PATCH,
        f"{BASE}/skills/skill-uuid-1/approve",
        json={"success": True, "data": approved},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    skill = client.skills.approve("skill-uuid-1")
    assert skill.is_active


@resp_lib.activate
def test_disable_skill():
    disabled = {**SKILL_PAYLOAD, "status": "disabled"}
    resp_lib.add(
        resp_lib.PATCH,
        f"{BASE}/skills/skill-uuid-1/disable",
        json={"success": True, "data": disabled},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    skill = client.skills.disable("skill-uuid-1")
    assert skill.is_disabled


@resp_lib.activate
def test_delete_skill():
    resp_lib.add(resp_lib.DELETE, f"{BASE}/skills/skill-uuid-1", status=204, body="")
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    result = client.skills.delete("skill-uuid-1")
    assert result is None


@resp_lib.activate
def test_iter_skills_paginates():
    page1 = [SKILL_PAYLOAD]
    page2 = [{**SKILL_PAYLOAD, "id": "skill-uuid-2"}]

    resp_lib.add(
        resp_lib.GET, f"{BASE}/skills",
        json={"success": True, "data": {"data": page1, "total": 2, "page": 1, "limit": 1}},
    )
    resp_lib.add(
        resp_lib.GET, f"{BASE}/skills",
        json={"success": True, "data": {"data": page2, "total": 2, "page": 2, "limit": 1}},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    skills = list(client.skills.iter(page_size=1))
    assert len(skills) == 2
