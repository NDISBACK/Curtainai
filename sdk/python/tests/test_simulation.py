"""Tests for the simulation resource."""
from __future__ import annotations

import json

import pytest
import responses as resp_lib

from curtain import CurtainClient, SimulationSkillInput

VALID_KEY = "cai_" + "a" * 64
BASE = "http://test.local/api/v1"

SIM_RESULT = {
    "total_queries": 100,
    "changed_decisions": 12,
    "unchanged": 88,
    "impact_summary": {
        "auto_to_escalate": 2,
        "escalate_to_auto": 5,
        "decision_changed": 5,
        "confidence_shift": 0.03,
    },
    "top_impacted_skills": [],
    "examples": [
        {
            "query_id": "q1",
            "query": "double charge",
            "before": {"decision": "Old decision", "escalate": False, "confidence": 0.8},
            "after": {"decision": "New decision", "escalate": False, "confidence": 0.9},
            "changed": True,
            "change_type": "decision_changed",
        }
    ],
}


@resp_lib.activate
def test_simulation_run():
    resp_lib.add(
        resp_lib.POST, f"{BASE}/simulate",
        json={"success": True, "data": SIM_RESULT},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    modified = SimulationSkillInput(
        id="skill-uuid-1",
        name="Refund Policy v2",
        trigger_condition="Customer requests refund for any charge",
        decision="Issue refund within 12 hours",
    )
    result = client.simulation.run([modified], sample_size=100)
    assert result.total_queries == 100
    assert result.changed_decisions == 12
    assert result.change_rate == pytest.approx(0.12)
    assert result.unchanged == 88
    assert result.impact_summary.escalate_to_auto == 5
    assert result.impact_summary.net_coverage == 3  # 5 - 2


@resp_lib.activate
def test_simulation_passes_query_ids():
    resp_lib.add(
        resp_lib.POST, f"{BASE}/simulate",
        json={"success": True, "data": SIM_RESULT},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    modified = SimulationSkillInput(
        name="New skill",
        trigger_condition="Any trigger",
        decision="Some decision",
    )
    client.simulation.run([modified], query_ids=["q1", "q2", "q3"])

    body = json.loads(resp_lib.calls[0].request.body)
    assert body["query_ids"] == ["q1", "q2", "q3"]
    assert "sample_size" in body
