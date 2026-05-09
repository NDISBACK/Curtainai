"""
Basic integration example
=========================

Demonstrates the full Curtain workflow:
  1. Create a workspace (one-time setup)
  2. Generate an API key
  3. Add and approve skills
  4. Run customer queries
  5. Submit a human correction

Run with:
    CURTAIN_BASE_URL=http://localhost:3000/api/v1 python examples/basic_integration.py
"""
from __future__ import annotations

import os

from curtain import CurtainClient
from curtain.exceptions import DuplicateSkillError


BASE_URL = os.environ.get("CURTAIN_BASE_URL", "http://localhost:3000/api/v1")


def setup_workspace(client: CurtainClient) -> tuple[str, str]:
    """Create a workspace and an API key, return (workspace_id, raw_api_key)."""
    ws = client.workspaces.create("Acme Support")
    print(f"Created workspace: {ws.id}  name={ws.name!r}")

    created = client.workspaces.create_api_key(ws.id, "primary")
    print(f"API key created: {created.key[:12]}...  (save this — shown once)")
    return ws.id, created.key


def seed_skills(client: CurtainClient) -> None:
    """Add a handful of skills and approve them."""
    definitions = [
        {
            "name": "Duplicate Charge Refund",
            "trigger_condition": "Customer was charged twice for the same order or subscription",
            "decision": "Verify the duplicate charge in billing, issue a full refund for the extra charge, and send the customer a confirmation email within 24 hours.",
        },
        {
            "name": "Shipping Delay Apology",
            "trigger_condition": "Customer's order is late or has not arrived by the expected delivery date",
            "decision": "Apologise for the delay, provide the current tracking status, and offer a 10% discount on the next order if the delay exceeds 5 business days.",
        },
        {
            "name": "Password Reset",
            "trigger_condition": "Customer cannot log in or has forgotten their password",
            "decision": "Send a password reset link to the verified email address on the account. If the customer no longer has access to that email, escalate to security review.",
        },
    ]

    for defn in definitions:
        try:
            skill = client.skills.create(**defn)
            client.skills.approve(skill.id)
            print(f"  ✓ Skill created & approved: {skill.name!r}  [{skill.id[:8]}]")
        except DuplicateSkillError:
            print(f"  ~ Skill already exists (skipped): {defn['name']!r}")


def run_queries(client: CurtainClient) -> list[str]:
    """Run sample queries and return query IDs with escalations."""
    samples = [
        "I was charged twice for my subscription last month",
        "My package hasn't arrived and it's been 10 days",
        "I forgot my password and can't get in",
        "I want to return a damaged product",          # no matching skill → escalate
    ]

    escalated_ids: list[str] = []

    print("\n── Query results ──────────────────────────────────────────")
    for query in samples:
        result = client.queries.run(query)
        status = "ESCALATE" if result.escalate else f"AUTO  ({result.confidence:.0%})"
        print(f"  [{status}]  {query[:60]}")
        if not result.escalate:
            print(f"           → {result.decision[:80]}")
        if result.escalate:
            escalated_ids.append(result.query_id)

    return escalated_ids


def submit_correction(client: CurtainClient, query_id: str) -> None:
    """Demonstrate overriding an escalated decision."""
    override = client.queries.override(
        query_id,
        corrected_decision=(
            "Inspect the damaged item photos, approve a replacement shipment, "
            "and waive return postage costs."
        ),
    )
    print(f"\nOverride submitted for query {query_id[:8]}…  id={override.id[:8]}")


def print_skill_summary(client: CurtainClient) -> None:
    print("\n── Active skills ──────────────────────────────────────────")
    for skill in client.skills.iter(status="active"):
        print(f"  • {skill.name!r}")


def main() -> None:
    # Bootstrap client — no API key needed for workspace creation
    bootstrap = CurtainClient(api_key="", base_url=BASE_URL)

    print("=== Step 1: Workspace setup ===")
    workspace_id, raw_key = setup_workspace(bootstrap)

    # Real client with actual key
    client = CurtainClient(api_key=raw_key, base_url=BASE_URL)

    print("\n=== Step 2: Seed skills ===")
    seed_skills(client)

    print("\n=== Step 3: Run queries ===")
    escalated = run_queries(client)

    if escalated:
        print("\n=== Step 4: Human correction ===")
        submit_correction(client, escalated[0])

    print_skill_summary(client)

    print(f"\nDone.  workspace_id={workspace_id}")
    print(f"       export CURTAIN_API_KEY={raw_key}")
    print(f"       export CURTAIN_WORKSPACE_ID={workspace_id}")


if __name__ == "__main__":
    main()
