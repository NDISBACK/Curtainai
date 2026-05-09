import { skillRepository } from '../repositories/skillRepository';
import { jaccardSimilarity } from './similarity';

export interface ConflictResult {
  skill_id:      string;
  skill_name:    string;
  similarity:    number;
  conflict_type: 'near_duplicate' | 'overlapping_trigger' | 'decision_conflict';
}

// Higher than the dedup threshold (0.75) — we want to catch overlapping triggers,
// not just exact duplicates which skillService.create already blocks.
const CONFLICT_THRESHOLD = 0.80;

export async function findConflicts(
  embedding: number[] | null,
  _triggerCondition: string,
  decision: string,
  workspaceId: string,
  excludeId?: string
): Promise<ConflictResult[]> {
  if (!embedding) return [];

  const candidates = await skillRepository.findDuplicatesByVector(
    workspaceId,
    embedding,
    CONFLICT_THRESHOLD,
    excludeId
  );

  if (candidates.length === 0) return [];

  // Fetch full skill rows to compare decisions
  const results: ConflictResult[] = [];

  for (const candidate of candidates) {
    let conflict_type: ConflictResult['conflict_type'];

    if (candidate.similarity >= 0.92) {
      conflict_type = 'near_duplicate';
    } else {
      // Check if decisions are semantically different — same trigger, different action = worst case
      const skill = await skillRepository.findById(candidate.id).catch(() => null);
      if (skill?.decision) {
        const decisionSimilarity = jaccardSimilarity(decision, skill.decision);
        conflict_type = decisionSimilarity < 0.4 ? 'decision_conflict' : 'overlapping_trigger';
      } else {
        conflict_type = 'overlapping_trigger';
      }
    }

    results.push({
      skill_id:   candidate.id,
      skill_name: candidate.name,
      similarity: candidate.similarity,
      conflict_type,
    });
  }

  // Sort: decision_conflicts first (most dangerous), then by similarity desc
  return results.sort((a, b) => {
    if (a.conflict_type === 'decision_conflict' && b.conflict_type !== 'decision_conflict') return -1;
    if (b.conflict_type === 'decision_conflict' && a.conflict_type !== 'decision_conflict') return 1;
    return b.similarity - a.similarity;
  });
}
