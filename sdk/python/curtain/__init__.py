"""
Curtain AI Python SDK
~~~~~~~~~~~~~~~~~~~~~

Official Python client for the Curtain decision engine API.

Quick start::

    from curtain import CurtainClient

    client = CurtainClient(api_key="cai_...", workspace_id="ws-uuid")

    result = client.queries.run("Customer was double-charged in April")
    if result.escalate:
        route_to_human(result.query_id)
    else:
        send_to_customer(result.decision)

Async::

    from curtain import AsyncCurtainClient

    async with AsyncCurtainClient(api_key="cai_...") as client:
        result = await client.queries.run("Customer wants a refund")
"""

from .client import AsyncCurtainClient, CurtainClient
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    CurtainError,
    DuplicateSkillError,
    NotFoundError,
    PermissionError,
    RateLimitError,
    ServerError,
    TransportError,
    UnprocessableError,
    ValidationError,
)
from .models import (
    ApiKey,
    CreatedApiKey,
    ExtractedSkill,
    ImportResult,
    ImportSkillPayload,
    QueryRecord,
    QueryResult,
    Override,
    Skill,
    SkillAnalytics,
    SkillStatus,
    SkillVersion,
    SimulationImpactSummary,
    SimulationResult,
    SimulationSkillInput,
    WorkspaceAnalytics,
    Workspace,
)

__version__ = "0.1.0"
__all__ = [
    # Clients
    "CurtainClient",
    "AsyncCurtainClient",
    # Exceptions
    "CurtainError",
    "ConfigurationError",
    "TransportError",
    "APIError",
    "AuthenticationError",
    "PermissionError",
    "NotFoundError",
    "ValidationError",
    "DuplicateSkillError",
    "UnprocessableError",
    "RateLimitError",
    "ServerError",
    # Models — responses
    "Workspace",
    "Skill",
    "SkillStatus",
    "SkillVersion",
    "SkillAnalytics",
    "QueryResult",
    "QueryRecord",
    "Override",
    "ExtractedSkill",
    "SimulationImpactSummary",
    "SimulationResult",
    "WorkspaceAnalytics",
    "ApiKey",
    "CreatedApiKey",
    "ImportResult",
    # Models — inputs
    "SimulationSkillInput",
    "ImportSkillPayload",
    # Meta
    "__version__",
]
