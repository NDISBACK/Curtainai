// Curtain — API client
// Wraps all /api/v1 calls. Config stored in localStorage.

class CurtainAPI {
  constructor() {
    this._key = localStorage.getItem('curtain_api_key') || '';
    this._wsId = localStorage.getItem('curtain_workspace_id') || '';
  }

  get isConfigured() {
    return !!(this._key && this._wsId);
  }

  configure(apiKey, workspaceId) {
    this._key = apiKey;
    this._wsId = workspaceId;
    localStorage.setItem('curtain_api_key', apiKey);
    localStorage.setItem('curtain_workspace_id', workspaceId);
  }

  clearConfig() {
    this._key = '';
    this._wsId = '';
    localStorage.removeItem('curtain_api_key');
    localStorage.removeItem('curtain_workspace_id');
  }

  async _fetch(path, options = {}) {
    const res = await fetch(`/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._key}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 204) return null;
    const body = await res.json();
    if (!body.success) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body.data;
  }

  // ── Workspace ─────────────────────────────────────────────────────────────
  getWorkspace() {
    return this._fetch(`/workspaces/${this._wsId}`);
  }

  updateWorkspace(patch) {
    return this._fetch(`/workspaces/${this._wsId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  getWorkspaceAnalytics(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this._fetch(`/workspaces/${this._wsId}/analytics${qs ? '?' + qs : ''}`);
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  listApiKeys() {
    return this._fetch(`/workspaces/${this._wsId}/api-keys`);
  }

  createApiKey(name) {
    return this._fetch(`/workspaces/${this._wsId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  revokeApiKey(keyId) {
    return this._fetch(`/workspaces/${this._wsId}/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  listSkills(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/skills${qs ? '?' + qs : ''}`);
  }

  getSkill(id) {
    return this._fetch(`/skills/${id}`);
  }

  createSkill(data) {
    return this._fetch('/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateSkill(id, data) {
    return this._fetch(`/skills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deleteSkill(id) {
    return this._fetch(`/skills/${id}`, { method: 'DELETE' });
  }

  approveSkill(id) {
    return this._fetch(`/skills/${id}/approve`, { method: 'PATCH' });
  }

  disableSkill(id) {
    return this._fetch(`/skills/${id}/disable`, { method: 'PATCH' });
  }

  enableSkill(id) {
    return this._fetch(`/skills/${id}/enable`, { method: 'PATCH' });
  }

  getSkillVersions(id) {
    return this._fetch(`/skills/${id}/versions`);
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  runQuery(query) {
    return this._fetch('/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  listQueries(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return this._fetch(`/queries${qs ? '?' + qs : ''}`);
  }

  submitOverride(data) {
    return this._fetch('/query/override', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Extract ───────────────────────────────────────────────────────────────
  extractSkills(conversation, options = {}) {
    const body = { ...options };
    if (Array.isArray(conversation)) {
      body.conversations = conversation;
    } else {
      body.conversation = conversation;
    }
    return this._fetch('/extract', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  runSimulation(payload) {
    return this._fetch('/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ── Integrations ──────────────────────────────────────────────────────────
  getGmailOAuthUrl() {
    return this._fetch('/integrations/gmail/oauth/url');
  }

  listIntegrations() {
    return this._fetch('/integrations');
  }

  createIntegration(provider, config) {
    return this._fetch('/integrations', {
      method: 'POST',
      body: JSON.stringify({ provider, config }),
    });
  }

  deleteIntegration(id) {
    return this._fetch(`/integrations/${id}`, { method: 'DELETE' });
  }

  syncIntegration(id, limit = 200) {
    const qs = limit !== 200 ? `?limit=${limit}` : '';
    return this._fetch(`/integrations/${id}/sync${qs}`, { method: 'POST' });
  }

  getSyncStatus(id, jobId) {
    return this._fetch(`/integrations/${id}/sync/status?job_id=${encodeURIComponent(jobId)}`);
  }

  confirmSync(id, skills) {
    return this._fetch(`/integrations/${id}/sync/confirm`, {
      method: 'POST',
      body: JSON.stringify({ skills }),
    });
  }

  cancelSync(id, jobId) {
    return this._fetch(`/integrations/${id}/sync/cancel`, {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId }),
    });
  }

  // ── Gap Analysis ──────────────────────────────────────────────────────────
  getGapAnalysis(limit = 200) {
    return this._fetch(`/analytics/gaps?limit=${limit}`);
  }

  // ── MCP ───────────────────────────────────────────────────────────────────
  async mcpCall(method, params = null) {
    const payload = { jsonrpc: '2.0', id: Date.now(), method };
    if (params) payload.params = params;
    const res = await fetch('/mcp/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._key}`,
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  exportSkills(format = 'mcp_tools', status = 'active') {
    return this._fetch(`/skills/export?format=${format}&status=${status}`);
  }
}

window.api = new CurtainAPI();
