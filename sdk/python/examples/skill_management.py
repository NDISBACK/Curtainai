"""
Skill management lifecycle example
====================================

Demonstrates the full skill lifecycle:
  1. Create a skill (pending_review)
  2. Approve it (active)
  3. Run a simulation to preview the impact of a proposed edit
  4. Update the skill (resets to pending_review)
  5. Re-approve
  6. Inspect version history and restore a previous version

Run with:
    CURTAIN_API_KEY=cai_... CURTAIN_WORKSPACE_ID=<uuid> python examples/skill_management.py
"""
from __future__ import annotations

import os

from curtain import CurtainClient, SimulationSkillInput
from curtain.exceptions import NotFoundError


BASE_URL = os.environ.get("CURTAIN_BASE_URL", "http://localhost:3000/api/v1")
API_KEY = os.environ.get("CURTAIN_API_KEY", "")
WORKSPACE_ID = os.environ.get("CURTAIN_WORKSPACE_ID", "")


def create_and_approve(client: CurtainClient) -> str:
    """Create a skill and approve it.  Returns the skill ID."""
    skill = client.skills.create(
        name="Subscription Cancellation",
        trigger_condition="Customer wants to cancel their subscription or stop recurring payments",
        decision=(
            "Acknowledge the cancellation request, process it effective end-of-billing-period, "
            "send a confirmation email, and offer a 20% retention discount valid for 48 hours."
        ),
    )
    print(f"Created skill: {skill.id[:8]}…  status={skill.status!r}")

    skill = client.skills.approve(skill.id)
    print(f"Approved skill: {skill.id[:8]}…  status={skill.status!r}")
    return skill.id


def simulate_proposed_change(client: CurtainClient, skill_id: str) -> None:
    """
    Before applying an edit, simulate how it would affect historical queries.
    This is read-only — no state is changed.
    """
    proposed = SimulationSkillInput(
        id=skill_id,
        name="Subscription Cancellation v2",
        trigger_condition=(
            "Customer wants to cancel their subscription, stop recurring charges, "
            "or downgrade their plan"
        ),
        decision=(
            "Process the cancellation effective end-of-billing-period. "
            "Offer a 30% discount (up from 20%) and a 72-hour window to reconsider. "
            "If the customer has been active for 12+ months, escalate to retention team."
        ),
    )

    print("\nRunning simulation (sample_size=50)…")
    result = client.simulation.run([proposed], sample_size=50)

    print(f"  Queries tested:    {result.total_queries}")
    print(f"  Decisions changed: {result.changed_decisions}  ({result.change_rate:.1%})")
    print(f"  Coverage gain:     +{result.impact_summary.escalate_to_auto}  (escalations → auto-resolved)")
    print(f"  Coverage loss:     -{result.impact_summary.auto_to_escalate}  (auto-resolved → escalations)")
    print(f"  Net coverage:      {result.impact_summary.net_coverage:+d}")

    if result.impact_summary.net_coverage >= 0:
        print("  → Simulation looks good — proceeding with the update.")
    else:
        print("  → Net coverage negative — consider revising the change.")


def update_skill(client: CurtainClient, skill_id: str) -> None:
    """Apply the change (resets to pending_review) and re-approve."""
    skill = client.skills.update(
        skill_id,
        trigger_condition=(
            "Customer wants to cancel their subscription, stop recurring charges, "
            "or downgrade their plan"
        ),
        decision=(
            "Process the cancellation effective end-of-billing-period. "
            "Offer a 30% discount and a 72-hour window to reconsider. "
            "If the customer has been active 12+ months, escalate to retention team."
        ),
    )
    print(f"\nUpdated skill — status reset to: {skill.status!r}")

    skill = client.skills.approve(skill_id)
    print(f"Re-approved skill — status: {skill.status!r}")


def inspect_versions(client: CurtainClient, skill_id: str) -> None:
    """List versions and restore the original if we change our mind."""
    versions = client.skills.get_versions(skill_id)
    print(f"\nVersion history ({len(versions)} snapshot(s)):")
    for v in versions:
        print(f"  v{v.version}  created={v.created_at[:10]}  trigger={v.trigger_condition[:60]!r}…")

    if len(versions) >= 1:
        original_version = versions[-1].version  # oldest = lowest version number
        print(f"\nRestoring v{original_version}…")
        try:
            restored = client.skills.restore_version(skill_id, original_version)
            print(f"Restored as new skill: {restored.id[:8]}…  status={restored.status!r}")
            print("(The restored skill starts in pending_review — approve it when ready.)")
        except NotFoundError:
            print("(Version not found — skipping restore)")


def show_analytics(client: CurtainClient, workspace_id: str) -> None:
    if not workspace_id:
        return
    print(f"\nWorkspace analytics (all-time):")
    stats = client.analytics.get_workspace(workspace_id)
    print(f"  Total queries:  {stats.total_queries}")
    print(f"  Match rate:     {stats.match_rate:.1%}")
    print(f"  Escalation rate:{stats.escalation_rate:.1%}")


def main() -> None:
    client = CurtainClient(api_key=API_KEY, workspace_id=WORKSPACE_ID, base_url=BASE_URL)

    print("=== Step 1: Create and approve skill ===")
    skill_id = create_and_approve(client)

    print("\n=== Step 2: Simulate proposed change ===")
    simulate_proposed_change(client, skill_id)

    print("\n=== Step 3: Apply update ===")
    update_skill(client, skill_id)

    print("\n=== Step 4: Version history ===")
    inspect_versions(client, skill_id)

    print("\n=== Step 5: Analytics ===")
    show_analytics(client, WORKSPACE_ID)

    print("\nDone.")


if __name__ == "__main__":
    main()
