"""Tests for the queries resource."""
from __future__ import annotations

import pytest
import responses as resp_lib

from curtain import CurtainClient

VALID_KEY = "cai_" + "a" * 64
BASE = "http://test.local/api/v1"

QUERY_RESULT = {
    "query_id": "qr-uuid-1",
    "decision": "Issue a full refund within 24 hours.",
    "confidence": 0.92,
    "escalate": False,
    "skill_id": "skill-uuid-1",
    "skill_name": "Refund Policy",
    "search_method": "hybrid",
}

ESCALATED_RESULT = {
    "query_id": "qr-uuid-2",
    "decision": None,
    "confidence": None,
    "escalate": True,
    "skill_id": None,
    "skill_name": None,
    "search_method": "no_keyword_match",
}


@resp_lib.activate
def test_run_returns_query_result():
    resp_lib.add(
        resp_lib.POST, f"{BASE}/query",
        json={"success": True, "data": QUERY_RESULT},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    result = client.queries.run("Customer wants a refund")
    assert result.query_id == "qr-uuid-1"
    assert result.escalate is False
    assert result.resolved is True
    assert result.confidence == pytest.approx(0.92)


@resp_lib.activate
def test_run_escalated():
    resp_lib.add(
        resp_lib.POST, f"{BASE}/query",
        json={"success": True, "data": ESCALATED_RESULT},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    result = client.queries.run("Something completely novel")
    assert result.escalate is True
    assert result.resolved is False


@resp_lib.activate
def test_override_returns_override_object():
    override_payload = {
        "id": "ov-uuid-1",
        "query_id": "qr-uuid-2",
        "corrected_decision": "Ship a replacement",
        "created_at": "2024-01-01T00:00:00Z",
    }
    resp_lib.add(
        resp_lib.POST, f"{BASE}/query/override",
        json={"success": True, "data": override_payload},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    override = client.queries.override("qr-uuid-2", "Ship a replacement")
    assert override.id == "ov-uuid-1"
    assert override.corrected_decision == "Ship a replacement"


@resp_lib.activate
def test_list_queries():
    record = {
        "id": "qr-uuid-1",
        "workspace_id": "ws-1",
        "query": "double charge",
        "output": QUERY_RESULT,
        "escalated": False,
        "created_at": "2024-01-01T00:00:00Z",
        "search_method": "hybrid",
    }
    resp_lib.add(
        resp_lib.GET, f"{BASE}/queries",
        json={"success": True, "data": {"data": [record], "total": 1, "page": 1, "limit": 20}},
    )
    client = CurtainClient(api_key=VALID_KEY, base_url=BASE)
    records = client.queries.list()
    assert len(records) == 1
    assert records[0].id == "qr-uuid-1"
