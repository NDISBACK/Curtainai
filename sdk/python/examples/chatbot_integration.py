"""
Chatbot integration example
============================

Shows how to wrap Curtain inside an async chatbot handler — the pattern
used in FastAPI, aiohttp, Django Channels, and similar frameworks.

The key pattern:
  • One shared AsyncCurtainClient per application (created at startup)
  • Each incoming message calls client.queries.run() — very low latency
  • result.escalate → route to a human queue with metadata
  • result.resolved  → reply instantly with the AI decision

Run locally:
    CURTAIN_API_KEY=cai_... CURTAIN_WORKSPACE_ID=<uuid> python examples/chatbot_integration.py
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from curtain import AsyncCurtainClient, QueryResult
from curtain.exceptions import CurtainError


# ─── Domain types ─────────────────────────────────────────────────────────────

@dataclass
class Message:
    session_id: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Reply:
    text: str
    escalated: bool
    query_id: str
    confidence: float | None = None


EscalationHandler = Callable[[Message, QueryResult], Coroutine[Any, Any, None]]


# ─── Chatbot handler ──────────────────────────────────────────────────────────

class SupportBot:
    """
    Thin async wrapper around Curtain that drives a customer support chatbot.

    Create one instance at startup and share it across all request handlers::

        bot = SupportBot(
            api_key=os.environ["CURTAIN_API_KEY"],
            workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
        )
        await bot.start()

        # FastAPI example:
        @app.post("/chat")
        async def chat(body: ChatRequest):
            reply = await bot.handle(Message(session_id=body.session_id, text=body.text))
            return {"reply": reply.text, "escalated": reply.escalated}

        # Shutdown:
        await bot.stop()
    """

    def __init__(
        self,
        *,
        api_key: str,
        workspace_id: str,
        base_url: str = "http://localhost:3000/api/v1",
        on_escalation: EscalationHandler | None = None,
    ) -> None:
        self._client = AsyncCurtainClient(
            api_key=api_key,
            workspace_id=workspace_id,
            base_url=base_url,
        )
        self._on_escalation = on_escalation or self._default_escalation

    async def start(self) -> None:
        """Call once at application startup."""
        await self._client.__aenter__()

    async def stop(self) -> None:
        """Call once at application shutdown."""
        await self._client.__aexit__(None, None, None)

    async def handle(self, message: Message) -> Reply:
        """
        Process one customer message.

        :returns: :class:`Reply` with ``escalated=True`` if no skill matched
                  or the engine chose to defer to a human agent.
        """
        try:
            result = await self._client.queries.run(message.text)
        except CurtainError as exc:
            # Surface Curtain errors as a graceful fallback, not a 500
            return Reply(
                text="I'm having trouble processing your request right now. A support agent will be with you shortly.",
                escalated=True,
                query_id="",
                confidence=None,
            )

        if result.escalate:
            await self._on_escalation(message, result)
            return Reply(
                text=(
                    "I've flagged this for a human agent who will follow up with you shortly. "
                    f"Your reference number is {result.query_id[:8].upper()}."
                ),
                escalated=True,
                query_id=result.query_id,
            )

        return Reply(
            text=result.decision,
            escalated=False,
            query_id=result.query_id,
            confidence=result.confidence,
        )

    @staticmethod
    async def _default_escalation(message: Message, result: QueryResult) -> None:
        """Default escalation handler — logs to stdout.  Replace with your queue."""
        print(
            f"[ESCALATE] session={message.session_id}  "
            f"query_id={result.query_id}  "
            f"text={message.text[:60]!r}"
        )


# ─── Demo ─────────────────────────────────────────────────────────────────────

async def demo() -> None:
    api_key = os.environ.get("CURTAIN_API_KEY", "")
    workspace_id = os.environ.get("CURTAIN_WORKSPACE_ID", "")
    base_url = os.environ.get("CURTAIN_BASE_URL", "http://localhost:3000/api/v1")

    # Custom escalation: in production this would push to a queue (SQS, Pub/Sub, etc.)
    async def log_escalation(msg: Message, result: QueryResult) -> None:
        print(f"  → Queued for human review  [ref: {result.query_id[:8].upper()}]")

    bot = SupportBot(
        api_key=api_key,
        workspace_id=workspace_id,
        base_url=base_url,
        on_escalation=log_escalation,
    )
    await bot.start()

    test_messages = [
        "Hi, I got charged twice last week",
        "My order is 2 weeks late, where is it?",
        "I need to cancel my subscription",  # may escalate if no skill exists
        "How do I reset my password?",
    ]

    print("=== Chatbot demo ===\n")
    for text in test_messages:
        msg = Message(session_id="session-123", text=text)
        reply = await bot.handle(msg)

        tag = "ESCALATED" if reply.escalated else f"AUTO {reply.confidence:.0%}" if reply.confidence else "AUTO"
        print(f"Customer: {text}")
        print(f"Bot [{tag}]: {reply.text[:120]}")
        print()

    await bot.stop()


if __name__ == "__main__":
    asyncio.run(demo())
