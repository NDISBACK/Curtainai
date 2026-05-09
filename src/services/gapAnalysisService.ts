import OpenAI from 'openai';
import { queryRepository } from '../repositories/queryRepository';
import { embeddingService } from './embeddingService';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import type { ExtractedSkill } from './extractionService';

const openaiClient = new OpenAI({ apiKey: env.openai.apiKey });

export interface GapCluster {
  id:                    string;
  size:                  number;
  representative_queries: string[];
  suggested_skill:       ExtractedSkill;
  last_seen:             string;
}

export interface GapReport {
  clusters:                   GapCluster[];
  total_escalations_analyzed: number;
  ungrouped_count:            number;
}

const CLUSTER_THRESHOLD = 0.72;
const MIN_CLUSTER_SIZE  = 2;
const MAX_CLUSTERS      = 10;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function centroid(embeddings: number[][]): number[] {
  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) sum[i] += emb[i];
  }
  return sum.map(v => v / embeddings.length);
}

async function suggestSkillForCluster(queries: string[]): Promise<ExtractedSkill> {
  const sample = queries.slice(0, 5).join('\n- ');
  const prompt = `You are a support skill designer. Given these similar customer queries that your AI couldn't handle, create a skill to handle them.

Queries:
- ${sample}

Return a single JSON object:
{
  "name": "short skill name (max 60 chars)",
  "trigger_condition": "when to use this skill (max 200 chars)",
  "decision": "what the agent should do (max 200 chars)",
  "conditions": [],
  "escalation_required": false,
  "confidence": 0.8
}`;

  let response: OpenAI.Chat.ChatCompletion | undefined;
  try {
    response = await openaiClient.chat.completions.create({
      model: env.openai.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 400,
      messages: [
        { role: 'user', content: prompt },
      ],
    });
  } catch (err: any) {
    throw new AppError(`OpenAI error: ${err.message}`, 502);
  }

  const content = response!.choices[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(content);
    return {
      name:               parsed.name ?? 'Unnamed skill',
      trigger_condition:  parsed.trigger_condition ?? '',
      decision:           parsed.decision ?? '',
      conditions:         Array.isArray(parsed.conditions) ? parsed.conditions : [],
      escalation_required: parsed.escalation_required ?? false,
      confidence:          parsed.confidence ?? 0.7,
    };
  } catch {
    throw new AppError('Failed to parse skill suggestion', 422);
  }
}

export const gapAnalysisService = {
  async analyzeGaps(workspaceId: string, limit = 200): Promise<GapReport> {
    // Fetch true gaps: escalations where no skill matched at all
    const { data: allEscalated } = await queryRepository.findWithFilters(
      workspaceId,
      { escalated: true },
      1,
      limit
    );

    // Only queries where no skill was found (not post-match escalations)
    const trueGaps = allEscalated.filter(
      q => q.matched_skill_id === null &&
           (q.search_method === 'no_keyword_match' || q.search_method === 'no_active_skills')
    );

    if (trueGaps.length === 0) {
      return { clusters: [], total_escalations_analyzed: allEscalated.length, ungrouped_count: 0 };
    }

    // Embed all gap queries in parallel batches of 10
    const BATCH = 10;
    const embedded: Array<{ query: string; embedding: number[]; created_at: string }> = [];

    for (let i = 0; i < trueGaps.length; i += BATCH) {
      const batch = trueGaps.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(q => embeddingService.embed(q.input).then(emb => ({ query: q.input, embedding: emb, created_at: q.created_at })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') embedded.push(r.value);
      }
    }

    // Greedy clustering by cosine similarity
    type Cluster = { queries: string[]; embeddings: number[][]; last_seen: string };
    const clusters: Cluster[] = [];

    for (const item of embedded) {
      let bestCluster: Cluster | null = null;
      let bestSim = CLUSTER_THRESHOLD;

      for (const cluster of clusters) {
        const c = centroid(cluster.embeddings);
        const sim = cosineSimilarity(item.embedding, c);
        if (sim > bestSim) { bestSim = sim; bestCluster = cluster; }
      }

      if (bestCluster) {
        bestCluster.queries.push(item.query);
        bestCluster.embeddings.push(item.embedding);
        if (item.created_at > bestCluster.last_seen) bestCluster.last_seen = item.created_at;
      } else {
        clusters.push({ queries: [item.query], embeddings: [item.embedding], last_seen: item.created_at });
      }
    }

    // Keep only clusters large enough, sort by size
    const significant = clusters
      .filter(c => c.queries.length >= MIN_CLUSTER_SIZE)
      .sort((a, b) => b.queries.length - a.queries.length)
      .slice(0, MAX_CLUSTERS);

    const ungrouped_count = clusters
      .filter(c => c.queries.length < MIN_CLUSTER_SIZE)
      .reduce((s, c) => s + c.queries.length, 0);

    // Generate skill suggestions in parallel
    const results = await Promise.allSettled(
      significant.map(async (cluster, i): Promise<GapCluster> => {
        const c = centroid(cluster.embeddings);
        // Pick 3 most representative queries (closest to centroid)
        const ranked = cluster.queries
          .map((q, j) => ({ q, sim: cosineSimilarity(cluster.embeddings[j], c) }))
          .sort((a, b) => b.sim - a.sim)
          .slice(0, 3)
          .map(x => x.q);

        const suggested_skill = await suggestSkillForCluster(cluster.queries);

        return {
          id:                    `gap_${i}_${Date.now()}`,
          size:                  cluster.queries.length,
          representative_queries: ranked,
          suggested_skill,
          last_seen:             cluster.last_seen,
        };
      })
    );

    const gapClusters: GapCluster[] = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<GapCluster>).value);

    return {
      clusters: gapClusters,
      total_escalations_analyzed: allEscalated.length,
      ungrouped_count,
    };
  },
};
