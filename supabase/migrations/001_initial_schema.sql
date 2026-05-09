-- Enable pgcrypto for gen_random_uuid() on Postgres < 14
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE skill_status AS ENUM ('pending_review', 'active', 'disabled');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE workspaces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL,
  trigger_condition   TEXT,
  decision            TEXT,
  conditions          JSONB,
  escalation_required BOOLEAN      NOT NULL DEFAULT false,
  confidence          FLOAT        CHECK (confidence >= 0.0 AND confidence <= 1.0),
  status              skill_status NOT NULL DEFAULT 'pending_review',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE queries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  input            TEXT        NOT NULL,
  output           JSONB,
  confidence       FLOAT       CHECK (confidence >= 0.0 AND confidence <= 1.0),
  matched_skill_id UUID        REFERENCES skills(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE overrides (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id           UUID        NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  corrected_decision TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_skills_workspace_id      ON skills(workspace_id);
CREATE INDEX idx_queries_workspace_id     ON queries(workspace_id);
CREATE INDEX idx_queries_matched_skill_id ON queries(matched_skill_id);
CREATE INDEX idx_overrides_query_id       ON overrides(query_id);

-- ─── updated_at auto-update trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
