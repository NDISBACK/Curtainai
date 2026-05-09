import type { SkillRow } from '../types/entities';

// ─── Cosine similarity ────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── In-memory vector search ──────────────────────────────────────────────────
// Used by the simulation engine instead of the pgvector DB call.
// Works on any SkillRow[] including newly-injected simulation skills.

export function inMemoryVectorSearch(
  queryEmbedding: number[],
  skills: SkillRow[],
  topK: number
): Array<SkillRow & { vector_score: number }> {
  return skills
    .filter(s => Array.isArray(s.embedding) && s.embedding.length > 0)
    .map(s => ({ ...s, vector_score: cosineSimilarity(queryEmbedding, s.embedding!) }))
    .filter(s => s.vector_score > 0)
    .sort((a, b) => b.vector_score - a.vector_score)
    .slice(0, topK);
}

// ─── Skill-set merge ──────────────────────────────────────────────────────────
// Active skills from DB + simulation overrides/additions → merged set for re-run.

export interface PreparedSimSkill {
  id: string;                          // real ID (if replacing) or generated (if new)
  name: string;
  trigger_condition: string;
  decision: string;
  conditions: Record<string, unknown> | null;
  escalation_required: boolean;
  confidence: number | null;
  embedding: number[] | null;
}

export function buildSimulatedSkillSet(
  activeSkills: SkillRow[],
  prepared: PreparedSimSkill[]
): SkillRow[] {
  const replacedIds = new Set(prepared.map(s => s.id));
  const workspaceId = activeSkills[0]?.workspace_id ?? '';
  const now = new Date().toISOString();

  // Convert sim skills to SkillRow shape
  const simRows: SkillRow[] = prepared.map(s => ({
    id: s.id,
    workspace_id: workspaceId,
    name: s.name,
    trigger_condition: s.trigger_condition,
    decision: s.decision,
    conditions: s.conditions,
    escalation_required: s.escalation_required,
    confidence: s.confidence,
    status: 'active',
    embedding: s.embedding,
    created_at: now,
    updated_at: now,
  }));

  // Retain active skills that weren't replaced, then append sim skills
  const retained = activeSkills.filter(s => !replacedIds.has(s.id));
  return [...retained, ...simRows];
}

// ─── Change classification ────────────────────────────────────────────────────

export type ChangeType =
  | 'auto_to_escalate'  // was resolved by a skill → now escalates
  | 'escalate_to_auto'  // was escalated → now resolved by a skill
  | 'decision_changed'  // non-escalation → non-escalation, different decision text
  | 'confidence_shift'  // same outcome, confidence changed by more than threshold
  | null;               // no meaningful change

const CONFIDENCE_DELTA_THRESHOLD = 0.20;

export interface DecisionSnapshot {
  decision: string;
  confidence: number;
  skill_id: string | null;
  escalate: boolean;
}

export function classifyChange(
  before: DecisionSnapshot,
  after: DecisionSnapshot
): ChangeType {
  const wasResolved = !before.escalate && before.skill_id !== null;
  const isResolved  = !after.escalate  && after.skill_id  !== null;

  if (wasResolved && !isResolved) return 'auto_to_escalate';
  if (!wasResolved && isResolved) return 'escalate_to_auto';

  if (wasResolved && isResolved && before.decision !== after.decision) return 'decision_changed';

  const confDelta = Math.abs((after.confidence ?? 0) - (before.confidence ?? 0));
  if (confDelta >= CONFIDENCE_DELTA_THRESHOLD) return 'confidence_shift';

  return null;
}

// ─── Top impacted skills ──────────────────────────────────────────────────────
// Identifies which skills in the "before" set are most affected by the simulation.

export interface SkillImpact {
  skill_id: string;
  skill_name: string;
  queries_affected: number;
}

export function computeTopImpactedSkills(
  results: Array<{ before: DecisionSnapshot; changed: boolean }>,
  skillLookup: Map<string, string>   // skill_id → skill_name
): SkillImpact[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.changed && r.before.skill_id) {
      counts.set(r.before.skill_id, (counts.get(r.before.skill_id) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill_id, queries_affected]) => ({
      skill_id,
      skill_name: skillLookup.get(skill_id) ?? skill_id,
      queries_affected,
    }));
}

// ─── Array helpers ────────────────────────────────────────────────────────────

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
