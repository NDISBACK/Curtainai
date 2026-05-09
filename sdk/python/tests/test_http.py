"""Tests for the HTTP transport layer."""
from __future__ import annotations

import pytest
import responses as resp_lib

from curtain._http import HttpTransport
from curtain.exceptions import (
    AuthenticationError,
    ConfigurationError,
    NotFoundError,
    RateLimitError,
    ServerError,
    TransportError,
    ValidationError,
)

VALID_KEY = "cai_" + "a" * 64
BASE = "http://test.local/api/v1"


# ─── Key validation ───────────────────────────────────────────────────────────

def test_valid_key_accepted():
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    assert t._api_key == VALID_KEY


def test_empty_key_raises():
    with pytest.raises(ConfigurationError, match="api_key"):
        HttpTransport(api_key="", base_url=BASE)


def test_malformed_key_raises():
    with pytest.raises(ConfigurationError, match="api_key"):
        HttpTransport(api_key="sk-not-a-curtain-key", base_url=BASE)


def test_key_wrong_length_raises():
    with pytest.raises(ConfigurationError):
        HttpTransport(api_key="cai_" + "a" * 63, base_url=BASE)


# ─── Successful request ───────────────────────────────────────────────────────

@resp_lib.activate
def test_get_unwraps_envelope():
    resp_lib.add(
        resp_lib.GET,
        f"{BASE}/skills",
        json={"success": True, "data": [{"id": "s1", "name": "Test"}]},
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    data = t.get("/skills")
    assert data == [{"id": "s1", "name": "Test"}]


@resp_lib.activate
def test_post_sends_json_body():
    resp_lib.add(
        resp_lib.POST,
        f"{BASE}/query",
        json={"success": True, "data": {"decision": "Refund issued", "escalate": False, "confidence": 0.95, "query_id": "q1"}},
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    data = t.post("/query", json={"query": "double charge"})
    assert data["decision"] == "Refund issued"


@resp_lib.activate
def test_delete_returns_none_on_204():
    resp_lib.add(resp_lib.DELETE, f"{BASE}/skills/s1", status=204, body="")
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    result = t.delete("/skills/s1")
    assert result is None


# ─── Auth header ──────────────────────────────────────────────────────────────

@resp_lib.activate
def test_authorization_header_attached():
    resp_lib.add(
        resp_lib.GET,
        f"{BASE}/skills",
        json={"success": True, "data": []},
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    t.get("/skills")
    assert resp_lib.calls[0].request.headers["Authorization"] == f"Bearer {VALID_KEY}"


# ─── Error mapping ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("status,exc_class", [
    (400, ValidationError),
    (401, AuthenticationError),
    (404, NotFoundError),
    (429, RateLimitError),
    (500, ServerError),
    (503, ServerError),
])
@resp_lib.activate
def test_error_status_codes(status: int, exc_class: type):
    resp_lib.add(
        resp_lib.GET,
        f"{BASE}/skills",
        json={"success": False, "error": "something went wrong"},
        status=status,
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    with pytest.raises(exc_class):
        t.get("/skills")


@resp_lib.activate
def test_rate_limit_exposes_retry_after():
    resp_lib.add(
        resp_lib.GET,
        f"{BASE}/skills",
        json={"success": False, "error": "rate limit"},
        status=429,
        headers={"Retry-After": "5"},
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    with pytest.raises(RateLimitError) as exc_info:
        t.get("/skills")
    assert exc_info.value.retry_after == 5.0


# ─── Retry behaviour ──────────────────────────────────────────────────────────

@resp_lib.activate
def test_retries_on_500_then_succeeds(monkeypatch):
    import time
    monkeypatch.setattr(time, "sleep", lambda _: None)

    resp_lib.add(
        resp_lib.GET, f"{BASE}/skills",
        json={"success": False, "error": "internal error"}, status=500,
    )
    resp_lib.add(
        resp_lib.GET, f"{BASE}/skills",
        json={"success": True, "data": []},
    )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    data = t.get("/skills")
    assert data == []
    assert len(resp_lib.calls) == 2


@resp_lib.activate
def test_exhausts_retries_raises_server_error(monkeypatch):
    import time
    monkeypatch.setattr(time, "sleep", lambda _: None)

    for _ in range(3):  # MAX_RETRIES=3 total attempts
        resp_lib.add(
            resp_lib.GET, f"{BASE}/skills",
            json={"success": False, "error": "internal error"}, status=500,
        )
    t = HttpTransport(api_key=VALID_KEY, base_url=BASE)
    with pytest.raises(ServerError):
        t.get("/skills")
    assert len(resp_lib.calls) == 3
