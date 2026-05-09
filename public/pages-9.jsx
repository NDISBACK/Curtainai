// Curtain — Enterprise pages: Escalation Inbox, Team, Audit Log

// ─── Shared helpers ───────────────────────────────────────────────────────────

const fmtDate = d => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtAgo = d => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── Escalation Inbox ─────────────────────────────────────────────────────────

const EscalationInbox = ({ goto }) => {
  const [items, setItems]     = React.useState([]);
  const [total, setTotal]     = React.useState(0);
  const [status, setStatus]   = React.useState('open');
  const [page, setPage]       = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr]         = React.useState(null);
  const [resolving, setResolving] = React.useState(null); // id
  const [noteModal, setNoteModal] = React.useState(null); // { id, query }
  const [note, setNote]       = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await window.api.listEscalations({ status, page, limit: 20 });
      setItems(res.data);
      setTotal(res.total);
    } catch (e) {
      setErr(e.message || 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  React.useEffect(() => { load(); }, [load]);

  const resolve = async (id, resolveNote) => {
    setResolving(id);
    try {
      await window.api.resolveEscalation(id, resolveNote);
      load();
    } catch (e) {
      setErr(e.message || 'Failed to resolve');
    } finally {
      setResolving(null);
      setNoteModal(null);
      setNote('');
    }
  };

  const openNoteModal = (item) => { setNoteModal(item); setNote(''); };

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Escalation Inbox</h1>
          <p className="page-sub">Queries that could not be matched to a skill and need human review.</p>
        </div>
      </div>

      {err && <div className="alert err" style={{ marginBottom: 16 }}><Icon name="x" size={14} />{err}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          {['open', 'resolved', 'all'].map(s => (
            <button key={s} className={`btn sm ${status === s ? 'primary' : ''}`}
              onClick={() => { setStatus(s); setPage(1); }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)', alignSelf: 'center' }}>{total} total</span>
        </div>

        {loading ? (
          <table className="table"><tbody>{Array.from({length: 5}).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody></table>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <Icon name="check2" size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--success)' }} />
            <div style={{ fontWeight: 500 }}>No {status === 'all' ? '' : status} escalations</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {status === 'open' ? 'Your query engine is handling everything automatically.' : 'Nothing here yet.'}
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Decision</th>
                <th>Confidence</th>
                <th>Time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}
                      title={item.input}>{item.input}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 220 }}
                      title={item.output?.decision}>{item.output?.decision || '—'}</span>
                  </td>
                  <td><Confidence value={item.confidence} /></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{fmtAgo(item.created_at)}</td>
                  <td>
                    {item.escalation_status === 'resolved'
                      ? <span className="badge active"><span className="dot"></span>Resolved</span>
                      : <span className="badge pending"><span className="dot"></span>Open</span>}
                  </td>
                  <td>
                    {item.escalation_status === 'open' && (
                      <button className="btn sm primary" disabled={resolving === item.id}
                        onClick={() => openNoteModal(item)}>
                        {resolving === item.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    )}
                    {item.escalation_status === 'resolved' && item.resolved_note && (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }} title={item.resolved_note}>
                        Note: {item.resolved_note.slice(0, 40)}{item.resolved_note.length > 40 ? '…' : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
            <button className="btn sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button className="btn sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {noteModal && (
        <div className="modal-overlay" onClick={() => setNoteModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Resolve escalation</div>
              <button className="modal-close" onClick={() => setNoteModal(null)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink-2)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Query</div>
                <div>{noteModal.input}</div>
              </div>
              <label className="field-label">Resolution note <span style={{ color: 'var(--ink-4)' }}>(optional)</span></label>
              <textarea className="field-input" rows={3} placeholder="e.g. Handled via ticket #1234, added new skill…"
                value={note} onChange={e => setNote(e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setNoteModal(null)}>Cancel</button>
              <button className="btn primary" disabled={resolving === noteModal.id}
                onClick={() => resolve(noteModal.id, note || undefined)}>
                {resolving === noteModal.id ? 'Resolving…' : 'Mark as resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Team Management ──────────────────────────────────────────────────────────

const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
const ROLE_DESC   = {
  admin:  'Full access — can manage skills, team, and settings',
  editor: 'Can create, edit, and approve skills. Cannot manage team or API keys.',
  viewer: 'Read-only. Can view skills, queries, and analytics.',
};

const TeamPage = () => {
  const [members, setMembers]   = React.useState([]);
  const [loading, setLoading]   = React.useState(false);
  const [err, setErr]           = React.useState(null);
  const [showAdd, setShowAdd]   = React.useState(false);
  const [form, setForm]         = React.useState({ email: '', role: 'viewer', name: '' });
  const [adding, setAdding]     = React.useState(false);
  const [addErr, setAddErr]     = React.useState(null);
  const [removing, setRemoving] = React.useState(null);
  const [updating, setUpdating] = React.useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setMembers(await window.api.listTeam()); }
    catch (e) { setErr(e.message || 'Failed to load team'); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  const addMember = async () => {
    if (!form.email.trim()) return;
    setAdding(true); setAddErr(null);
    try {
      await window.api.addTeamMember(form.email, form.role, form.name || undefined);
      setShowAdd(false);
      setForm({ email: '', role: 'viewer', name: '' });
      load();
    } catch (e) {
      setAddErr(e.message || 'Failed to add member');
    } finally { setAdding(false); }
  };

  const changeRole = async (id, role) => {
    setUpdating(id);
    try { await window.api.updateTeamMember(id, { role }); load(); }
    catch (e) { setErr(e.message || 'Failed to update'); }
    finally { setUpdating(null); }
  };

  const removeMember = async (id) => {
    if (!confirm('Remove this team member?')) return;
    setRemoving(id);
    try { await window.api.removeTeamMember(id); load(); }
    catch (e) { setErr(e.message || 'Failed to remove'); }
    finally { setRemoving(null); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-sub">Manage who can access this workspace and what they can do.</p>
        </div>
        <button className="btn primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={14} />Add member
        </button>
      </div>

      {err && <div className="alert err" style={{ marginBottom: 16 }}><Icon name="x" size={14} />{err}</div>}

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        {Object.entries(ROLE_DESC).map(([r, desc]) => (
          <div key={r} className="card" style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{ROLE_LABELS[r]}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <table className="table"><tbody>{Array.from({length: 3}).map((_, i) => <SkeletonRow key={i} cols={4} />)}</tbody></table>
        ) : members.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <Icon name="mssg" size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
            <div>No team members yet. Add your first member to collaborate.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Member</th><th>Email</th><th>Role</th><th>Added</th><th></th></tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{m.email}</td>
                  <td>
                    <select className="field-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                      value={m.role} disabled={updating === m.id}
                      onChange={e => changeRole(m.id, e.target.value)}>
                      {Object.entries(ROLE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(m.created_at)}</td>
                  <td>
                    <button className="btn sm danger" disabled={removing === m.id}
                      onClick={() => removeMember(m.id)}>
                      {removing === m.id ? '…' : <Icon name="trash" size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Add team member</div>
              <button className="modal-close" onClick={() => setShowAdd(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              {addErr && <div className="alert err" style={{ marginBottom: 12 }}><Icon name="x" size={13} />{addErr}</div>}
              <div className="field-group">
                <label className="field-label">Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="field-input" type="email" placeholder="colleague@company.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Name</label>
                <input className="field-input" type="text" placeholder="Full name (optional)"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Role</label>
                <select className="field-input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l} — {ROLE_DESC[v]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn primary" disabled={adding || !form.email.trim()} onClick={addMember}>
                {adding ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

const ACTION_META = {
  'skill.created':       { label: 'Skill created',       cls: 'active'  },
  'skill.approved':      { label: 'Skill approved',      cls: 'active'  },
  'skill.batch_approved':{ label: 'Batch approved',      cls: 'active'  },
  'skill.updated':       { label: 'Skill updated',       cls: 'pending' },
  'skill.disabled':      { label: 'Skill disabled',      cls: 'disabled'},
  'skill.enabled':       { label: 'Skill re-enabled',    cls: 'pending' },
  'skill.deleted':       { label: 'Skill deleted',       cls: 'disabled'},
  'api_key.created':     { label: 'API key created',     cls: 'active'  },
  'api_key.revoked':     { label: 'API key revoked',     cls: 'disabled'},
  'member.added':        { label: 'Member added',        cls: 'active'  },
  'member.updated':      { label: 'Member updated',      cls: 'pending' },
  'member.removed':      { label: 'Member removed',      cls: 'disabled'},
  'workspace.updated':   { label: 'Settings changed',    cls: 'pending' },
  'escalation.resolved': { label: 'Escalation resolved', cls: 'active'  },
};

const AuditLog = () => {
  const [items, setItems]         = React.useState([]);
  const [total, setTotal]         = React.useState(0);
  const [page, setPage]           = React.useState(1);
  const [resourceType, setResourceType] = React.useState('');
  const [loading, setLoading]     = React.useState(false);
  const [err, setErr]             = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params = { page, limit: 50 };
      if (resourceType) params.resource_type = resourceType;
      const res = await window.api.listAuditLogs(params);
      setItems(res.data);
      setTotal(res.total);
    } catch (e) {
      setErr(e.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, resourceType]);

  React.useEffect(() => { load(); }, [load]);

  const LIMIT = 50;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const TYPES = ['', 'skill', 'api_key', 'member', 'workspace', 'query'];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-sub">Every significant action in your workspace, with actor and timestamp.</p>
        </div>
      </div>

      {err && <div className="alert err" style={{ marginBottom: 16 }}><Icon name="x" size={14} />{err}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <Icon name="filter" size={13} style={{ color: 'var(--ink-3)' }} />
          <select className="field-input" style={{ padding: '4px 10px', fontSize: 12, width: 'auto' }}
            value={resourceType} onChange={e => { setResourceType(e.target.value); setPage(1); }}>
            {TYPES.map(t => <option key={t} value={t}>{t === '' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{total} entries</span>
        </div>

        {loading ? (
          <table className="table"><tbody>{Array.from({length: 8}).map((_, i) => <SkeletonRow key={i} cols={4} />)}</tbody></table>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <Icon name="file" size={28} style={{ display: 'block', margin: '0 auto 10px' }} />
            <div>No audit events yet. Actions like approving skills and creating API keys will appear here.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Action</th><th>Resource</th><th>Details</th><th>Time</th></tr>
            </thead>
            <tbody>
              {items.map(entry => {
                const am = ACTION_META[entry.action] || { label: entry.action, cls: 'pending' };
                const meta = entry.meta || {};
                const detail = meta.name || meta.email || meta.count != null ? `${meta.count} skills` : meta.scope || entry.resource_id?.slice(0, 8);
                return (
                  <tr key={entry.id}>
                    <td>
                      <span className={`badge ${am.cls}`}><span className="dot"></span>{am.label}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      {entry.resource_type && <span className="mono" style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{entry.resource_type}</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {detail || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {fmtAgo(entry.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
            <button className="btn sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button className="btn sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};
