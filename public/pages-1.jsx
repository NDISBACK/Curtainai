// Curtain — Dashboard, SkillsPage, SkillDetail

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—';

// Returns { level: 'green'|'amber'|'red'|'pending', label, tip }
const skillHealth = (skill) => {
  if (!skill) return null;
  if (skill.status === 'pending_review') return { level: 'pending', label: 'Pending', tip: 'Awaiting approval' };
  if (skill.status === 'disabled') return { level: 'red', label: 'Disabled', tip: 'Re-enable to use in queries' };
  const conf = skill.confidence ?? 1;
  if (conf < 0.70) return { level: 'red', label: 'Low conf', tip: `Confidence ${Math.round(conf * 100)}% — review trigger condition` };
  if (conf < 0.85) return { level: 'amber', label: 'Fair conf', tip: `Confidence ${Math.round(conf * 100)}% — could be improved` };
  return { level: 'green', label: 'Healthy', tip: `Confidence ${Math.round(conf * 100)}%` };
};

const HealthDot = ({ skill }) => {
  const h = skillHealth(skill);
  if (!h) return null;
  const colors = { green: 'var(--success)', amber: 'var(--warning)', red: 'var(--danger)', pending: 'var(--accent)' };
  return (
    <span title={h.tip} style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: 4,
      background: colors[h.level], flexShrink: 0,
      boxShadow: `0 0 0 2px oklch(from ${colors[h.level]} l c h / 0.2)`,
    }} />
  );
};

// ─── New Skill Modal ──────────────────────────────────────────────────────────
const NewSkillModal = ({ onClose, onCreated }) => {
  const [form, setForm] = React.useState({
    name: '', trigger_condition: '', decision: '', conditions: '', escalation_required: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.trigger_condition.trim() || !form.decision.trim()) {
      setErr('Name, trigger condition, and decision are required.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const condArr = form.conditions
        ? form.conditions.split('\n').map(s => s.trim()).filter(Boolean)
        : [];
      const conditions = condArr.length
        ? Object.fromEntries(condArr.map((c, i) => [String(i), c]))
        : null;
      const skill = await window.api.createSkill({
        name: form.name.trim(),
        trigger_condition: form.trigger_condition.trim(),
        decision: form.decision.trim(),
        conditions,
        escalation_required: form.escalation_required,
      });
      onCreated(skill);
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">New skill</div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {err && <ErrorAlert message={err} />}
          <div className="field">
            <label>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Duplicate Charge Refund" />
          </div>
          <div className="field">
            <label>Trigger condition *</label>
            <textarea value={form.trigger_condition} onChange={e => set('trigger_condition', e.target.value)}
              placeholder="When does this skill fire? Describe the customer situation." rows={3} />
          </div>
          <div className="field">
            <label>Decision *</label>
            <textarea value={form.decision} onChange={e => set('decision', e.target.value)}
              placeholder="What should happen? The exact text returned to the agent." rows={3} />
          </div>
          <div className="field">
            <label>Conditions</label>
            <textarea value={form.conditions} onChange={e => set('conditions', e.target.value)}
              placeholder="One condition per line (e.g. plan_type = annual)" rows={3} />
            <div className="field-hint">Optional. Each line becomes one condition.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="esc-req" checked={form.escalation_required}
              onChange={e => set('escalation_required', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="esc-req" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', margin: 0 }}>
              Requires human escalation
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create skill'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edit Skill Modal ─────────────────────────────────────────────────────────
const EditSkillModal = ({ skill, onClose, onUpdated }) => {
  const condStr = skill.conditions
    ? (Array.isArray(skill.conditions)
        ? skill.conditions.join('\n')
        : Object.values(skill.conditions).join('\n'))
    : '';
  const [form, setForm] = React.useState({
    name: skill.name || '',
    trigger_condition: skill.trigger_condition || '',
    decision: skill.decision || '',
    conditions: condStr,
    escalation_required: skill.escalation_required || false,
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const condArr = form.conditions
        ? form.conditions.split('\n').map(s => s.trim()).filter(Boolean)
        : [];
      const conditions = condArr.length
        ? Object.fromEntries(condArr.map((c, i) => [String(i), c]))
        : null;
      const updated = await window.api.updateSkill(skill.id, {
        name: form.name.trim(),
        trigger_condition: form.trigger_condition.trim(),
        decision: form.decision.trim(),
        conditions,
        escalation_required: form.escalation_required,
      });
      onUpdated(updated);
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Edit skill</div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {err && <ErrorAlert message={err} />}
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Trigger condition</label>
            <textarea value={form.trigger_condition} onChange={e => set('trigger_condition', e.target.value)} rows={3} />
          </div>
          <div className="field">
            <label>Decision</label>
            <textarea value={form.decision} onChange={e => set('decision', e.target.value)} rows={3} />
          </div>
          <div className="field">
            <label>Conditions</label>
            <textarea value={form.conditions} onChange={e => set('conditions', e.target.value)} rows={3}
              placeholder="One per line" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="esc-req-edit" checked={form.escalation_required}
              onChange={e => set('escalation_required', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="esc-req-edit" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', margin: 0 }}>
              Requires human escalation
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({ goto, openSkill, workspace }) => {
  const [skills, setSkills] = React.useState([]);
  const [queries, setQueries] = React.useState([]);
  const [analytics, setAnalytics] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [sk, qRes] = await Promise.all([
        window.api.listSkills({ limit: 100 }),
        window.api.listQueries({ limit: 6 }),
      ]);
      setSkills(sk);
      setQueries(qRes.data || []);
      try {
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const an = await window.api.getWorkspaceAnalytics(from);
        setAnalytics(an);
      } catch (_) {}
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const total = skills.length;
  const active = skills.filter(s => s.status === 'active').length;
  const pending = skills.filter(s => s.status === 'pending_review').length;

  // Skill health: skills that need attention (amber or red)
  const unhealthy = skills.filter(s => {
    const h = skillHealth(s);
    return h && (h.level === 'amber' || h.level === 'red');
  });

  // Metrics from analytics (fall back to local computation if analytics unavailable)
  const matchRate = analytics?.match_rate != null
    ? `${Math.round(analytics.match_rate * 100)}%` : null;
  const escalRate = analytics?.escalation_rate != null
    ? `${Math.round(analytics.escalation_rate * 100)}%` : null;
  const avgConfAn = analytics?.avg_confidence != null
    ? `${Math.round(analytics.avg_confidence * 100)}%` : null;
  const totalQAn = analytics?.total_queries ?? null;

  // Fallback local metrics
  const matchedQueries = queries.filter(q => q.matched_skill_id);
  const avgConfLocal = matchedQueries.length
    ? `${Math.round(matchedQueries.reduce((a, q) => a + (q.confidence || 0), 0) / matchedQueries.length * 100)}%`
    : null;
  const escalatedCount = queries.filter(q => q.escalated).length;

  const MetricCard = ({ label, value, sub, color }) => (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color }}>{value}</div>
      <div className="metric-meta"><span>{sub}</span></div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">A live view of every decision your AI is making — and the skills behind them.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Refresh</button>
          <button className="btn primary" onClick={() => goto('test')}><Icon name="bolt" size={13} /> New query</button>
        </div>
      </div>

      {err && <ErrorAlert message={err} onRetry={load} />}

      <div className="metric-grid">
        <MetricCard label="Match rate" value={loading ? '…' : (matchRate || '—')} sub="30-day · AI resolved"
          color={analytics?.match_rate >= 0.7 ? 'var(--success)' : analytics?.match_rate < 0.5 ? 'var(--danger)' : undefined} />
        <MetricCard label="Avg confidence" value={loading ? '…' : (avgConfAn || avgConfLocal || '—')} sub="on matched queries"
          color={analytics?.avg_confidence >= 0.85 ? 'var(--success)' : undefined} />
        <MetricCard label="Active skills" value={loading ? '…' : fmt(active)}
          sub={pending ? `${pending} pending review` : 'live in engine'} />
        <MetricCard label="Escalation rate" value={loading ? '…' : (escalRate || (queries.length ? `${Math.round(escalatedCount / Math.max(queries.length, 1) * 100)}%` : '—'))}
          sub="30-day · forwarded to humans"
          color={analytics?.escalation_rate <= 0.2 ? 'var(--success)' : analytics?.escalation_rate > 0.4 ? 'var(--danger)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Recent queries</div>
              <div className="card-sub">Latest decisions made by the engine</div>
            </div>
            <button className="btn ghost sm" onClick={() => goto('activity')}>View all <Icon name="arrow" size={12} /></button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Query</th>
                <th>Matched skill</th>
                <th>Confidence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3,4].map(i => <SkeletonRow key={i} cols={4} />)}
              {!loading && queries.length === 0 && (
                <tr><td colSpan="4" className="empty">No queries yet. Run one from the Query Console.</td></tr>
              )}
              {!loading && queries.map(q => {
                const skill = skills.find(s => s.id === q.matched_skill_id);
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => goto('activity', q.id)}>
                    <td style={{ maxWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.input}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {q.id.slice(0, 8)} · {fmtRelative(q.created_at)}
                      </div>
                    </td>
                    <td>
                      {skill
                        ? <span style={{ fontWeight: 500 }}>{skill.name}</span>
                        : <span className="badge escalate"><span className="dot"></span>Escalated</span>}
                    </td>
                    <td><Confidence value={q.confidence} /></td>
                    <td><Icon name="chevron" size={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">Skill status</div>
              <button className="btn ghost sm" onClick={() => goto('skills')}>Manage <Icon name="arrow" size={12} /></button>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 18 }}>
                  {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 44, borderRadius: 8 }}></div>)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[['active','Active',active],['pending_review','Pending review',pending],['disabled','Disabled',total-active-pending]].map(([key,label,count]) => (
                    <div key={key} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}
                      onClick={() => goto('skills')}>
                      <StatusBadge status={key} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Needs attention */}
          {!loading && unhealthy.length > 0 && (
            <div className="card" style={{ borderColor: 'oklch(0.85 0.07 80)' }}>
              <div className="card-head">
                <div className="card-title" style={{ color: 'var(--warning)' }}>Needs attention</div>
                <span className="badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{unhealthy.length}</span>
              </div>
              <div className="card-body" style={{ paddingTop: 4 }}>
                {unhealthy.slice(0, 4).map(sk => {
                  const h = skillHealth(sk);
                  return (
                    <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}
                      onClick={() => openSkill(sk.id)}>
                      <HealthDot skill={sk} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sk.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{h?.tip}</div>
                      </div>
                      <Icon name="chevron" size={13} />
                    </div>
                  );
                })}
                {unhealthy.length > 4 && (
                  <button className="btn ghost sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={() => goto('skills')}>
                    +{unhealthy.length - 4} more <Icon name="arrow" size={11} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginTop: 18 }}>
        {[
          { title: 'Extraction Studio', count: null, sub: 'Learn from conversations instantly', icon: 'sparkle', cta: 'Open studio', go: 'extraction' },
          { title: 'Escalations', count: escalatedCount > 0 ? escalatedCount : null, sub: escalatedCount > 0 ? `of ${queries.length} recent queries` : 'No escalations recently', icon: 'arrowup', cta: 'See activity', go: 'activity' },
          { title: 'Analytics', count: matchRate, sub: 'match rate · last 30 days', icon: 'activity', cta: 'View analytics', go: 'analytics' },
        ].map((c, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={() => goto(c.go)}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
                <Icon name={c.icon} size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: c.count ? 22 : 14, fontWeight: 600, letterSpacing: c.count ? '-0.02em' : undefined, color: 'var(--ink)' }}>
                  {loading ? '…' : (c.count ?? c.title)}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{c.sub}</div>
              </div>
              <button className="btn ghost sm" style={{ flexShrink: 0 }}>{c.cta} <Icon name="arrow" size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Skills ───────────────────────────────────────────────────────────────────
const SkillsPage = ({ openSkill }) => {
  const [skills, setSkills] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [filter, setFilter] = React.useState('All');
  const [status, setStatus] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [showNew, setShowNew] = React.useState(false);
  const [actioning, setActioning] = React.useState(null); // skill id being actioned

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await window.api.listSkills({ limit: 100 });
      setSkills(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const categories = ['All', ...Array.from(new Set(skills.map(s => s.category).filter(Boolean)))];

  const filtered = skills.filter(s =>
    (filter === 'All' || s.category === filter) &&
    (status === 'all' || s.status === status) &&
    (q === '' || (s.name || '').toLowerCase().includes(q.toLowerCase()) ||
      (s.trigger_condition || '').toLowerCase().includes(q.toLowerCase()))
  );

  const action = async (id, fn, label) => {
    setActioning(id);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(`Failed to ${label}: ${e.message}`);
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Skills</h1>
          <p className="page-sub">Decision patterns that drive every automated response in your workspace.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => setShowNew(true)}><Icon name="plus" size={13} /> New skill</button>
        </div>
      </div>

      {err && <ErrorAlert message={err} onRetry={load} />}

      {showNew && <NewSkillModal onClose={() => setShowNew(false)} onCreated={(sk) => { setSkills(s => [sk, ...s]); }} />}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="filterbar">
          {categories.length > 1 && (
            <div className="chip-group">
              {categories.map(c => (
                <button key={c} className={`chip ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
              ))}
            </div>
          )}
          <div style={{ width: 1, height: 22, background: 'var(--line)' }}></div>
          <div className="chip-group">
            {[['all','All'],['active','Active'],['pending_review','Pending'],['disabled','Disabled']].map(([k,v]) => (
              <button key={k} className={`chip ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{v}</button>
            ))}
          </div>
          <input className="filter-input" placeholder="Filter by name or trigger…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Name</th>
              <th>Status</th>
              <th>Health</th>
              <th>Confidence</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5].map(i => <SkeletonRow key={i} cols={6} />)}
            {!loading && filtered.map(s => (
              <tr key={s.id} onClick={() => openSkill(s.id)}>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                    {s.trigger_condition}
                  </div>
                </td>
                <td><StatusBadge status={s.status} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HealthDot skill={s} />
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{skillHealth(s)?.label}</span>
                  </div>
                </td>
                <td><Confidence value={s.confidence} /></td>
                <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fmtDate(s.created_at).split(',')[0]}</td>
                <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {s.status === 'pending_review' && (
                    <button className="btn sm accent" disabled={actioning === s.id}
                      onClick={() => action(s.id, () => window.api.approveSkill(s.id), 'approve')}>
                      <Icon name="check" size={11} /> Approve
                    </button>
                  )}
                  {s.status === 'active' && (
                    <button className="btn sm" disabled={actioning === s.id}
                      onClick={() => action(s.id, () => window.api.disableSkill(s.id), 'disable')}>
                      <Icon name="pause" size={11} /> Disable
                    </button>
                  )}
                  {s.status === 'disabled' && (
                    <button className="btn sm" disabled={actioning === s.id}
                      onClick={() => action(s.id, () => window.api.enableSkill(s.id), 'enable')}>
                      <Icon name="refresh" size={11} /> Enable
                    </button>
                  )}
                  <Icon name="chevron" size={14} />
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="6" className="empty">
                {skills.length === 0 ? 'No skills yet. Create your first skill.' : 'No skills match these filters.'}
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="card-foot">
          <span>{loading ? '…' : `${filtered.length} of ${skills.length} skills`}</span>
          <span>Updated {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Skill detail ─────────────────────────────────────────────────────────────
const SkillDetail = ({ id, back }) => {
  const [skill, setSkill] = React.useState(null);
  const [versions, setVersions] = React.useState([]);
  const [queries, setQueries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [tab, setTab] = React.useState('overview');
  const [actioning, setActioning] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [sk, vers, qRes] = await Promise.all([
        window.api.getSkill(id),
        window.api.getSkillVersions(id),
        window.api.listQueries({ skill_id: id, limit: 10 }),
      ]);
      setSkill(sk);
      setVersions(vers);
      setQueries(qRes.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const doAction = async (fn, label) => {
    setActioning(true);
    try {
      const updated = await fn();
      setSkill(updated);
    } catch (e) {
      setErr(`Failed to ${label}: ${e.message}`);
    } finally {
      setActioning(false);
    }
  };

  if (loading) return (
    <div className="page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
        {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 60, borderRadius: 8 }}></div>)}
      </div>
    </div>
  );

  if (err && !skill) return (
    <div className="page"><ErrorAlert message={err} onRetry={load} /></div>
  );

  if (!skill) return <div className="page"><div className="empty">Skill not found.</div></div>;

  const condArr = skill.conditions
    ? (Array.isArray(skill.conditions)
        ? skill.conditions
        : Object.values(skill.conditions))
    : [];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13 }}>
        <button className="btn ghost sm" onClick={back}>
          <Icon name="arrow" size={12} style={{ transform: 'rotate(180deg)' }} /> Skills
        </button>
        <span className="id-tag">{skill.id}</span>
      </div>

      {err && <ErrorAlert message={err} />}

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{skill.name}</h1>
            <StatusBadge status={skill.status} />
            {skill.escalation_required && <span className="badge escalate"><span className="dot"></span>Escalates</span>}
          </div>
          <p className="page-sub">Created {fmtDate(skill.created_at)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {skill.status === 'pending_review' && (
            <button className="btn accent" disabled={actioning}
              onClick={() => doAction(() => window.api.approveSkill(id), 'approve')}>
              <Icon name="check" size={13} /> Approve
            </button>
          )}
          {skill.status === 'active' && (
            <button className="btn" disabled={actioning}
              onClick={() => doAction(() => window.api.disableSkill(id), 'disable')}>
              <Icon name="pause" size={12} /> Disable
            </button>
          )}
          {skill.status === 'disabled' && (
            <button className="btn" disabled={actioning}
              onClick={() => doAction(() => window.api.enableSkill(id), 're-enable')}>
              <Icon name="refresh" size={13} /> Re-enable
            </button>
          )}
          <button className="btn" onClick={() => setShowEdit(true)}>
            <Icon name="edit" size={13} /> Edit
          </button>
        </div>
      </div>

      {showEdit && (
        <EditSkillModal skill={skill} onClose={() => setShowEdit(false)} onUpdated={(updated) => { setSkill(updated); }} />
      )}

      <div className="tabs">
        {[
          ['overview','Overview'],
          ['versions',`Versions · ${versions.length}`],
          ['queries',`Queries · ${queries.length}`],
        ].map(([k,v]) => (
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="detail">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div className="card">
              <div className="card-head">
                <div className="card-title">Definition</div>
                <span className="badge mono">JSONB</span>
              </div>
              <div className="card-body">
                <dl className="kv">
                  <dt>Trigger</dt>
                  <dd>{skill.trigger_condition || <span style={{ color: 'var(--ink-4)' }}>Not set</span>}</dd>
                  <dt>Decision</dt>
                  <dd style={{ fontWeight: 500 }}>{skill.decision || <span style={{ color: 'var(--ink-4)' }}>Not set</span>}</dd>
                  <dt>Conditions</dt>
                  <dd>
                    {condArr.length === 0
                      ? <span style={{ color: 'var(--ink-4)' }}>None</span>
                      : <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {condArr.map((c, i) => (
                            <li key={i} className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Icon name="check" size={12} stroke={2} /> {String(c)}
                            </li>
                          ))}
                        </ul>}
                  </dd>
                  <dt>Escalation</dt>
                  <dd>
                    {skill.escalation_required
                      ? <span className="badge escalate"><span className="dot"></span>Required</span>
                      : <span style={{ color: 'var(--ink-3)' }}>Not required</span>}
                  </dd>
                  <dt>Confidence</dt>
                  <dd><Confidence value={skill.confidence} width={140} /></dd>
                </dl>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">Recent queries using this skill</div>
              </div>
              <table className="table">
                <thead>
                  <tr><th style={{ width: '60%' }}>Query</th><th>Confidence</th><th>When</th></tr>
                </thead>
                <tbody>
                  {queries.length === 0 && <tr><td colSpan="3" className="empty">No queries have used this skill yet.</td></tr>}
                  {queries.map(q => (
                    <tr key={q.id}>
                      <td style={{ maxWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.input}</div></td>
                      <td><Confidence value={q.confidence} /></td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fmtRelative(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card">
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500 }}>Versions</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{versions.length || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500 }}>Queries</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{queries.length}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><div className="card-title">Skill ID</div></div>
              <div className="card-body">
                <div className="id-tag" style={{ fontSize: 11.5, display: 'block', wordBreak: 'break-all' }}>{skill.id}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-4)' }}>
                  Status: <strong style={{ color: 'var(--ink)' }}>{skill.status}</strong>
                </div>
                {skill.updated_at && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-4)' }}>
                    Updated: {fmtDate(skill.updated_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'versions' && (
        <div className="card">
          <div className="card-head"><div className="card-title">Version history</div></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {versions.length === 0 && <div className="empty">No version history. Versions are created when you edit an active skill.</div>}
            {versions.map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 14, padding: '12px 0', borderBottom: '1px dashed var(--line-2)' }}>
                <div className="badge mono" style={{ width: 'fit-content' }}>v{v.version}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{v.change_note || v.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{v.changed_by || 'system'} · {fmtDate(v.created_at)}</div>
                  {v.trigger_condition && (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Trigger: {v.trigger_condition.slice(0, 80)}…</div>
                  )}
                </div>
                <div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'queries' && (
        <div className="card">
          <table className="table">
            <thead><tr><th style={{ width: '60%' }}>Input</th><th>Confidence</th><th>When</th><th>Escalated</th></tr></thead>
            <tbody>
              {queries.length === 0 && <tr><td colSpan="4" className="empty">No queries have used this skill yet.</td></tr>}
              {queries.map(q => (
                <tr key={q.id}>
                  <td>{q.input}</td>
                  <td><Confidence value={q.confidence} /></td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fmtRelative(q.created_at)}</td>
                  <td>{q.escalated ? <span className="badge escalate"><span className="dot"></span>Yes</span> : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { Dashboard, SkillsPage, SkillDetail, fmt, NewSkillModal, EditSkillModal });
