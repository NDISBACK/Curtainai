import { randomUUID } from 'crypto';
import { skillService } from './skillService';
import { embeddingService } from './embeddingService';
import { queryRepository } from '../repositories/queryRepository';
import { runDecision } from './queryService';
import {
  inMemoryVectorSearch,
  buildSimulatedSkillSet,
  classifyChange,
  computeTopImpactedSkills,
  chunk,
  type PreparedSimSkill,
  type DecisionSnapshot,
  type ChangeType,
} from '../utils/simulationUtils';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import type { SkillRow, QueryRow, WorkspaceRow } from '../types/entities';
import type { SimulationRequest, SimulationSkillInput } from '../validation/simulation.schema';

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;           // concurrent LLM calls per batch
const MAX_CHANGED_EXAMPLES = 15; // changed examples included in response
const MAX_UNCHANGED_EXAMPLES = 5; // unchanged examples for context

// ─── Response types ───────────────────────────────────────────────────────────

export interface SimulationExample {
  query_id: string;
  query: string;
  before: DecisionSnapshot;
  after:  DecisionSnapshot;
  changed: boolean;
  change_type: ChangeType;
}

export interface SimulationResult {
  total_queries:     number;
  changed_decisions: number;
  unchanged:         number;
  impact_summary: {
    auto_to_escalate:  number; // was resolved → now escalates (coverage loss)
    escalate_to_auto:  number; // was escalated → now resolved (coverage gain)
    decision_changed:  number; // same skill type, different decision text
    confidence_shift:  number; // significant confidence delta (>20pp)
  };
  top_impacted_skills: Array<{
    skill_id: string;
    skill_name: string;
    queries_affected: number;
  }>;
  examples: SimulationExample[];
}

// ─── Internal result record ───────────────────────────────────────────────────

interface QueryResult {
  query_id: string;
  query: string;
  before: DecisionSnapshot;
  after:  DecisionSnapshot;
  changed: boolean;
  change_type: ChangeType;
}

// ─── Helper: extract "before" from stored query row ───────────────────────────
// Re-using the stored output avoids an extra LLM call per query and gives the
// true historical baseline (what actually happened, not what current skills would do).

function extractStoredDecision(row: QueryRow): DecisionSnapshot {
  const out = (row.output ?? {}) as Record<string, unknown>;
  return {
    decision: (typeof out['decision'] === 'string' ? out['decision'] : null)
      ?? 'No matching skill found. This query should be escalated to a human agent.',
    confidence: row.confidence ?? 0,
    skill_id: row.matched_skill_id,
    escalate: row.escalated,
  };
}

// ─── Helper: prepare simulation skills ────────────────────────────────────────
// Generates embeddings for skills that don't have them (new skills being tested).
// Embeddings are required for hybrid search to work; without them, Jaccard-only
// ranking is used for that skill.

async function prepareSimulationSkills(
  skills: SimulationSkillInput[]
): Promise<PreparedSimSkill[]> {
  // Embed all trigger conditions concurrently; failures silently produce null
  const embeddings = await Promise.all(
    skills.map(sk =>
      embeddingService.embed(sk.trigger_condition).catch(() => null)
    )
  );

  return skills.map((sk, i) => ({
    id: sk.id ?? randomUUID(),
    name: sk.name,
    trigger_condition: sk.trigger_condition,
    decision: sk.decision,
    conditions: sk.conditions ?? null,
    escalation_required: sk.escalation_required ?? false,
    confidence: sk.confidence ?? null,
    embedding: embeddings[i],
  }));
}

// ─── Helper: fetch historical queries ─────────────────────────────────────────

async function fetchQueries(
  workspaceId: string,
  input: SimulationRequest
): Promise<QueryRow[]> {
  if (input.query_ids && input.query_ids.length > 0) {
    const rows = await queryRepository.findManyByIds(input.query_ids, workspaceId);
    if (rows.length === 0) throw new AppError('No queries found for the provided query_ids', 404);
    return rows;
  }

  const rows = await queryRepository.findAllByWorkspace(
    workspaceId,
    1,
    input.sample_size ?? 100
  );
  if (rows.length === 0) throw new AppError('No historical queries found for this workspace', 404);
  return rows;
}

// ─── Helper: process one query through the simulated skill set ────────────────

async function simulateQuery(
  row: QueryRow,
  simulatedSkills: SkillRow[],
  topK: number,
  alpha: number
): Promise<QueryResult> {
  const before = extractStoredDecision(row);

  // Embed the query text for hybrid ranking (failure → Jaccard fallback)
  const queryEmbedding = await embeddingService.embed(row.input).catch(() => null);

  const afterRaw = await runDecision({
    query: row.input,
    queryEmbedding,
    skills: simulatedSkills,
    topK,
    alpha,
    vectorSearchFn: async (emb, k) => inMemoryVectorSearch(emb, simulatedSkills, k),
  });

  const after: DecisionSnapshot = {
    decision:  afterRaw.decision,
    confidence: afterRaw.confidence,
    skill_id:  afterRaw.skill_id,
    escalate:  afterRaw.escalate,
  };

  const change_type = classifyChange(before, after);
  const changed = change_type !== null;

  return { query_id: row.id, query: row.input, before, after, changed, change_type };
}

// ─── Helper: aggregate all results ────────────────────────────────────────────

function aggregateResults(
  results: QueryResult[],
  activeSkills: SkillRow[]
): SimulationResult {
  const changed   = results.filter(r => r.changed);
  const unchanged = results.filter(r => !r.changed);

  const impact_summary = {
    auto_to_escalate: changed.filter(r => r.change_type === 'auto_to_escalate').length,
    escalate_to_auto: changed.filter(r => r.change_type === 'escalate_to_auto').length,
    decision_changed:  changed.filter(r => r.change_type === 'decision_changed').length,
    confidence_shift:  changed.filter(r => r.change_type === 'confidence_shift').length,
  };

  const skillLookup = new Map(activeSkills.map(s => [s.id, s.name]));

  const top_impacted_skills = computeTopImpactedSkills(
    results.map(r => ({ before: r.before, changed: r.changed })),
    skillLookup
  );

  // Examples: lead with changed ones, append a handful of unchanged for context
  const examples: SimulationExample[] = [
    ...changed.slice(0, MAX_CHANGED_EXAMPLES),
    ...unchanged.slice(0, MAX_UNCHANGED_EXAMPLES),
  ].map(r => ({
    query_id:    r.query_id,
    query:       r.query,
    before:      r.before,
    after:       r.after,
    changed:     r.changed,
    change_type: r.change_type,
  }));

  return {
    total_queries:     results.length,
    changed_decisions: changed.length,
    unchanged:         unchanged.length,
    impact_summary,
    top_impacted_skills,
    examples,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const simulationService = {
  async simulate(
    workspace: WorkspaceRow,
    input: SimulationRequest
  ): Promise<SimulationResult> {
    const workspaceId = workspace.id;
    const topK  = workspace.settings?.top_k        ?? 3;
    const alpha = workspace.settings?.hybrid_alpha ?? 0.5;

    logger.info('simulation.start', {
      workspace_id: workspaceId,
      simulation_skill_count: input.simulation_skills.length,
      query_ids_provided: !!(input.query_ids?.length),
      sample_size: input.sample_size,
    });

    // 1. Fetch historical queries (read-only)
    const queries = await fetchQueries(workspaceId, input);

    // 2. Fetch current active skills (read-only baseline)
    const activeSkills = await skillService.getActiveForWorkspace(workspaceId, 1, 200);

    // 3. Prepare simulation skills: embed new/modified ones
    const prepared = await prepareSimulationSkills(input.simulation_skills);

    // 4. Build merged skill set: retain non-replaced actives + simulation overrides
    const simulatedSkills = buildSimulatedSkillSet(activeSkills, prepared);

    logger.info('simulation.skill_sets', {
      workspace_id: workspaceId,
      active_count: activeSkills.length,
      simulated_count: simulatedSkills.length,
      query_count: queries.length,
    });

    // 5. Process queries in batches — each batch is Promise.all(BATCH_SIZE)
    //    "before" comes from the stored output (no extra LLM call).
    //    "after" calls runDecision once per query with the simulated skill set.
    const allResults: QueryResult[] = [];

    for (const batch of chunk(queries, BATCH_SIZE)) {
      const batchResults = await Promise.allSettled(
        batch.map(row => simulateQuery(row, simulatedSkills, topK, alpha))
      );

      for (const outcome of batchResults) {
        if (outcome.status === 'fulfilled') {
          allResults.push(outcome.value);
        } else {
          // Log but don't fail the entire simulation for one bad query
          logger.warn('simulation.query_failed', { reason: String(outcome.reason) });
        }
      }
    }

    // 6. Aggregate + classify
    const result = aggregateResults(allResults, activeSkills);

    logger.info('simulation.complete', {
      workspace_id: workspaceId,
      total_queries: result.total_queries,
      changed_decisions: result.changed_decisions,
      unchanged: result.unchanged,
    });

    return result;
  },
};
