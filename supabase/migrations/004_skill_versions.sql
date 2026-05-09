-- ─── Skill version history ────────────────────────────────────────────────────
-- Immutable snapshot table — one row per content-field edit.
-- Status-only transitions (approve, disable, enable) do NOT create a version.

CREATE TABLE skill_versions (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id            UUID         NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  workspace_id        UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version             INT          NOT NULL,
  name                TEXT         NOT NULL,
  trigger_condition   TEXT,
  decision            TEXT,
  conditions          JSONB,
  escalation_required BOOLEAN      NOT NULL DEFAULT false,
  confidence          FLOAT,
  status              skill_status NOT NULL,
  changed_by          TEXT,        -- API key ID or 'system'
  change_note         TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Version numbers are per-skill, not global
CREATE UNIQUE INDEX idx_skill_versions_skill_version ON skill_versions(skill_id, version);
CREATE INDEX idx_skill_versions_skill_id             ON skill_versions(skill_id);
CREATE INDEX idx_skill_versions_workspace_id         ON skill_versions(workspace_id);
