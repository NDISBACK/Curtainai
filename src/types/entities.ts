export type SkillStatus = 'pending_review' | 'active' | 'disabled';

// ─── Per-workspace tunables ───────────────────────────────────────────────────

export interface WorkspaceSettings {
  top_k: number;               // candidates sent to LLM; default 3
  duplicate_threshold: number; // Jaccard/cosine threshold for dedup; default 0.75
  hybrid_alpha: number;        // vector weight in RRF fusion (0=keyword, 1=vector); default 0.5
  escalation_webhook_url?: string | null;  // POST here when a query escalates
  escalation_email?: string | null;        // email fallback for escalations
}

// ─── Row types (what the DB returns) ─────────────────────────────────────────

export interface WorkspaceRow {
  id: string;
  name: string;
  settings: WorkspaceSettings;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  workspace_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scope: 'full' | 'read_only' | 'query_only';
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface SkillRow {
  id: string;
  workspace_id: string;
  name: string;
  trigger_condition: string | null;
  decision: string | null;
  conditions: Record<string, unknown> | null;
  escalation_required: boolean;
  confidence: number | null;
  status: SkillStatus;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface QueryRow {
  id: string;
  workspace_id: string;
  input: string;
  output: Record<string, unknown> | null;
  confidence: number | null;
  matched_skill_id: string | null;
  escalated: boolean;
  search_method: string | null;
  escalation_status: 'open' | 'resolved';
  resolved_at: string | null;
  resolved_note: string | null;
  created_at: string;
}

export interface OverrideRow {
  id: string;
  query_id: string;
  corrected_decision: string;
  created_at: string;
}

export interface SkillVersionRow {
  id: string;
  skill_id: string;
  workspace_id: string;
  version: number;
  name: string;
  trigger_condition: string | null;
  decision: string | null;
  conditions: Record<string, unknown> | null;
  escalation_required: boolean;
  confidence: number | null;
  status: SkillStatus;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
}

export type InsertSkillVersion = Omit<SkillVersionRow, 'id' | 'created_at'>;

// ─── Insert types (omit server-managed fields) ────────────────────────────────

export type InsertWorkspace = Omit<WorkspaceRow, 'id' | 'created_at' | 'updated_at' | 'settings'> & {
  settings?: WorkspaceSettings;
};

export type InsertApiKey = Omit<ApiKeyRow, 'id' | 'created_at'>;

export type InsertSkill = Omit<SkillRow, 'id' | 'created_at' | 'updated_at'>;

export type InsertQuery = Omit<QueryRow, 'id' | 'created_at' | 'escalation_status' | 'resolved_at' | 'resolved_note'>;

export type InsertOverride = Omit<OverrideRow, 'id' | 'created_at'>;

// ─── Integrations ─────────────────────────────────────────────────────────────

export type IntegrationProvider = 'gmail' | 'whatsapp' | 'freshdesk';
export type IntegrationStatus   = 'active' | 'disconnected' | 'error';

export interface IntegrationRow {
  id:             string;
  workspace_id:   string;
  provider:       IntegrationProvider;
  status:         IntegrationStatus;
  config:         Record<string, unknown>;
  last_synced_at: string | null;
  created_at:     string;
  updated_at:     string;
}

export type InsertIntegration = Omit<IntegrationRow, 'id' | 'created_at' | 'updated_at'>;
export type UpdateIntegration = Partial<Pick<IntegrationRow, 'status' | 'config' | 'last_synced_at'>>;

// ─── Update types (mutable entities only) ────────────────────────────────────

export type UpdateWorkspace = Partial<Omit<InsertWorkspace, 'settings'>> & {
  settings?: Partial<WorkspaceSettings>;
};

export type UpdateSkill = Partial<InsertSkill>;

// ─── Team members ─────────────────────────────────────────────────────────────

export type MemberRole = 'admin' | 'editor' | 'viewer';

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  email: string;
  name: string | null;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
}

export type InsertWorkspaceMember = Omit<WorkspaceMemberRow, 'id' | 'created_at'>;
export type UpdateWorkspaceMember = Partial<Pick<WorkspaceMemberRow, 'role' | 'name'>>;

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  workspace_id: string;
  actor_key_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export type InsertAuditLog = Omit<AuditLogRow, 'id' | 'created_at'>;
