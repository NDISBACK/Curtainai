"""
HTTP transport layer for the Curtain AI SDK.

Two concrete transports are provided:

- :class:`HttpTransport` — synchronous, backed by ``requests.Session``.
  Thread-safe; reuses a single connection pool across all requests.

- :class:`AsyncHttpTransport` — asynchronous, backed by ``httpx.AsyncClient``.
  Must be used as an async context manager (or closed explicitly) to release
  connections.

Both transports share:

- Automatic Bearer-token injection
- Envelope unwrapping (``{ success, data }`` → returns ``data``)
- Typed exception mapping from HTTP status codes
- Exponential back-off retry on 429 and 5xx (max 3 attempts)
- API key format validation at construction time
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Dict, Optional

import httpx
import requests

from .exceptions import (
    ConfigurationError,
    TransportError,
    _make_api_error,
)

log = logging.getLogger("curtain")

# ─── Constants ────────────────────────────────────────────────────────────────

_SDK_VERSION = "0.1.0"
_USER_AGENT = f"curtain-python-sdk/{_SDK_VERSION}"
_API_KEY_RE = re.compile(r"^cai_[0-9a-f]{64}$")

DEFAULT_TIMEOUT: float = 30.0
MAX_RETRIES: int = 3
INITIAL_BACKOFF: float = 1.0
BACKOFF_FACTOR: float = 2.0
_RETRYABLE = frozenset({429, 500, 502, 503})


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _validate_api_key(api_key: str) -> None:
    if not api_key:
        raise ConfigurationError("api_key is required.")
    if not _API_KEY_RE.match(api_key):
        raise ConfigurationError(
            "Invalid api_key format. Expected 'cai_' followed by exactly "
            "64 lowercase hexadecimal characters."
        )


def _build_base_url(base_url: str) -> str:
    url = base_url.rstrip("/")
    if not url.startswith(("http://", "https://")):
        raise ConfigurationError(
            f"base_url must start with 'http://' or 'https://'. Got: {base_url!r}"
        )
    return url


def _unwrap(body: Any, status_code: int) -> Any:
    """
    Unwrap the server's ``{ success, data }`` envelope.

    On success returns ``data`` (may be ``None`` for 204-equivalent responses).
    On failure raises the appropriate typed :class:`~curtain.exceptions.APIError`.
    """
    if not isinstance(body, dict):
        # Bare non-JSON or unexpected shape — treat as server error
        raise _make_api_error(status_code, f"Unexpected response shape: {body!r}")

    if body.get("success") is True:
        return body.get("data")

    error_msg: str = str(body.get("error") or f"HTTP {status_code}")
    correlation_id: Optional[str] = body.get("correlation_id")
    retry_after: Optional[float] = None  # populated by callers from headers

    raise _make_api_error(status_code, error_msg, correlation_id, retry_after)


def _retry_after(headers: Any) -> Optional[float]:
    val = headers.get("Retry-After")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


# ─── Sync transport ───────────────────────────────────────────────────────────

class HttpTransport:
    """
    Synchronous HTTP transport backed by ``requests.Session``.

    The session is reused across all requests for HTTP keep-alive.
    Thread-safe for concurrent use within a single process.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000/api/v1",
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        _validate_api_key(api_key)
        self._api_key = api_key
        self._base_url = _build_base_url(base_url)
        self._base = self._base_url  # internal alias used by _request
        self._timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": _USER_AGENT,
            }
        )

    # ── Public interface ───────────────────────────────────────────────────

    def get(self, path: str, *, params: Optional[Dict[str, Any]] = None) -> Any:
        return self._request("GET", path, params=params)

    def post(self, path: str, *, json: Optional[Any] = None) -> Any:
        return self._request("POST", path, json=json)

    def patch(self, path: str, *, json: Optional[Any] = None) -> Any:
        return self._request("PATCH", path, json=json)

    def delete(self, path: str) -> None:
        self._request("DELETE", path)

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "HttpTransport":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── Internal ───────────────────────────────────────────────────────────

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
    ) -> Any:
        url = f"{self._base}/{path.lstrip('/')}"
        # Strip None-valued params so they're not sent as "?key=None"
        clean_params = {k: v for k, v in (params or {}).items() if v is not None} or None

        for attempt in range(MAX_RETRIES):
            try:
                resp = self._session.request(
                    method,
                    url,
                    params=clean_params,
                    json=json,
                    timeout=self._timeout,
                )
            except requests.exceptions.Timeout as exc:
                raise TransportError(
                    f"Request timed out after {self._timeout}s ({method} {url})"
                ) from exc
            except requests.exceptions.ConnectionError as exc:
                raise TransportError(
                    f"Connection error ({method} {url}): {exc}"
                ) from exc

            # 204 No Content — success with no body
            if resp.status_code == 204:
                return None

            try:
                body = resp.json()
            except Exception:
                body = {"success": False, "error": resp.text or f"HTTP {resp.status_code}"}

            if resp.status_code in _RETRYABLE and attempt < MAX_RETRIES - 1:
                delay = _retry_after(resp.headers) or (
                    INITIAL_BACKOFF * (BACKOFF_FACTOR ** attempt)
                )
                log.debug(
                    "Retrying %s %s (attempt %d/%d) after %.1fs — status %d",
                    method,
                    url,
                    attempt + 1,
                    MAX_RETRIES,
                    delay,
                    resp.status_code,
                )
                time.sleep(delay)
                continue

            # For rate-limit errors, attach retry_after before raising
            if resp.status_code == 429:
                ra = _retry_after(resp.headers)
                error_msg = str(
                    body.get("error") if isinstance(body, dict) else f"HTTP 429"
                )
                from .exceptions import _make_api_error
                raise _make_api_error(429, error_msg, None, ra)

            return _unwrap(body, resp.status_code)

        # Should never reach here, but satisfy the type checker
        raise TransportError(f"All {MAX_RETRIES} retry attempts exhausted ({method} {url})")


# ─── Async transport ──────────────────────────────────────────────────────────

class AsyncHttpTransport:
    """
    Asynchronous HTTP transport backed by ``httpx.AsyncClient``.

    Must be closed when done to release connection-pool resources::

        async with AsyncHttpTransport(...) as t:
            data = await t.get("/health")

        # or manually:
        t = AsyncHttpTransport(...)
        await t.close()
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000/api/v1",
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        _validate_api_key(api_key)
        self._api_key = api_key
        self._base_url = _build_base_url(base_url)
        self._base = self._base_url
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": _USER_AGENT,
            },
            timeout=timeout,
        )

    # ── Public interface ───────────────────────────────────────────────────

    async def get(self, path: str, *, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, *, json: Optional[Any] = None) -> Any:
        return await self._request("POST", path, json=json)

    async def patch(self, path: str, *, json: Optional[Any] = None) -> Any:
        return await self._request("PATCH", path, json=json)

    async def delete(self, path: str) -> None:
        await self._request("DELETE", path)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncHttpTransport":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()

    # ── Internal ───────────────────────────────────────────────────────────

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
    ) -> Any:
        url = f"{self._base}/{path.lstrip('/')}"
        clean_params = {k: v for k, v in (params or {}).items() if v is not None} or None

        for attempt in range(MAX_RETRIES):
            try:
                resp = await self._client.request(
                    method,
                    url,
                    params=clean_params,
                    json=json,
                )
            except httpx.TimeoutException as exc:
                raise TransportError(
                    f"Request timed out ({method} {url})"
                ) from exc
            except httpx.ConnectError as exc:
                raise TransportError(
                    f"Connection error ({method} {url}): {exc}"
                ) from exc

            if resp.status_code == 204:
                return None

            try:
                body = resp.json()
            except Exception:
                body = {"success": False, "error": resp.text or f"HTTP {resp.status_code}"}

            if resp.status_code in _RETRYABLE and attempt < MAX_RETRIES - 1:
                delay = _retry_after(resp.headers) or (
                    INITIAL_BACKOFF * (BACKOFF_FACTOR ** attempt)
                )
                log.debug(
                    "Retrying %s %s (attempt %d/%d) after %.1fs — status %d",
                    method,
                    url,
                    attempt + 1,
                    MAX_RETRIES,
                    delay,
                    resp.status_code,
                )
                await asyncio.sleep(delay)
                continue

            if resp.status_code == 429:
                ra = _retry_after(resp.headers)
                error_msg = str(
                    body.get("error") if isinstance(body, dict) else "HTTP 429"
                )
                from .exceptions import _make_api_error
                raise _make_api_error(429, error_msg, None, ra)

            return _unwrap(body, resp.status_code)

        raise TransportError(f"All {MAX_RETRIES} retry attempts exhausted ({method} {url})")
