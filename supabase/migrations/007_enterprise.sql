-- Migration 007: Enterprise features
--   • Escalation resolution tracking on queries
--   • API key scopes (full / read_only / query_only)
--   • Team members per workspace
--   • Audit log

-- ── Escalation resolution ─────────────────────────────────────────────────────
ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS escalation_status TEXT NOT NULL DEFAULT 'open'
    CHECK (escalation_status IN ('open', 'resolved')),
  ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_note TEXT;

CREATE INDEX IF NOT EXISTS idx_queries_escalation
  ON queries(workspace_id, escalated, escalation_status, created_at DESC);

-- ── API key scopes ────────────────────────────────────────────────────────────
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'full'
    CHECK (scope IN ('full', 'read_only', 'query_only'));

-- ── Team members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT,
  role         TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by   UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_member_email UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_ws
  ON workspace_members(workspace_id);

-- ── Audit log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_key_id  UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,   -- e.g. 'skill.approved', 'member.added'
  resource_type TEXT,            -- 'skill', 'api_key', 'member', 'workspace'
  resource_id   TEXT,
  meta          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace
  ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(workspace_id, resource_type, resource_id);
