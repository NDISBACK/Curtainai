-- ─── pgvector extension ────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Embeddings column on skills ──────────────────────────────────────────────
-- text-embedding-3-small produces 1536-dimensional vectors

ALTER TABLE skills ADD COLUMN embedding vector(1536);

-- IVFFlat approximate nearest-neighbor index.
-- lists = 100 is appropriate for up to ~10k skills; increase for larger datasets.
CREATE INDEX idx_skills_embedding_ivfflat
  ON skills
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Also add search_method column to queries for analytics (Phase 4)
ALTER TABLE queries
  ADD COLUMN search_method TEXT
    CHECK (search_method IN ('jaccard_only', 'vector_only', 'hybrid', 'no_active_skills', 'no_keyword_match'));

-- ─── Vector similarity search function ────────────────────────────────────────
-- Returns active skills for a workspace ranked by cosine similarity to the query embedding.
-- Called via supabase.rpc('match_skills_vector', { p_workspace_id, p_embedding, p_top_k, p_min_score })

CREATE OR REPLACE FUNCTION match_skills_vector(
  p_workspace_id  UUID,
  p_embedding     vector(1536),
  p_top_k         INT DEFAULT 6,
  p_min_score     FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id                  UUID,
  workspace_id        UUID,
  name                TEXT,
  trigger_condition   TEXT,
  decision            TEXT,
  conditions          JSONB,
  escalation_required BOOLEAN,
  confidence          FLOAT,
  status              skill_status,
  embedding           vector(1536),
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  vector_score        FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.workspace_id,
    s.name,
    s.trigger_condition,
    s.decision,
    s.conditions,
    s.escalation_required,
    s.confidence,
    s.status,
    s.embedding,
    s.created_at,
    s.updated_at,
    1 - (s.embedding <=> p_embedding) AS vector_score
  FROM skills s
  WHERE s.workspace_id = p_workspace_id
    AND s.status = 'active'
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> p_embedding) >= p_min_score
  ORDER BY s.embedding <=> p_embedding
  LIMIT p_top_k;
$$;

-- ─── Duplicate detection via vector similarity ─────────────────────────────────
-- Used in skillService to find semantically similar skills before creating a new one.

CREATE OR REPLACE FUNCTION find_duplicate_skills(
  p_workspace_id  UUID,
  p_embedding     vector(1536),
  p_threshold     FLOAT DEFAULT 0.75,
  p_exclude_id    UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.name,
    1 - (s.embedding <=> p_embedding) AS similarity
  FROM skills s
  WHERE s.workspace_id = p_workspace_id
    AND (p_exclude_id IS NULL OR s.id != p_exclude_id)
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> p_embedding) >= p_threshold
  ORDER BY s.embedding <=> p_embedding
  LIMIT 5;
$$;
