import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { skillService } from './skillService';
import { embeddingService } from './embeddingService';
import { queryRepository } from '../repositories/queryRepository';
import { skillRepository } from '../repositories/skillRepository';
import { jaccardSimilarity } from '../utils/similarity';
import { hybridRank } from '../utils/hybridSearch';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { validateOrThrow } from '../validation';
import { LLMSelectionResponseSchema } from '../validation/query.schema';
import type { SkillRow, WorkspaceRow } from '../types/entities';

export const decisionEmitter = new EventEmitter();
decisionEmitter.setMaxListeners(200);

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openaiClient = new OpenAI({ apiKey: env.openai.apiKey });

// ─── Defaults (overridden by workspace.settings) ─────────────────────────────

const DEFAULT_TOP_K = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryInput {
  query: string;
  workspace_id: string;
  workspace?: WorkspaceRow;  // optional; carries settings when auth middleware is present
}

export interface QueryResult {
  query_id: string;        // ID of the persisted query row — use for overrides
  decision: string;
  confidence: number;
  skill_id: string | null;
  escalate: boolean;
}

// Values must match the check constraint on queries.search_method in migration 003
type PipelineMethod = 'jaccard_only' | 'hybrid' | 'no_active_skills' | 'no_keyword_match';

interface CandidateTrace {
  skill_id: string;
  name: string;
  keyword_score: number;
}

// Stored in queries.output — the full explanation of every decision
interface DecisionTrace {
  decision: string;
  escalate: boolean;
  pipeline: {
    method: PipelineMethod;
    active_skills_count: number;
    candidates_evaluated: CandidateTrace[];
    selected_skill_id: string | null;
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SELECTION_SYSTEM_PROMPT = `You are a skill selection engine for a customer support automation system. Your sole function is to select the best matching skill for a customer query from a provided list of candidates.

You will be given a customer query and a numbered list of candidate support skills. Each skill has an ID, a trigger condition, a decision, and an escalation flag.

Rules:
1. Select the single skill whose trigger_condition best matches the customer query. Do not combine multiple skills.
2. If none of the skills are a reasonable match for the query, set skill_id to null and escalate to true.
3. Set confidence between 0.0 and 1.0 to reflect how well the selected skill matches the query.
4. Copy the decision text exactly from the matched skill — do not paraphrase, summarize, or modify it.
5. Set escalate to the matched skill's escalation_required value. If no match, set escalate to true.

Output a single JSON object with exactly these fields. Do not include any text, markdown, or explanation outside the JSON object:
{
  "decision": "exact decision text from the matched skill, or 'No matching skill found' if no skill fits",
  "confidence": 0.0,
  "skill_id": "uuid string of matched skill, or null if no match",
  "escalate": false
}`;

// ─── Candidate ranking ────────────────────────────────────────────────────────

type Candidate = { skill: SkillRow; score: number };

function rankSkills(query: string, skills: SkillRow[], topK: number): Candidate[] {
  return skills
    .map((skill) => ({
      skill,
      score: jaccardSimilarity(query, skill.trigger_condition ?? ''),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function formatCandidates(candidates: Candidate[]): string {
  return candidates
    .map(({ skill }, i) =>
      [
        `${i + 1}. [ID: ${skill.id}] ${skill.name}`,
        `   Trigger: ${skill.trigger_condition ?? ''}`,
        `   Decision: ${skill.decision ?? ''}`,
        `   Escalation required: ${skill.escalation_required}`,
      ].join('\n')
    )
    .join('\n\n');
}

// ─── OpenAI error mapper ──────────────────────────────────────────────────────

function mapOpenAIError(err: unknown): never {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) throw new AppError('OpenAI rate limit exceeded', 429);
    if (err.status === 401) throw new AppError('Invalid OpenAI API key', 502);
    throw new AppError(`OpenAI error: ${err.message}`, 502);
  }
  const message = err instanceof Error ? err.message : String(err);
  throw new AppError(`OpenAI request failed: ${message}`, 502);
}

// ─── LLM selection ────────────────────────────────────────────────────────────

interface LLMSelection {
  decision: string;
  confidence: number;
  skill_id: string | null;
  escalate: boolean;
}

async function selectWithLLM(query: string, candidates: Candidate[]): Promise<LLMSelection> {
  const userPrompt = `Customer query: ${query}\n\nCandidate skills:\n${formatCandidates(candidates)}\n\nSelect the best matching skill.`;

  let response: OpenAI.Chat.ChatCompletion | undefined;
  try {
    response = await openaiClient.chat.completions.create({
      model: env.openai.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 500,
      messages: [
        { role: 'system', content: SELECTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
  } catch (err) {
    mapOpenAIError(err);
  }

  const content = response!.choices[0]?.message?.content ?? '';
  if (!content) throw new AppError('LLM returned empty response', 422);

  return parseAndValidate(content, candidates);
}

function parseAndValidate(content: string, candidates: Candidate[]): LLMSelection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError('LLM returned malformed JSON', 422);
  }

  const raw = validateOrThrow(LLMSelectionResponseSchema, parsed, 422);

  const candidateIds = new Set(candidates.map((c) => c.skill.id));
  const skill_id = raw.skill_id && candidateIds.has(raw.skill_id) ? raw.skill_id : null;
  const escalate = skill_id === null ? true : raw.escalate;
  const decision = raw.decision || 'No matching skill found. This query should be escalated to a human agent.';

  return { decision, confidence: raw.confidence, skill_id, escalate };
}

// ─── Persistence + observability ─────────────────────────────────────────────

async function persistTrace(
  workspaceId: string,
  query: string,
  selection: LLMSelection | null,
  trace: DecisionTrace
): Promise<string> {
  const row = await queryRepository.create({
    workspace_id: workspaceId,
    input: query,
    output: trace as unknown as Record<string, unknown>,
    confidence: selection?.confidence ?? 0,
    matched_skill_id: selection?.skill_id ?? null,
    escalated: selection?.escalate ?? true,
    search_method: trace.pipeline.method,
  });
  return row.id;
}

// ─── Core decision engine (no DB reads or writes) ─────────────────────────────
// Accepts a pre-built skill set and optional pre-computed embedding.
// Used by both queryService.run() (production) and simulationService (simulation).

export type VectorSearchFn = (
  embedding: number[],
  topK: number
) => Promise<Array<SkillRow & { vector_score: number }>>;

export interface DecisionInput {
  query: string;
  queryEmbedding: number[] | null;
  skills: SkillRow[];
  topK: number;
  alpha: number;
  vectorSearchFn: VectorSearchFn;
}

export interface DecisionOutput {
  decision: string;
  confidence: number;
  skill_id: string | null;
  escalate: boolean;
  method: PipelineMethod;
}

// Pure decision function — no DB calls, no persistence.
// Safe to call from simulation without side effects.
export async function runDecision(input: DecisionInput): Promise<DecisionOutput> {
  const { query, queryEmbedding, skills, topK, alpha, vectorSearchFn } = input;

  if (skills.length === 0) {
    return {
      decision: 'No matching skill found. This query should be escalated to a human agent.',
      confidence: 0,
      skill_id: null,
      escalate: true,
      method: 'no_active_skills',
    };
  }

  let candidates: Candidate[];

  if (queryEmbedding) {
    const vectorResults = await vectorSearchFn(queryEmbedding, topK * 2);
    const hybrid = hybridRank(query, vectorResults, skills, topK, alpha);
    candidates = hybrid.map(h => ({ skill: h.skill, score: h.rrf_score }));
  } else {
    candidates = rankSkills(query, skills, topK);
  }

  if (candidates.length === 0) {
    return {
      decision: 'No matching skill found. This query should be escalated to a human agent.',
      confidence: 0,
      skill_id: null,
      escalate: true,
      method: 'no_keyword_match',
    };
  }

  const selection = await selectWithLLM(query, candidates);
  const method: PipelineMethod = queryEmbedding ? 'hybrid' : 'jaccard_only';

  return {
    decision: selection.decision,
    confidence: selection.confidence,
    skill_id: selection.skill_id,
    escalate: selection.escalate,
    method,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const queryService = {
  async run(input: QueryInput): Promise<QueryResult> {
    if (!input.query?.trim()) throw new AppError('query cannot be empty', 400);
    if (!input.workspace_id?.trim()) throw new AppError('workspace_id cannot be empty', 400);

    const topK   = input.workspace?.settings?.top_k         ?? DEFAULT_TOP_K;
    const alpha  = input.workspace?.settings?.hybrid_alpha  ?? 0.5;

    const activeSkills = await skillService.getActiveForWorkspace(input.workspace_id, 1, 200);

    // ── No active skills ───────────────────────────────────────────────────────
    if (activeSkills.length === 0) {
      const trace: DecisionTrace = {
        decision: 'No matching skill found. This query should be escalated to a human agent.',
        escalate: true,
        pipeline: { method: 'no_active_skills', active_skills_count: 0, candidates_evaluated: [], selected_skill_id: null },
      };
      const query_id = await persistTrace(input.workspace_id, input.query, null, trace);
      logger.warn('query.no_active_skills', { query_id, workspace_id: input.workspace_id });
      return { query_id, decision: trace.decision, confidence: 0, skill_id: null, escalate: true };
    }

    // ── Hybrid candidate ranking ───────────────────────────────────────────────
    // Embed the query, run vector search + Jaccard, fuse with RRF.
    // Falls back to Jaccard-only if embedding fails or no skills have embeddings.
    const queryEmbedding = await embeddingService.embed(input.query).catch(() => null);

    let candidates: Candidate[];

    if (queryEmbedding) {
      // Fetch 2× topK from vector search so RRF has enough pool to filter down
      const vectorResults = await skillRepository.findByVectorSimilarity(
        input.workspace_id, queryEmbedding, topK * 2
      );
      const hybrid = hybridRank(input.query, vectorResults, activeSkills, topK, alpha);
      candidates = hybrid.map(h => ({ skill: h.skill, score: h.rrf_score }));
    } else {
      candidates = rankSkills(input.query, activeSkills, topK);
    }

    const candidateTraces: CandidateTrace[] = candidates.map((c) => ({
      skill_id: c.skill.id,
      name: c.skill.name,
      keyword_score: Math.round(c.score * 1000) / 1000,
    }));

    // ── No candidates found ────────────────────────────────────────────────────
    if (candidates.length === 0) {
      const trace: DecisionTrace = {
        decision: 'No matching skill found. This query should be escalated to a human agent.',
        escalate: true,
        pipeline: { method: 'no_keyword_match', active_skills_count: activeSkills.length, candidates_evaluated: [], selected_skill_id: null },
      };
      const query_id = await persistTrace(input.workspace_id, input.query, null, trace);
      logger.warn('query.no_keyword_match', { query_id, workspace_id: input.workspace_id, active_skills: activeSkills.length });
      return { query_id, decision: trace.decision, confidence: 0, skill_id: null, escalate: true };
    }

    // ── LLM selection ──────────────────────────────────────────────────────────
    const method: PipelineMethod = queryEmbedding ? 'hybrid' : 'jaccard_only';
    const selection = await selectWithLLM(input.query, candidates);

    const trace: DecisionTrace = {
      decision: selection.decision,
      escalate: selection.escalate,
      pipeline: {
        method,
        active_skills_count: activeSkills.length,
        candidates_evaluated: candidateTraces,
        selected_skill_id: selection.skill_id,
      },
    };

    const query_id = await persistTrace(input.workspace_id, input.query, selection, trace);

    logger.info('query.resolved', {
      query_id,
      workspace_id: input.workspace_id,
      skill_id: selection.skill_id,
      confidence: selection.confidence,
      escalate: selection.escalate,
      method,
      candidates_count: candidates.length,
    });

    decisionEmitter.emit('decision', {
      id:           query_id,
      workspace_id: input.workspace_id,
      input:        input.query.slice(0, 120),
      decision:     selection.decision,
      skill_name:   candidates.find(c => c.skill.id === selection.skill_id)?.skill.name ?? null,
      confidence:   selection.confidence,
      escalated:    selection.escalate,
      search_method: method,
      created_at:   new Date().toISOString(),
    });

    return { query_id, ...selection };
  },
};
