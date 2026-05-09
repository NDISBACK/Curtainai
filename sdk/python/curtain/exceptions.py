"""
Exception hierarchy for the Curtain AI Python SDK.

Every non-2xx response from the API is mapped to a typed exception so callers
can handle specific failure modes with ``except CurtainError`` or narrow
handlers like ``except NotFoundError``.

HTTP status → exception class:
  400  ValidationError
  401  AuthenticationError
  403  PermissionError
  404  NotFoundError
  409  DuplicateSkillError
  422  UnprocessableError
  429  RateLimitError        (SDK retries automatically before raising)
  5xx  ServerError
"""
from __future__ import annotations

from typing import Optional


class CurtainError(Exception):
    """Base class for every exception raised by the Curtain SDK."""

    message: str
    http_status: Optional[int]
    correlation_id: Optional[str]

    def __init__(
        self,
        message: str,
        http_status: Optional[int] = None,
        correlation_id: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.http_status = http_status
        self.correlation_id = correlation_id

    def __repr__(self) -> str:
        parts = [f"message={self.message!r}"]
        if self.http_status is not None:
            parts.append(f"http_status={self.http_status}")
        if self.correlation_id is not None:
            parts.append(f"correlation_id={self.correlation_id!r}")
        return f"{type(self).__name__}({', '.join(parts)})"


class ConfigurationError(CurtainError):
    """
    Raised when the SDK is misconfigured before any network request is made.

    Common causes:
    - ``api_key`` is missing, empty, or not in ``cai_<64hex>`` format
    - ``base_url`` is malformed or missing the protocol prefix
    """


class TransportError(CurtainError):
    """
    Raised when a network-level error occurs (no HTTP response was received).

    Common causes: connection refused, DNS failure, timeout, SSL error.
    """


class APIError(CurtainError):
    """
    Raised when the server returns a non-2xx response.

    All subclasses preserve ``http_status`` and the ``correlation_id`` returned
    by the server (useful for filing bug reports).
    """


class AuthenticationError(APIError):
    """
    401 – The API key is missing, malformed, expired, or revoked.

    Re-generate your key from the Curtain dashboard or via
    ``client.workspaces.create_api_key()``.
    """


class PermissionError(APIError):  # noqa: A001 (shadows builtin intentionally in SDK context)
    """403 – The API key does not have permission to access this resource."""


class NotFoundError(APIError):
    """
    404 – The requested resource (skill, workspace, query, etc.) does not exist.

    Also returned for cross-workspace access attempts to prevent ID enumeration.
    """


class ValidationError(APIError):
    """
    400 – The request body or query parameters failed server-side validation.

    ``exception.message`` contains the specific field errors returned by the
    server's Zod schema.
    """


class DuplicateSkillError(APIError):
    """
    409 – A skill with a semantically similar ``trigger_condition`` already exists.

    The server runs vector + Jaccard deduplication on every create/update.
    Inspect ``exception.message`` to find the conflicting skill name.
    """


class UnprocessableError(APIError):
    """
    422 – The request was structurally valid but the LLM pipeline returned
    malformed output (e.g., invalid JSON from the model).
    """


class RateLimitError(APIError):
    """
    429 – Rate limit exceeded (100 requests/minute per workspace).

    The SDK retries automatically with exponential back-off.  This exception
    is only raised when **all retry attempts are exhausted**.

    ``retry_after`` is the suggested wait time in seconds, parsed from the
    ``Retry-After`` response header when present.
    """

    retry_after: Optional[float]

    def __init__(
        self,
        message: str,
        retry_after: Optional[float] = None,
        http_status: int = 429,
        correlation_id: Optional[str] = None,
    ) -> None:
        super().__init__(message, http_status=http_status, correlation_id=correlation_id)
        self.retry_after = retry_after


class ServerError(APIError):
    """
    500 / 502 / 503 – The Curtain server encountered an internal error.

    The ``correlation_id`` attribute can be provided to Curtain support for
    server-side log lookup.
    """


# ─── Internal factory ─────────────────────────────────────────────────────────

_STATUS_TO_EXC: dict[int, type[APIError]] = {
    400: ValidationError,
    401: AuthenticationError,
    403: PermissionError,
    404: NotFoundError,
    409: DuplicateSkillError,
    422: UnprocessableError,
    429: RateLimitError,
    500: ServerError,
    502: ServerError,
    503: ServerError,
}


def _make_api_error(
    status_code: int,
    message: str,
    correlation_id: Optional[str] = None,
    retry_after: Optional[float] = None,
) -> APIError:
    """Map an HTTP status code to the appropriate typed exception."""
    cls = _STATUS_TO_EXC.get(status_code, APIError)
    if cls is RateLimitError:
        return RateLimitError(
            message,
            retry_after=retry_after,
            correlation_id=correlation_id,
        )
    return cls(message, http_status=status_code, correlation_id=correlation_id)
