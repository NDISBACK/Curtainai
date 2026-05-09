import { supabaseAdmin } from '../config/supabase';
import { skillRepository } from '../repositories/skillRepository';
import { AppError } from '../utils/AppError';

const DEFAULT_DAYS = 30;

export interface WorkspaceAnalytics {
  period: { from: string; to: string };
  total_queries: number;
  matched_queries: number;
  escalated_queries: number;
  match_rate: number;
  escalation_rate: number;
  avg_confidence: number;
  top_skills: Array<{
    skill_id: string;
    skill_name: string;
    match_count: number;
    avg_confidence: number;
  }>;
  daily_breakdown: Array<{
    day: string;
    total: number;
    matched: number;
    escalated: number;
  }>;
}

export interface SkillAnalytics {
  skill_id: string;
  total_matches: number;
  avg_confidence: number;
  escalation_rate: number;
  confidence_distribution: { p50: number; p90: number; p99: number };
  daily_matches: Array<{ day: string; count: number; avg_confidence: number }>;
  last_matched_at: string | null;
}

function defaultDateRange(from?: Date, to?: Date): { from: Date; to: Date } {
  const toDate  = to   ?? new Date();
  const fromDate = from ?? new Date(toDate.getTime() - DEFAULT_DAYS * 86_400_000);
  return { from: fromDate, to: toDate };
}

export const analyticsService = {
  async getWorkspaceAnalytics(
    workspaceId: string,
    from?: Date,
    to?: Date
  ): Promise<WorkspaceAnalytics> {
    const range = defaultDateRange(from, to);

    // Live aggregate from the materialized view for the date range
    const { data: dailyRows, error: dailyErr } = await supabaseAdmin
      .from('workspace_daily_stats')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('day', range.from.toISOString())
      .lte('day', range.to.toISOString())
      .order('day', { ascending: true });

    if (dailyErr) throw new AppError(dailyErr.message, 500);

    const rows = (dailyRows ?? []) as Array<{
      day: string;
      total_queries: number;
      escalated_count: number;
      matched_count: number;
      avg_confidence: number;
    }>;

    const total_queries    = rows.reduce((s, r) => s + r.total_queries, 0);
    const matched_queries  = rows.reduce((s, r) => s + r.matched_count, 0);
    const escalated_queries = rows.reduce((s, r) => s + r.escalated_count, 0);
    const avg_confidence   = total_queries > 0
      ? rows.reduce((s, r) => s + (r.avg_confidence ?? 0) * r.total_queries, 0) / total_queries
      : 0;

    // Top skills by match count from skill_daily_stats
    const { data: skillRows, error: skillErr } = await supabaseAdmin
      .from('skill_daily_stats')
      .select('skill_id, match_count, avg_confidence')
      .gte('day', range.from.toISOString())
      .lte('day', range.to.toISOString());

    if (skillErr) throw new AppError(skillErr.message, 500);

    // Aggregate per skill
    const skillMap = new Map<string, { match_count: number; weighted_conf: number }>();
    for (const row of (skillRows ?? []) as Array<{ skill_id: string; match_count: number; avg_confidence: number }>) {
      const existing = skillMap.get(row.skill_id) ?? { match_count: 0, weighted_conf: 0 };
      skillMap.set(row.skill_id, {
        match_count: existing.match_count + row.match_count,
        weighted_conf: existing.weighted_conf + (row.avg_confidence ?? 0) * row.match_count,
      });
    }

    const topSkillIds = [...skillMap.entries()]
      .sort((a, b) => b[1].match_count - a[1].match_count)
      .slice(0, 10)
      .map(([id]) => id);

    const topSkillDetails = await Promise.all(
      topSkillIds.map(async id => {
        const skill = await skillRepository.findById(id).catch(() => null);
        const agg = skillMap.get(id)!;
        return {
          skill_id: id,
          skill_name: skill?.name ?? id,
          match_count: agg.match_count,
          avg_confidence: agg.match_count > 0 ? Math.round((agg.weighted_conf / agg.match_count) * 1000) / 1000 : 0,
        };
      })
    );

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      total_queries,
      matched_queries,
      escalated_queries,
      match_rate:      total_queries > 0 ? Math.round((matched_queries  / total_queries) * 1000) / 1000 : 0,
      escalation_rate: total_queries > 0 ? Math.round((escalated_queries / total_queries) * 1000) / 1000 : 0,
      avg_confidence: Math.round(avg_confidence * 1000) / 1000,
      top_skills: topSkillDetails,
      daily_breakdown: rows.map(r => ({
        day: r.day,
        total: r.total_queries,
        matched: r.matched_count,
        escalated: r.escalated_count,
      })),
    };
  },

  async getSkillAnalytics(
    skillId: string,
    from?: Date,
    to?: Date
  ): Promise<SkillAnalytics> {
    const range = defaultDateRange(from, to);

    const { data: dailyRows, error: dailyErr } = await supabaseAdmin
      .from('skill_daily_stats')
      .select('*')
      .eq('skill_id', skillId)
      .gte('day', range.from.toISOString())
      .lte('day', range.to.toISOString())
      .order('day', { ascending: true });

    if (dailyErr) throw new AppError(dailyErr.message, 500);

    const rows = (dailyRows ?? []) as Array<{
      day: string;
      match_count: number;
      avg_confidence: number;
      escalated_after_match: number;
    }>;

    const total_matches = rows.reduce((s, r) => s + r.match_count, 0);
    const total_escalated = rows.reduce((s, r) => s + r.escalated_after_match, 0);
    const avg_confidence  = total_matches > 0
      ? rows.reduce((s, r) => s + (r.avg_confidence ?? 0) * r.match_count, 0) / total_matches
      : 0;

    // Percentile distribution via RPC
    let confidence_distribution = { p50: 0, p90: 0, p99: 0 };
    const { data: pctData } = await supabaseAdmin.rpc('get_skill_confidence_percentiles', {
      p_skill_id: skillId,
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
    });
    if (pctData && pctData.length > 0) {
      const p = pctData[0] as { p50: number; p90: number; p99: number };
      confidence_distribution = {
        p50: Math.round((p.p50 ?? 0) * 1000) / 1000,
        p90: Math.round((p.p90 ?? 0) * 1000) / 1000,
        p99: Math.round((p.p99 ?? 0) * 1000) / 1000,
      };
    }

    // Last matched query
    const { data: lastMatch } = await supabaseAdmin
      .from('queries')
      .select('created_at')
      .eq('matched_skill_id', skillId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      skill_id: skillId,
      total_matches,
      avg_confidence: Math.round(avg_confidence * 1000) / 1000,
      escalation_rate: total_matches > 0
        ? Math.round((total_escalated / total_matches) * 1000) / 1000
        : 0,
      confidence_distribution,
      daily_matches: rows.map(r => ({
        day: r.day,
        count: r.match_count,
        avg_confidence: Math.round((r.avg_confidence ?? 0) * 1000) / 1000,
      })),
      last_matched_at: (lastMatch as { created_at: string } | null)?.created_at ?? null,
    };
  },
};
