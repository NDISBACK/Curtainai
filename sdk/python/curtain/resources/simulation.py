"""Simulation resource — read-only what-if engine."""
from __future__ import annotations

from typing import List, Optional

from .._http import AsyncHttpTransport, HttpTransport
from ..models import SimulationResult, SimulationSkillInput


class SimulationResource:
    """
    Test skill changes against real historical traffic before deploying.

    The simulation endpoint is **fully read-only** — it does not write any
    queries, modify any skills, or change any state.  It replays historical
    queries through a modified skill set and returns a before/after comparison.

    Typical workflow::

        from curtain.models import SimulationSkillInput

        # Describe a modified version of an existing skill
        modified = SimulationSkillInput(
            id="existing-skill-uuid",        # replaces this skill in the test
            name="Refund Policy v2",
            trigger_condition="Customer requests refund for any charge",
            decision="Issue refund within 24 hours and send confirmation email",
        )

        result = client.simulation.run([modified], sample_size=200)

        print(f"Queries tested:   {result.total_queries}")
        print(f"Decisions changed: {result.changed_decisions} "
              f"({result.change_rate:.1%})")
        print(f"Coverage gain:    +{result.impact_summary.escalate_to_auto}")
        print(f"Coverage loss:    -{result.impact_summary.auto_to_escalate}")
    """

    def __init__(self, http: HttpTransport) -> None:
        self._http = http

    def run(
        self,
        simulation_skills: List[SimulationSkillInput],
        *,
        query_ids: Optional[List[str]] = None,
        sample_size: int = 100,
    ) -> SimulationResult:
        """
        Run a simulation and return impact metrics with before/after examples.

        :param simulation_skills: Skills to test.  If a skill's ``id`` matches
            an existing active skill it *replaces* that skill.  Skills without
            an ``id`` are added alongside existing actives.
        :param query_ids:         Specific historical query UUIDs to test
            against.  When omitted the server samples the ``sample_size``
            most recent queries.
        :param sample_size:       Number of recent queries to sample (1–500).
            Ignored when ``query_ids`` is provided.
        """
        payload = {
            "simulation_skills": [
                s.model_dump(exclude_none=True) for s in simulation_skills
            ],
            "sample_size": sample_size,
        }
        if query_ids is not None:
            payload["query_ids"] = query_ids

        data = self._http.post("/simulate", json=payload)
        return SimulationResult.model_validate(data)


class AsyncSimulationResource:
    """Async mirror of :class:`SimulationResource`."""

    def __init__(self, http: AsyncHttpTransport) -> None:
        self._http = http

    async def run(
        self,
        simulation_skills: List[SimulationSkillInput],
        *,
        query_ids: Optional[List[str]] = None,
        sample_size: int = 100,
    ) -> SimulationResult:
        payload = {
            "simulation_skills": [
                s.model_dump(exclude_none=True) for s in simulation_skills
            ],
            "sample_size": sample_size,
        }
        if query_ids is not None:
            payload["query_ids"] = query_ids

        data = await self._http.post("/simulate", json=payload)
        return SimulationResult.model_validate(data)
