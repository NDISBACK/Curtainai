-- ─── Denormalized columns on queries ──────────────────────────────────────────
-- escalated: true when the pipeline escalated to a human (redundant with output JSONB but queryable)
-- search_method already added in migration 003

ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false;

-- ─── Query indexes for analytics ─────────────────────────────────────────────

CREATE INDEX idx_queries_workspace_created
  ON queries(workspace_id, created_at DESC);

CREATE INDEX idx_queries_escalated
  ON queries(workspace_id, escalated)
  WHERE escalated = true;

CREATE INDEX idx_queries_skill_created
  ON queries(matched_skill_id, created_at DESC)
  WHERE matched_skill_id IS NOT NULL;

-- ─── Workspace daily stats materialized view ──────────────────────────────────

CREATE MATERIALIZED VIEW workspace_daily_stats AS
SELECT
  workspace_id,
  DATE_TRUNC('day', created_at)                                      AS day,
  COUNT(*)                                                            AS total_queries,
  COUNT(*) FILTER (WHERE escalated = true)                           AS escalated_count,
  COUNT(*) FILTER (WHERE matched_skill_id IS NOT NULL)               AS matched_count,
  AVG(confidence) FILTER (WHERE confidence IS NOT NULL)              AS avg_confidence
FROM queries
GROUP BY workspace_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON workspace_daily_stats(workspace_id, day);

-- ─── Skill daily stats materialized view ─────────────────────────────────────

CREATE MATERIALIZED VIEW skill_daily_stats AS
SELECT
  matched_skill_id                                       AS skill_id,
  DATE_TRUNC('day', created_at)                          AS day,
  COUNT(*)                                               AS match_count,
  AVG(confidence)                                        AS avg_confidence,
  COUNT(*) FILTER (WHERE escalated = true)               AS escalated_after_match
FROM queries
WHERE matched_skill_id IS NOT NULL
GROUP BY matched_skill_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON skill_daily_stats(skill_id, day);

-- ─── Refresh function ─────────────────────────────────────────────────────────
-- Called from the application every 5 minutes via setInterval.
-- CONCURRENTLY allows reads to continue during the refresh (requires a unique index).

CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY skill_daily_stats;
$$;

-- ─── Confidence percentile helper ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_skill_confidence_percentiles(
  p_skill_id UUID,
  p_from     TIMESTAMPTZ,
  p_to       TIMESTAMPTZ
)
RETURNS TABLE (p50 FLOAT, p90 FLOAT, p99 FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY confidence) AS p50,
    PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY confidence) AS p90,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY confidence) AS p99
  FROM queries
  WHERE matched_skill_id = p_skill_id
    AND created_at BETWEEN p_from AND p_to
    AND confidence IS NOT NULL;
$$;
