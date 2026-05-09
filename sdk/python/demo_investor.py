"""
Curtain AI  Investor Demo
==========================
Run: python demo_investor.py
Requires: CURTAIN_API_KEY and CURTAIN_WORKSPACE_ID set (or edit the constants below).
"""

import os
import sys
import time
import textwrap
from datetime import datetime, timedelta, timezone

# ── Configure these if you're not using env vars ──────────────────────────────
API_KEY      = os.getenv("CURTAIN_API_KEY",      "cai_56bf852488119dfec00efc2114ef9be08d0169a297a01638d86bfa0fc7608624")
WORKSPACE_ID = os.getenv("CURTAIN_WORKSPACE_ID", "9e091037-af87-48a1-b8f8-aa1225988016")
BASE_URL     = os.getenv("CURTAIN_BASE_URL",     "http://localhost:3000/api/v1")
# ─────────────────────────────────────────────────────────────────────────────


# ── Pretty printing helpers ───────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RED    = "\033[91m"
DIM    = "\033[2m"


def banner(title: str) -> None:
    width = 64
    print()
    print(CYAN + "─" * width + RESET)
    print(CYAN + BOLD + f"  {title}" + RESET)
    print(CYAN + "─" * width + RESET)


def ok(label: str, value: object = "") -> None:
    print(f"  {GREEN}✓{RESET} {BOLD}{label}{RESET}  {DIM}{value}{RESET}")


def info(label: str, value: object = "") -> None:
    print(f"  {CYAN}→{RESET} {label}  {DIM}{value}{RESET}")


def warn(label: str, value: object = "") -> None:
    print(f"  {YELLOW}⚠{RESET} {label}  {DIM}{value}{RESET}")


def step(n: int, title: str) -> None:
    print()
    print(BOLD + f"[{n}] {title}" + RESET)


def pretty_decision(result) -> None:
    escalate_str = (RED + "ESCALATE → human agent" + RESET
                    if result.escalate else
                    GREEN + "AUTO-RESOLVE" + RESET)
    print(f"\n    Decision  : {BOLD}{result.decision}{RESET}")
    print(f"    Confidence: {YELLOW}{result.confidence:.0%}{RESET}")
    print(f"    Routing   : {escalate_str}\n")


# ── SDK import ────────────────────────────────────────────────────────────────

try:
    from curtain import CurtainClient
    from curtain.exceptions import CurtainError, DuplicateSkillError, NotFoundError
except ModuleNotFoundError:
    sys.exit(
        "\n  SDK not installed. Run:\n"
        "    pip install -e sdk/python\n"
        "  or:\n"
        "    pip install curtain-ai\n"
    )


# ─────────────────────────────────────────────────────────────────────────────
# DEMO
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print()
    print(BOLD + "  Curtain AI – Live SDK Demo" + RESET)
    print(DIM  + "  Turning support know-how into automated decisions\n" + RESET)

    client = CurtainClient(
        api_key=API_KEY,
        workspace_id=WORKSPACE_ID,
        base_url=BASE_URL,
    )

    skill_ids: list[str] = []   # collect IDs for cleanup at the end

    DEMO_SKILL_NAMES = {
        "Duplicate Charge – Full Refund",
        "Subscription Cancellation",
        "Account Locked – Security Review",
        "Product Defect – Replacement",
    }

    # ── 0. Pre-flight cleanup (handles crashed previous runs) ─────────────────
    leftover = [s for s in client.skills.iter() if s.name in DEMO_SKILL_NAMES]
    if leftover:
        info(f"Cleaning up {len(leftover)} leftover skill(s) from a previous run …")
        for s in leftover:
            try:
                if s.status == "active":
                    client.skills.disable(s.id)
                client.skills.delete(s.id)
            except (CurtainError, NotFoundError):
                pass
        ok("Workspace is clean")


    # ── 1. Health check ───────────────────────────────────────────────────────
    banner("1 · Health Check")
    try:
        import requests
        r = requests.get(BASE_URL.replace("/api/v1", "/api/v1/health"), timeout=5)
        r.raise_for_status()
        ok("API reachable", r.json().get("status", "ok"))
    except Exception as e:
        warn("Health check failed", e)


    # ── 2. Create skills ──────────────────────────────────────────────────────
    banner("2 · Create Skills")
    info("Adding the support playbook as machine-readable skills …")

    skills_payload = [
        dict(
            name="Duplicate Charge – Full Refund",
            trigger_condition="Customer reports being charged twice or sees a duplicate payment on their account",
            decision="Verify the duplicate charge in the billing system and issue a full refund. Refund appears within 3–5 business days. Notify the customer by email.",
            escalation_required=False,
        ),
        dict(
            name="Subscription Cancellation",
            trigger_condition="Customer wants to cancel their subscription or stop recurring billing",
            decision="Confirm identity, cancel the subscription effective end-of-billing-period, send confirmation email with cancellation reference number.",
            escalation_required=False,
        ),
        dict(
            name="Account Locked – Security Review",
            trigger_condition="Customer account is locked due to suspicious activity or failed login attempts",
            decision="Escalate to the security team for manual identity verification before unlocking. Do not unlock remotely.",
            escalation_required=True,
        ),
        dict(
            name="Product Defect – Replacement",
            trigger_condition="Customer received a defective, broken, or incorrect item",
            decision="Apologise, arrange free return shipping, and dispatch a replacement within 2 business days.",
            escalation_required=False,
        ),
    ]

    for payload in skills_payload:
        try:
            skill = client.skills.create(**payload)
            skill_ids.append(skill.id)
            ok(f"Created  [{skill.status}]", f"{skill.name}  (id: {skill.id[:8]}…)")
        except DuplicateSkillError:
            warn(f"Skipped duplicate", payload["name"])

    print()
    info("Approving all skills → active …")
    for sid in skill_ids:
        client.skills.approve(sid)
    ok("All skills are now", "active")


    # ── 3. Run queries ────────────────────────────────────────────────────────
    banner("3 · Query Engine – Real-Time Decisions")
    info("Sending live customer messages through the decision engine …\n")

    queries = [
        "Hi, I just noticed my card was charged twice this month — can you help?",
        "I'd like to cancel my plan, please.",
        "I can't log in; it says my account is locked.",
        "My package arrived smashed. The screen is cracked.",
        "What are your office hours?",          # ← intentional escalation
    ]

    for q in queries:
        print(f"  {DIM}Customer:{RESET} \"{textwrap.shorten(q, 70)}\"")
        try:
            result = client.queries.run(q)
            pretty_decision(result)
        except CurtainError as e:
            warn("Query error", e)
        time.sleep(0.3)   # pacing for live demo readability


    # ── 4. Skill extraction from conversation ─────────────────────────────────
    banner("4 · Skill Extraction – Learn from Transcripts")
    info("Feeding a raw support transcript to the extraction engine …\n")

    transcript = textwrap.dedent("""\
        Agent: Thanks for reaching out! How can I help you today?
        Customer: I was overcharged — my invoice shows $99 but my plan is $49.
        Agent: I can see the error on our side. I'll issue a $50 credit to your account right now and adjust your next invoice automatically.
        Customer: Perfect, thank you.
        ---
        Agent: Hello, what brings you in today?
        Customer: I moved to a new address and need to update my shipping info before my next order ships tomorrow.
        Agent: Got it. I've updated your address in the system and flagged the warehouse to use the new address for your pending order.
        Customer: Great, that's a relief!
    """)

    extracted = client.extraction.extract(transcript)
    print(f"  {GREEN}✓{RESET} Extracted {BOLD}{len(extracted)} skills{RESET} from transcript:\n")
    for s in extracted:
        print(f"    {BOLD}{s.name}{RESET}  (confidence {YELLOW}{s.confidence:.0%}{RESET})")
        print(f"    Trigger : {DIM}{s.trigger_condition}{RESET}")
        print(f"    Decision: {DIM}{s.decision}{RESET}\n")


    # ── 5. Human-in-the-loop correction ──────────────────────────────────────
    banner("5 · Human Correction (Override)")
    info("Submitting a correction when the engine mis-routes a query …\n")

    edge_case = "My account was hacked and I need to reset everything immediately."
    print(f"  {DIM}Customer:{RESET} \"{edge_case}\"")
    result = client.queries.run(edge_case)
    pretty_decision(result)

    override = client.queries.override(
        result.query_id,
        "Escalate immediately to the security team. Initiate account freeze protocol. Do not share account details until identity is verified.",
    )
    ok("Override recorded", f"query_id: {result.query_id[:8]}…")
    info("This correction re-trains the system's decision patterns automatically.")


    # ── 6. Version history ────────────────────────────────────────────────────
    banner("6 · Skill Versioning – Full Audit Trail")
    target_id = skill_ids[0]
    info(f"Editing skill {target_id[:8]}… and inspecting version history …\n")

    client.skills.update(
        target_id,
        decision="Issue a full refund AND a $10 courtesy credit. Notify by email and SMS.",
    )
    versions = client.skills.get_versions(target_id)
    print(f"  {GREEN}✓{RESET} {BOLD}{len(versions)} versions{RESET} on record:\n")
    for v in versions:
        ts = v.created_at.strftime("%Y-%m-%dT%H:%M:%S") if hasattr(v.created_at, "strftime") else str(v.created_at)[:19]
        print(f"    v{v.version}  {DIM}{ts}{RESET}  →  {v.decision[:60]}…")


    # ── 7. Analytics snapshot ─────────────────────────────────────────────────
    banner("7 · Analytics")
    now  = datetime.now(tz=timezone.utc)
    from_ = (now - timedelta(days=30)).isoformat()
    to_   = now.isoformat()

    try:
        stats = client.analytics.get_workspace(WORKSPACE_ID, from_=from_, to=to_)
        print(f"\n  30-day workspace stats:\n")
        print(f"    Total queries  : {BOLD}{stats.total_queries}{RESET}")
        print(f"    Auto-resolved  : {GREEN}{stats.matched_queries}{RESET}")
        print(f"    Escalated      : {YELLOW}{stats.escalated_queries}{RESET}")
        print(f"    Match rate     : {BOLD}{stats.match_rate:.1%}{RESET}\n")
    except (CurtainError, AttributeError) as e:
        info("Analytics (no data yet in fresh workspace)", str(e)[:80])


    # ── 8. Export as OpenAI tool schema ──────────────────────────────────────
    banner("8 · Export – Drop into any AI Stack")
    try:
        exported = client.skills.export(format="openai_functions")
        count = len(exported) if isinstance(exported, list) else "—"
        ok(f"Exported {count} active skills as OpenAI function schemas")
        info("Plug directly into GPT-4 / Claude tool-use calls — zero extra config.")
    except CurtainError as e:
        warn("Export skipped", e)


    # ── 9. Cleanup ────────────────────────────────────────────────────────────
    banner("9 · Cleanup")
    info("Deleting demo skills …")
    for sid in skill_ids:
        try:
            client.skills.disable(sid)
            client.skills.delete(sid)
            ok("Deleted", sid[:8] + "…")
        except (CurtainError, NotFoundError):
            pass


    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print(CYAN + "─" * 64 + RESET)
    print(BOLD + "  Demo complete. What Curtain gives you:\n" + RESET)
    items = [
        "Structured skill library  — your team's know-how, machine-readable",
        "Instant query routing     — right decision in milliseconds",
        "Auto-learning             — extract skills from any support transcript",
        "Human-in-the-loop         — corrections feed back into the system",
        "Full audit trail          — immutable version history per skill",
        "Plug-and-play exports     — OpenAI functions, MCP tools, LangChain",
        "Analytics                 — match rate, coverage, confidence trends",
    ]
    for item in items:
        print(f"  {GREEN}✓{RESET}  {item}")
    print()
    print(CYAN + "─" * 64 + RESET)
    print()


if __name__ == "__main__":
    main()
