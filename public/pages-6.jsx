// Curtain — ConnectionsPage

const PROVIDERS = [
  {
    id: 'gmail',
    label: 'Gmail',
    description: 'Import email threads from your inbox and extract support patterns automatically.',
    connectType: 'oauth',
    note: null,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Business',
    description: 'Connect your WhatsApp Business account to extract conversation patterns.',
    connectType: 'form',
    note: 'Fetches conversations available via the Business Cloud API.',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'EAAxxxxxxxx…', type: 'password' },
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', type: 'text' },
      { key: 'business_account_id', label: 'Business Account ID', placeholder: '9876543210', type: 'text' },
    ],
  },
  {
    id: 'freshdesk',
    label: 'Freshdesk',
    description: 'Pull resolved tickets from Freshdesk and auto-extract decision skills.',
    connectType: 'form',
    note: null,
    fields: [
      { key: 'domain', label: 'Domain', placeholder: 'yourcompany.freshdesk.com', type: 'text' },
      { key: 'api_key', label: 'API Key', placeholder: 'Your Freshdesk API key', type: 'password' },
    ],
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
const IntegrationStatusBadge = ({ status }) => {
  const map = {
    active:       { label: 'Connected',    color: 'var(--success)',  bg: 'var(--success-soft)' },
    disconnected: { label: 'Disconnected', color: 'var(--ink-3)',    bg: 'var(--bg-subtle)' },
    error:        { label: 'Error',        color: 'var(--danger)',   bg: 'var(--danger-soft)' },
  };
  const s = map[status] || map.disconnected;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
};

// ─── Provider icon ────────────────────────────────────────────────────────────
const ProviderIcon = ({ id, size = 32 }) => {
  const icons = {
    gmail: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    whatsapp: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
    freshdesk: (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
  };
  return icons[id] || null;
};

// ─── Connect form (WhatsApp / Freshdesk) ──────────────────────────────────────
const ConnectForm = ({ provider, onSubmit, onCancel, loading, err }) => {
  const [form, setForm] = React.useState(() =>
    Object.fromEntries(provider.fields.map(f => [f.key, '']))
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      {err && <ErrorAlert message={err} />}
      {provider.fields.map(f => (
        <div key={f.key} className="field" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>{f.label}</label>
          <input
            type={f.type}
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={e => set(f.key, e.target.value)}
            required
            style={{ marginTop: 4 }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" className="btn primary sm" disabled={loading}>
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
};

// ─── Integration card ─────────────────────────────────────────────────────────
const IntegrationCard = ({ provider, integration, onRefresh, onSync, onStopSync, syncing, syncProgress, syncJobId, goto }) => {
  const [showForm, setShowForm] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [stopping, setStopping] = React.useState(false);
  const [formErr, setFormErr] = React.useState(null);

  const isConnected = integration?.status === 'active';
  const isError     = integration?.status === 'error';

  const handleConnect = async (config) => {
    setConnecting(true);
    setFormErr(null);
    try {
      await window.api.createIntegration(provider.id, config);
      setShowForm(false);
      onRefresh();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect ${provider.label}? This will remove stored credentials.`)) return;
    setDisconnecting(true);
    try {
      await window.api.deleteIntegration(integration.id);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleStopSync = async () => {
    if (!syncJobId || stopping) return;
    setStopping(true);
    try {
      await window.api.cancelSync(integration.id, syncJobId);
      onStopSync();
    } catch (e) {
      alert(`Could not stop sync: ${e.message}`);
    } finally {
      setStopping(false);
    }
  };

  const [gmailLoading, setGmailLoading] = React.useState(false);

  const handleGmailConnect = async () => {
    setGmailLoading(true);
    try {
      const { url } = await window.api.getGmailOAuthUrl();
      window.location.href = url;
    } catch (e) {
      alert(`Could not start Gmail OAuth: ${e.message}`);
      setGmailLoading(false);
    }
  };

  const lastSync = integration?.last_synced_at
    ? fmtRelative(integration.last_synced_at)
    : null;

  return (
    <div className="card" style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'var(--bg-subtle)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-2)', flexShrink: 0,
        }}>
          <ProviderIcon id={provider.id} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{provider.label}</span>
            {integration && <IntegrationStatusBadge status={integration.status} />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>
            {provider.description}
          </div>
        </div>
      </div>

      {/* Meta */}
      {isConnected && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {integration.config?.email && (
            <div>Signed in as <strong style={{ color: 'var(--ink-2)' }}>{integration.config.email}</strong></div>
          )}
          {integration.config?.domain && (
            <div>Domain: <strong style={{ color: 'var(--ink-2)' }}>{integration.config.domain}</strong></div>
          )}
          {lastSync && <div>Last synced {lastSync}</div>}
          {!lastSync && <div style={{ color: 'var(--ink-4)' }}>Never synced</div>}
        </div>
      )}

      {isError && (
        <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '6px 10px', borderRadius: 6 }}>
          Connection error — please reconnect.
        </div>
      )}

      {provider.note && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic' }}>{provider.note}</div>
      )}

      {/* Form */}
      {showForm && provider.connectType === 'form' && (
        <ConnectForm
          provider={provider}
          onSubmit={handleConnect}
          onCancel={() => { setShowForm(false); setFormErr(null); }}
          loading={connecting}
          err={formErr}
        />
      )}

      {/* Actions */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
          {isConnected ? (
            <>
              <button
                className="btn primary sm"
                onClick={() => onSync(integration.id, provider.id)}
                disabled={syncing}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {syncing ? (
                  syncProgress && syncProgress.total > 0
                    ? `Processing ${syncProgress.done} / ${syncProgress.total}…`
                    : <><span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />Starting…</>
                ) : 'Sync Now'}
              </button>
              {syncing ? (
                <button
                  className="btn ghost sm"
                  onClick={handleStopSync}
                  disabled={stopping}
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
                >
                  {stopping ? 'Stopping…' : 'Stop Sync'}
                </button>
              ) : (
                <button
                  className="btn ghost sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
            </>
          ) : provider.connectType === 'oauth' ? (
            <button className="btn primary sm" onClick={handleGmailConnect} disabled={gmailLoading}>
              {gmailLoading ? 'Opening…' : 'Connect with Google'}
            </button>
          ) : (
            <button className="btn primary sm" onClick={() => setShowForm(true)}>
              Connect
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Sync preview modal ───────────────────────────────────────────────────────
const SyncPreviewModal = ({ preview, integrationId, onClose, onSaved, goto }) => {
  const [selected, setSelected] = React.useState(() =>
    new Set(preview.extracted_skills.map((_, i) => i))
  );
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState(null);
  const [saveResult, setSaveResult] = React.useState(null);

  const toggle = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === preview.extracted_skills.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(preview.extracted_skills.map((_, i) => i)));
    }
  };

  const handleSave = async () => {
    const skills = preview.extracted_skills.filter((_, i) => selected.has(i));
    if (skills.length === 0) { setSaveErr('Select at least one skill to save.'); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      const result = await window.api.confirmSync(integrationId, skills);
      setSaveResult(result);
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confidenceColor = (c) => {
    if (c >= 0.85) return 'var(--success)';
    if (c >= 0.65) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (saveResult) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <div className="modal-title">Skills saved</div>
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '24px 24px 20px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24, background: 'var(--success-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              color: 'var(--success)',
            }}>
              <Icon name="check" size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              {saveResult.skills_created} skill{saveResult.skills_created !== 1 ? 's' : ''} added
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
              {saveResult.skills_skipped > 0 && `${saveResult.skills_skipped} duplicate${saveResult.skills_skipped !== 1 ? 's' : ''} skipped. `}
              New skills are in <strong>pending review</strong> — approve them to make them active.
            </div>
            {saveResult.errors.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16, textAlign: 'left' }}>
                {saveResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn primary sm" onClick={() => { onSaved(); onClose(); goto('skills'); }}>
                Review skills
              </button>
              <button className="btn ghost sm" onClick={() => { onSaved(); onClose(); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-title">Review extracted skills</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {preview.items_fetched} items synced · {preview.extracted_skills.length} skill{preview.extracted_skills.length !== 1 ? 's' : ''} extracted
              {preview.errors.length > 0 && ` · ${preview.errors.length} error${preview.errors.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        {preview.extracted_skills.length === 0 ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--ink-3)' }}>
            No skills were extracted from this sync.
            {preview.errors.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
                {preview.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Select all + count */}
            <div style={{
              padding: '10px 20px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              fontSize: 12, color: 'var(--ink-3)',
            }}>
              <input
                type="checkbox"
                checked={selected.size === preview.extracted_skills.length}
                onChange={toggleAll}
                style={{ cursor: 'pointer' }}
              />
              <span>
                {selected.size} of {preview.extracted_skills.length} selected
              </span>
            </div>

            {/* Skill list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {preview.extracted_skills.map((skill, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 20px', cursor: 'pointer',
                  borderBottom: i < preview.extracted_skills.length - 1 ? '1px solid var(--line)' : 'none',
                  background: selected.has(i) ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background 0.1s',
                }}>
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{skill.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: confidenceColor(skill.confidence) + '22',
                        color: confidenceColor(skill.confidence),
                      }}>
                        {Math.round(skill.confidence * 100)}%
                      </span>
                      {skill.escalation_required && (
                        <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>ESCALATE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--ink-4)' }}>When: </span>{skill.trigger_condition}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--ink-4)' }}>Then: </span>{skill.decision}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            }}>
              {saveErr && <span style={{ fontSize: 12, color: 'var(--danger)', flex: 1 }}>{saveErr}</span>}
              {!saveErr && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 1 }}>
                  Skills will be added as <strong>pending review</strong>.
                </span>
              )}
              <button className="btn ghost sm" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn primary sm" onClick={handleSave} disabled={saving || selected.size === 0}>
                {saving ? 'Saving…' : `Save ${selected.size} skill${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Connections page ─────────────────────────────────────────────────────────
const ConnectionsPage = ({ goto }) => {
  const [integrations, setIntegrations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [syncing, setSyncing] = React.useState(null);        // providerId being synced
  const [syncJob, setSyncJob] = React.useState(null);        // { id, integrationId, providerId, progress }
  const [preview, setPreview] = React.useState(null);
  const [previewIntId, setPreviewIntId] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await window.api.listIntegrations();
      setIntegrations(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Poll for sync job progress
  React.useEffect(() => {
    if (!syncJob) return;
    let cancelled = false;
    let timeoutId;

    const poll = async () => {
      if (cancelled) return;
      try {
        const status = await window.api.getSyncStatus(syncJob.integrationId, syncJob.id);
        if (cancelled) return;

        setSyncJob(prev => prev ? { ...prev, progress: status.progress } : null);

        if (status.status === 'done') {
          setPreview(status.result);
          setPreviewIntId(syncJob.integrationId);
          setSyncJob(null);
          setSyncing(null);
        } else if (status.status === 'cancelled') {
          setSyncJob(null);
          setSyncing(null);
        } else if (status.status === 'error') {
          alert(`Sync failed: ${status.error}`);
          setSyncJob(null);
          setSyncing(null);
        } else {
          timeoutId = setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!cancelled) {
          alert(`Sync status check failed: ${e.message}`);
          setSyncJob(null);
          setSyncing(null);
        }
      }
    };

    poll();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [syncJob?.id]);

  const handleSync = async (id, providerId) => {
    setSyncing(providerId);
    setSyncJob(null);
    try {
      const { job_id } = await window.api.syncIntegration(id);
      setSyncJob({ id: job_id, integrationId: id, providerId, progress: { fetched: 0, total: 0, done: 0 } });
    } catch (e) {
      alert(`Sync failed: ${e.message}`);
      setSyncing(null);
    }
  };

  const handleStopSync = () => {
    setSyncing(null);
    setSyncJob(null);
  };

  const getIntegration = (providerId) =>
    integrations.find(i => i.provider === providerId) ?? null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Connections</h1>
          <div className="page-sub">
            Connect external tools to import real conversation data and auto-extract skills.
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {err && !loading && <ErrorAlert message={err} />}

      {!loading && !err && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {PROVIDERS.map(p => (
            <IntegrationCard
              key={p.id}
              provider={p}
              integration={getIntegration(p.id)}
              onRefresh={load}
              onSync={handleSync}
              onStopSync={handleStopSync}
              syncing={syncing === p.id}
              syncProgress={syncing === p.id ? syncJob?.progress : null}
              syncJobId={syncing === p.id ? syncJob?.id : null}
              goto={goto}
            />
          ))}
        </div>
      )}

      {preview && (
        <SyncPreviewModal
          preview={preview}
          integrationId={previewIntId}
          onClose={() => { setPreview(null); setPreviewIntId(null); }}
          onSaved={load}
          goto={goto}
        />
      )}
    </div>
  );
};
