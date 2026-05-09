import type { SkillRow } from '../types/entities';
import { jaccardSimilarity } from './similarity';

const RRF_K = 60; // standard constant for Reciprocal Rank Fusion

export interface ScoredSkill {
  skill: SkillRow;
  jaccard_score: number;
  vector_score: number;
  rrf_score: number;
}

/**
 * Fuse Jaccard keyword ranking with vector cosine ranking using Reciprocal Rank Fusion.
 * RRF score = Σ 1 / (RRF_K + rank_i), weighted by alpha:
 *   alpha=0.0 → pure Jaccard keyword
 *   alpha=1.0 → pure vector
 *   alpha=0.5 → balanced (default)
 */
export function hybridRank(
  query: string,
  vectorResults: Array<SkillRow & { vector_score: number }>,
  allActiveSkills: SkillRow[],
  topK: number,
  alpha: number
): ScoredSkill[] {
  // Build Jaccard rankings over all active skills
  const jaccardRanked = allActiveSkills
    .map(skill => ({
      id: skill.id,
      score: jaccardSimilarity(query, skill.trigger_condition ?? ''),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const vectorRanked = vectorResults.map(s => ({ id: s.id, score: s.vector_score }));

  // Rank maps: skill_id → 1-indexed rank position
  const jaccardRankMap = new Map(jaccardRanked.map((s, i) => [s.id, i + 1]));
  const vectorRankMap  = new Map(vectorRanked.map((s, i) => [s.id, i + 1]));
  const jaccardScoreMap = new Map(jaccardRanked.map(s => [s.id, s.score]));
  const vectorScoreMap  = new Map(vectorRanked.map(s => [s.id, s.score]));

  // Union of all candidate IDs from both lists
  const candidateIds = new Set([
    ...jaccardRanked.map(s => s.id),
    ...vectorRanked.map(s => s.id),
  ]);

  const fallbackRank = candidateIds.size + 1;

  const scores: ScoredSkill[] = [];
  for (const id of candidateIds) {
    const jRank = jaccardRankMap.get(id) ?? fallbackRank;
    const vRank = vectorRankMap.get(id)  ?? fallbackRank;

    const rrfJaccard = (1 - alpha) * (1 / (RRF_K + jRank));
    const rrfVector  = alpha       * (1 / (RRF_K + vRank));

    const skill = allActiveSkills.find(s => s.id === id);
    if (!skill) continue;

    scores.push({
      skill,
      jaccard_score: jaccardScoreMap.get(id) ?? 0,
      vector_score: vectorScoreMap.get(id) ?? 0,
      rrf_score: rrfJaccard + rrfVector,
    });
  }

  return scores.sort((a, b) => b.rrf_score - a.rrf_score).slice(0, topK);
}
