"""
Curtain AI – MCP Server Demo
=============================
Shows how any AI agent (Claude, GPT-4, LangChain, etc.) uses Curtain
as a live tool via the Model Context Protocol.

Run: python demo_mcp.py
Requires: CURTAIN_API_KEY (and optionally CURTAIN_BASE_URL).
"""

import os
import sys
import json
import time
import textwrap
import requests

# ── Configure ─────────────────────────────────────────────────────────────────
API_KEY  = os.getenv("CURTAIN_API_KEY",  "cai_56bf852488119dfec00efc2114ef9be08d0169a297a01638d86bfa0fc7608624")
BASE_URL = os.getenv("CURTAIN_BASE_URL", "http://localhost:3000")
MCP_URL  = BASE_URL.rstrip("/") + "/mcp/v1"
# ─────────────────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RED    = "\033[91m"
DIM    = "\033[2m"
PURPLE = "\033[95m"

API_URL = BASE_URL.rstrip("/") + "/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

_rpc_id = 0

def rpc(method: str, params: dict | None = None) -> dict:
    global _rpc_id
    _rpc_id += 1
    payload = {"jsonrpc": "2.0", "id": _rpc_id, "method": method}
    if params:
        payload["params"] = params
    try:
        r = requests.post(MCP_URL, headers=HEADERS, json=payload, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        print(f"\n  {RED}✗ Network error: {e}{RESET}\n")
        sys.exit(1)


def banner(title: str) -> None:
    print()
    print(CYAN + "─" * 66 + RESET)
    print(CYAN + BOLD + f"  {title}" + RESET)
    print(CYAN + "─" * 66 + RESET)


def label(tag: str, color: str = DIM) -> str:
    return f"{BOLD}{tag}{RESET}"


def print_json(obj: dict, indent: int = 4) -> None:
    lines = json.dumps(obj, indent=2).splitlines()
    for line in lines:
        print(" " * indent + DIM + line + RESET)


def agent_thinks(thought: str) -> None:
    print(f"\n  {PURPLE}🤖 Agent:{RESET} {DIM}{thought}{RESET}")


def agent_says(message: str) -> None:
    print(f"  {PURPLE}🤖 Agent response:{RESET} {BOLD}\"{message}\"{RESET}\n")


def customer_says(message: str) -> None:
    print(f"\n  {CYAN}👤 Customer:{RESET} \"{textwrap.shorten(message, 72)}\"")


# ─────────────────────────────────────────────────────────────────────────────
# DEMO
# ─────────────────────────────────────────────────────────────────────────────

DEMO_SKILLS = [
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

def api(method: str, path: str, **kwargs):
    """Call the REST API and unwrap the { success, data } envelope."""
    fn = getattr(requests, method)
    r = fn(f"{API_URL}{path}", headers=HEADERS, timeout=30, **kwargs)
    r.raise_for_status()
    body = r.json()
    # Unwrap envelope: { success: true, data: ... }
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body

def setup_skills() -> list[str]:
    """Ensure demo skills exist and are active. Returns list of IDs created/approved."""
    all_skills = api("get", "/skills", params={"limit": 100})
    all_skills_list = all_skills if isinstance(all_skills, list) else []
    by_name = {s["name"]: s for s in all_skills_list}

    created_ids = []
    for skill in DEMO_SKILLS:
        existing = by_name.get(skill["name"])
        if existing and existing["status"] == "active":
            continue  # already good
        if existing and existing["status"] == "pending_review":
            # Approve the stuck skill
            try:
                api("patch", f"/skills/{existing['id']}/approve", json={})
                created_ids.append(existing["id"])
            except Exception as e:
                print(f"\n  {YELLOW}⚠ Approve error: {e}{RESET}")
            continue
        if existing and existing["status"] == "disabled":
            try:
                api("patch", f"/skills/{existing['id']}/enable", json={})
                api("patch", f"/skills/{existing['id']}/approve", json={})
                created_ids.append(existing["id"])
            except Exception as e:
                print(f"\n  {YELLOW}⚠ Enable error: {e}{RESET}")
            continue
        # Skill doesn't exist — create and approve
        try:
            resp = api("post", "/skills", json=skill)
            skill_id = resp["id"] if isinstance(resp, dict) else resp[0]["id"]
            api("patch", f"/skills/{skill_id}/approve", json={})
            created_ids.append(skill_id)
        except Exception as e:
            print(f"\n  {YELLOW}⚠ Skill setup error: {e}{RESET}")
    return created_ids

def teardown_skills(ids: list[str]) -> None:
    for sid in ids:
        try:
            api("patch", f"/skills/{sid}/disable", json={})
            api("delete", f"/skills/{sid}")
        except Exception:
            pass


def main() -> None:
    print()
    print(BOLD + "  Curtain AI — MCP Server Demo" + RESET)
    print(DIM  + "  Watch an AI agent use Curtain skills as live tools\n" + RESET)

    # Seed skills so the demo has something to show
    print(f"  {DIM}Preparing workspace…{RESET} ", end="", flush=True)
    seeded_ids = setup_skills()
    print(f"{GREEN}✓{RESET}  ({len(seeded_ids)} skill(s) created)\n" if seeded_ids else f"{GREEN}✓{RESET}  (skills already active)\n")


    # ── 1. Handshake ──────────────────────────────────────────────────────────
    banner("Step 1 · Handshake  (initialize)")
    print(f"\n  {DIM}The AI agent connects and negotiates the MCP protocol version.{RESET}\n")

    req = {"jsonrpc": "2.0", "id": 1, "method": "initialize"}
    print(f"  {label('→ Request')}  (what the agent sends):")
    print_json(req)

    resp = rpc("initialize")
    result = resp.get("result", {})

    print(f"\n  {GREEN}✓{RESET} {label('← Response')}  (what Curtain returns):")
    print_json(result)

    print(f"\n  {GREEN}✓{RESET} Protocol: {BOLD}{result.get('protocolVersion')}{RESET}")
    print(f"  {GREEN}✓{RESET} Server   : {BOLD}{result.get('serverInfo', {}).get('name')}{RESET} v{result.get('serverInfo', {}).get('version')}")
    print(f"  {GREEN}✓{RESET} Tools    : {BOLD}enabled{RESET}  ← agent knows it can call tools")


    # ── 2. Discover tools ─────────────────────────────────────────────────────
    banner("Step 2 · Tool Discovery  (tools/list)")
    print(f"\n  {DIM}Agent asks: what tools do I have available?{RESET}")
    print(f"  {DIM}Curtain responds with your entire skill library as callable tools.{RESET}\n")

    req2 = {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
    print(f"  {label('→ Request')}:")
    print_json(req2)

    resp2 = rpc("tools/list")
    tools: list = resp2.get("result", {}).get("tools", [])

    print(f"\n  {GREEN}✓{RESET} {label('← Response')}  — {BOLD}{len(tools)} tools{RESET} registered:\n")
    for t in tools:
        escalation_note = f"  {YELLOW}⚠ escalation required{RESET}" if "Requires escalation" in t.get("description", "") else ""
        print(f"    {GREEN}•{RESET} {BOLD}{t['name']}{RESET}{escalation_note}")
        trigger_line = t["description"].split("\n")[0]
        print(f"      {DIM}{textwrap.shorten(trigger_line, 70)}{RESET}")

    print(f"\n  {DIM}Each tool above = one skill your team approved.{RESET}")
    print(f"  {DIM}The agent's LLM sees these schemas — no extra integration needed.{RESET}")


    # ── 3. Live agent conversation ─────────────────────────────────────────────
    banner("Step 3 · Live Agent Conversation  (tools/call)")
    print(f"\n  {DIM}Now watch a full agent turn for each customer message.{RESET}")
    print(f"  {DIM}The agent calls Curtain's MCP tool, gets a structured decision,{RESET}")
    print(f"  {DIM}and responds to the customer — zero manual logic.\n{RESET}")

    scenarios = [
        {
            "customer": "Hi, I was charged twice on my card this month. Can you help?",
            "agent_thought": "Customer mentions duplicate charge → I'll call Curtain to get the right decision.",
        },
        {
            "customer": "I'd like to cancel my subscription immediately.",
            "agent_thought": "Cancellation request → Curtain will tell me the exact protocol to follow.",
        },
        {
            "customer": "My account is locked and I can't get in.",
            "agent_thought": "Account lockout → this may require security escalation. Let me check Curtain.",
        },
        {
            "customer": "My delivery was smashed — the product is completely broken.",
            "agent_thought": "Damaged product → Curtain will return the replacement procedure.",
        },
        {
            "customer": "What time does your support team open on weekends?",
            "agent_thought": "No obvious skill for office hours → Curtain will tell me to escalate.",
        },
    ]

    for i, scenario in enumerate(scenarios, 1):
        customer_says(scenario["customer"])
        agent_thinks(scenario["agent_thought"])

        req3 = {
            "jsonrpc": "2.0",
            "id": 10 + i,
            "method": "tools/call",
            "params": {
                "name": "curtain_decision",
                "arguments": {"customer_query": scenario["customer"]},
            },
        }

        print(f"\n  {label('→ MCP Request')}:")
        print_json(req3)

        resp3 = rpc("tools/call", req3["params"])
        result3 = resp3.get("result", {})
        content = result3.get("content", [{}])[0].get("text", "—")
        meta = result3.get("metadata", {})
        escalate = meta.get("escalate", False)
        confidence = meta.get("confidence", 0)
        is_error = result3.get("isError", False)

        print(f"\n  {GREEN}✓{RESET} {label('← MCP Response')}:")
        print_json(result3)

        routing = f"{RED}ESCALATE → human agent{RESET}" if escalate else f"{GREEN}AUTO-RESOLVE{RESET}"
        print(f"\n  {'─'*50}")
        print(f"  Decision   : {BOLD}{textwrap.shorten(content, 65)}{RESET}")
        print(f"  Confidence : {YELLOW}{confidence:.0%}{RESET}")
        print(f"  Routing    : {routing}")
        print(f"  {'─'*50}")

        if escalate:
            agent_says("I'm routing you to a specialist who can help with this right away.")
        else:
            agent_says(textwrap.shorten(content, 90))

        time.sleep(0.5)


    # ── 4. Raw wire format explainer ──────────────────────────────────────────
    banner("Step 4 · What the Wire Looks Like")
    print(f"""
  {DIM}Every message to the MCP server is standard JSON-RPC 2.0:{RESET}

  {BOLD}Discover tools:{RESET}
  {DIM}POST /mcp/v1   Authorization: Bearer cai_...{RESET}
  {DIM}{{{RESET} {DIM}"jsonrpc": "2.0", "id": 1, "method": "tools/list" {DIM}}}{RESET}

  {BOLD}Call a tool:{RESET}
  {DIM}POST /mcp/v1   Authorization: Bearer cai_...{RESET}
  {DIM}{{{RESET}
  {DIM}  "jsonrpc": "2.0", "id": 2, "method": "tools/call",{RESET}
  {DIM}  "params": {{{RESET}
  {DIM}    "name": "curtain_decision",{RESET}
  {DIM}    "arguments": {{ "customer_query": "I was double charged" }}{RESET}
  {DIM}  }}{RESET}
  {DIM}}}{RESET}

  {DIM}Works with any MCP-compatible AI host:{RESET}
  {GREEN}✓{RESET} Claude (via Claude Desktop / claude.ai/code)
  {GREEN}✓{RESET} OpenAI Assistants (function-calling bridge)
  {GREEN}✓{RESET} LangChain / LangGraph agents
  {GREEN}✓{RESET} Any custom agent that speaks JSON-RPC 2.0
""")


    # ── Summary ───────────────────────────────────────────────────────────────
    print(CYAN + "─" * 66 + RESET)
    print(BOLD + "  What this demo proved:\n" + RESET)
    points = [
        f"MCP endpoint is {BOLD}live at {MCP_URL}{RESET}",
        f"{BOLD}{len(tools)} skills{RESET} instantly available as typed AI tools",
        f"Agent gets {BOLD}structured decisions{RESET} — not free-form LLM text",
        f"Escalation flag tells the agent {BOLD}exactly when to involve a human{RESET}",
        f"Confidence score lets the agent {BOLD}apply its own thresholds{RESET}",
        f"Same Bearer token as REST — {BOLD}zero extra auth setup{RESET}",
        f"Skill library updates {BOLD}instantly{RESET} — no agent redeploy needed",
    ]
    for p in points:
        print(f"  {GREEN}✓{RESET}  {p}")
    print()
    print(CYAN + "─" * 66 + RESET)
    print()

    if seeded_ids:
        print(f"  {DIM}Cleaning up {len(seeded_ids)} demo skill(s)…{RESET} ", end="", flush=True)
        teardown_skills(seeded_ids)
        print(f"{GREEN}✓{RESET}\n")


if __name__ == "__main__":
    main()
