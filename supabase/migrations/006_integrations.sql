-- Migration 006: Integrations table for Gmail, WhatsApp, and Freshdesk connections

CREATE TABLE integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('gmail', 'whatsapp', 'freshdesk')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  config          JSONB NOT NULL DEFAULT '{}',
  -- config shape per provider:
  --   gmail:      { "refresh_token": "...", "email": "user@example.com" }
  --   whatsapp:   { "api_token": "...", "phone_number_id": "...", "business_account_id": "..." }
  --   freshdesk:  { "domain": "mycompany.freshdesk.com", "api_key": "..." }
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_provider UNIQUE (workspace_id, provider)
);

CREATE INDEX idx_integrations_workspace ON integrations(workspace_id);

-- Reuse the set_updated_at() function defined in migration 001
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
