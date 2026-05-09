-- ─── API keys ─────────────────────────────────────────────────────────────────

CREATE TABLE api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash     TEXT        NOT NULL UNIQUE,  -- SHA-256 hex of the raw bearer token
  key_prefix   TEXT        NOT NULL,         -- first 8 chars of raw key for display
  name         TEXT        NOT NULL,         -- human label e.g. "Production", "CI"
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,                  -- NULL = never expires
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ                   -- NULL = active
);

CREATE INDEX idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_key_hash     ON api_keys(key_hash);

-- ─── Per-workspace configuration ──────────────────────────────────────────────
-- top_k:               how many candidate skills to send to the LLM (default 3)
-- duplicate_threshold: Jaccard/cosine threshold for dedup check (default 0.75)
-- hybrid_alpha:        weight of vector vs keyword in RRF fusion (0.0 = pure keyword, 1.0 = pure vector)

ALTER TABLE workspaces
  ADD COLUMN settings JSONB NOT NULL DEFAULT '{
    "top_k": 3,
    "duplicate_threshold": 0.75,
    "hybrid_alpha": 0.5
  }'::jsonb;
