"""Extraction resource — derive skills from raw conversations."""
from __future__ import annotations

from typing import List

from pydantic import TypeAdapter

from .._http import AsyncHttpTransport, HttpTransport
from ..models import ExtractedSkill


class ExtractionResource:
    """
    Extract reusable decision skills from support conversations using the
    built-in LLM extraction pipeline.

    Extracted skills are **not** persisted automatically — pass them to
    ``client.skills.create()`` (and then ``client.skills.approve()``) for
    each one you want to keep.
    """

    def __init__(self, http: HttpTransport) -> None:
        self._http = http

    def extract(self, conversation: str) -> List[ExtractedSkill]:
        """
        Analyse a conversation and return candidate skills.

        :param conversation: Raw text of a support conversation (e.g. from
            Zendesk, Intercom, or Freshdesk export).  Max 50 000 characters.

        Example::

            transcript = \"\"\"
            Agent: Hi, how can I help?
            Customer: I was charged twice for my subscription last month.
            Agent: I can see the duplicate — issuing a refund now.
            \"\"\"

            skills = client.extraction.extract(transcript)
            for skill in skills:
                print(skill.name, "— confidence:", skill.confidence)
                new_skill = client.skills.create(
                    name=skill.name,
                    trigger_condition=skill.trigger_condition,
                    decision=skill.decision,
                )
                client.skills.approve(new_skill.id)
        """
        data = self._http.post("/extract", json={"conversation": conversation})
        raw_skills = data.get("skills", []) if isinstance(data, dict) else []
        ta: TypeAdapter[List[ExtractedSkill]] = TypeAdapter(List[ExtractedSkill])
        return ta.validate_python(raw_skills)


class AsyncExtractionResource:
    """Async mirror of :class:`ExtractionResource`."""

    def __init__(self, http: AsyncHttpTransport) -> None:
        self._http = http

    async def extract(self, conversation: str) -> List[ExtractedSkill]:
        data = await self._http.post("/extract", json={"conversation": conversation})
        raw_skills = data.get("skills", []) if isinstance(data, dict) else []
        ta: TypeAdapter[List[ExtractedSkill]] = TypeAdapter(List[ExtractedSkill])
        return ta.validate_python(raw_skills)
