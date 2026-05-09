// Curtain — QueryConsole, ActivityPage, SettingsPage

const sampleQueries = [
  'A customer was double-charged for their April subscription. They want a refund.',
  'Hitting 429 errors from /api/v2/issues. Business plan, 18 months on the platform.',
  'EU customer asking for a complete export of their personal data under GDPR.',
  'New hire from Okta cannot log in. Error says user not provisioned.',
];

// ─── Override Modal ───────────────────────────────────────────────────────────
const OverrideModal = ({ queryId, onClose, onSubmitted, goto }) => {
  const [text, setText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [result, setResult] = React.useState(null); // success state

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await window.api.submitOverride({ query_id: queryId, corrected_decision: text.trim() });
      setResult(res);
      if (onSubmitted) onSubmitted(res);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  const generatedSkills = result?.generated_skills || [];

  if (result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <div className="modal-title" style={{ color: 'var(--success)' }}>
              <Icon name="check2" size={15} /> Override applied
            </div>
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="modal-body">
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 12 }}>
              Your correction has been saved and will improve future decisions.
            </div>
            {generatedSkills.length > 0 ? (
              <div style={{ background: 'var(--success-soft)', border: '1px solid oklch(0.85 0.06 150)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
                  AI learned from this
                </div>
                {generatedSkills.map(sk => (
                  <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid oklch(0.9 0.04 150)' }}>
                    <Icon name="sparkle" size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{sk.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Added to Pending Review</div>
                    </div>
                    <span className="badge pending"><span className="dot"></span>Pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                No new skill was generated — this may be a duplicate of an existing pattern.
              </div>
            )}
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={onClose}>Done</button>
            {generatedSkills.length > 0 && goto && (
              <button className="btn primary" onClick={() => { onClose(); goto('skills'); }}>
                Review new skill <Icon name="arrow" size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Override decision</div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {err && <ErrorAlert message={err} />}
          <div className="field">
            <label>Corrected decision</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
              placeholder="What should the decision have been? This trains the system." />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            Your correction is stored and used to generate a new skill automatically.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving || !text.trim()}>
            {saving ? 'Submitting…' : 'Submit override'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Query Console ────────────────────────────────────────────────────────────
const QueryConsole = ({ openSkill, goto }) => {
  const [input, setInput] = React.useState('');
  const [state, setState] = React.useState('idle');
  const [result, setResult] = React.useState(null);
  const [trace, setTrace] = React.useState([]);
  const [timing, setTiming] = React.useState(null);
  const [showOverride, setShowOverride] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => { ref.current?.focus(); }, []);

  const run = async (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput(q);
    setState('running');
    setResult(null);
    setTrace([]);
    setTiming(null);

    const traceSteps = [
      { label: 'Loading active skills…', desc: 'Fetching workspace skill set' },
      { label: 'Embedding query', desc: 'text-embedding-3-small · 1536 dims' },
      { label: 'Ranking candidates', desc: 'Hybrid RRF (Jaccard + vector)' },
      { label: 'Selecting best match', desc: 'LLM selection · temperature 0' },
    ];

    // Animate trace steps while waiting for the real API call
    const t0 = Date.now();
    const apiPromise = window.api.runQuery(q);

    for (let i = 0; i < traceSteps.length; i++) {
      await new Promise(r => setTimeout(r, 300));
      setTrace(t => [...t, traceSteps[i]]);
    }

    try {
      const res = await apiPromise;
      const elapsed = Date.now() - t0;
      setTiming(elapsed);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    }
    setState('done');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Query Console</h1>
          <p className="page-sub">Test how Curtain decides. Type a customer situation; watch the engine pick a skill, score it, and explain itself.</p>
        </div>
      </div>

      <div className="console" style={{ marginBottom: 18 }}>
        <div className="console-head">
          <div className="lights"><span/><span/><span/></div>
          <span style={{ marginLeft: 8 }}>curtain · query console</span>
          <span style={{ marginLeft: 'auto' }}>POST /api/v1/query · temp 0</span>
        </div>
        <div className="console-body" style={{ display: 'flex', alignItems: 'flex-start' }}>
          <span className="console-prompt">›</span>
          <textarea ref={ref} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
            placeholder="Describe the customer situation in plain English…" rows={3} />
        </div>
        <div className="console-foot">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ marginRight: 4 }}>Try:</span>
            {sampleQueries.map((s, i) => (
              <button key={i} className="sample" onClick={() => run(s)} title={s}>
                {s.split(' ').slice(0, 4).join(' ')}…
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>⌘ + Enter</span>
            <button className="btn accent sm" onClick={() => run()} disabled={state === 'running' || !input.trim()}>
              {state === 'running' ? 'Running…' : <>Run query <Icon name="enter" size={12} /></>}
            </button>
          </div>
        </div>
      </div>

      {state === 'idle' && (
        <div className="card">
          <div className="card-body" style={{ padding: 28 }}>
            <div className="grid-3col">
              {[
                { h: '1. Match', t: 'Hybrid search (keyword + vector) narrows active skills to top candidates.' },
                { h: '2. Decide', t: 'A reasoning model picks the best skill and copies its decision verbatim.' },
                { h: '3. Trace', t: 'Every candidate, score, and choice is persisted as JSONB on the query row.' },
              ].map((s, i) => (
                <div key={i} style={{ padding: 18, border: '1px solid var(--line)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 8 }}>{s.h}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{s.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {state !== 'idle' && (
        <div className="result" style={{ gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Decision card */}
            <div className="decision-card" style={{ opacity: state === 'running' && !result ? 0.5 : 1, transition: 'opacity 200ms' }}>
              <div className="decision-label">
                <span>Decision</span>
                {result?.escalate && <span className="badge escalate"><span className="dot"></span>Escalates to human</span>}
                {result?.skill_id && openSkill && (
                  <button className="badge accent" style={{ cursor: 'pointer', border: 'none', background: 'var(--accent-soft)' }}
                    onClick={() => openSkill(result.skill_id)}>
                    View skill <Icon name="arrow" size={10} />
                  </button>
                )}
              </div>
              <div className="decision-text">
                {result?.error
                  ? <span style={{ color: 'var(--danger)' }}>Error: {result.error}</span>
                  : result?.decision || (
                    <>
                      <div className="skel" style={{ height: 18, width: '90%', marginBottom: 8 }}></div>
                      <div className="skel" style={{ height: 18, width: '70%' }}></div>
                    </>
                  )}
              </div>
              {(result || state === 'running') && (
                <div className="decision-meta">
                  <span>{result ? (result.escalate ? 'escalated · no match' : 'skill matched') : 'Pipeline running…'}</span>
                  {timing && <><span>·</span><span className="mono">{timing}ms</span></>}
                  {result && !result.error && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button className="btn sm" disabled><Icon name="check" size={12} /> Looks right</button>
                      {result.query_id && (
                        <button className="btn sm" onClick={() => setShowOverride(true)}>
                          <Icon name="flag" size={12} /> Override
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Trace */}
            <div className="card">
              <div className="card-head">
                <div className="card-title">Decision trace</div>
                <span className="card-sub mono">queries.output</span>
              </div>
              <div className="trace">
                {trace.map((t, i) => (
                  <div key={i} className="trace-row">
                    <div className="trace-step"><Icon name="check" size={11} stroke={2.5} /></div>
                    <div>
                      <div className="trace-name">{t.label}</div>
                      <div className="trace-desc">{t.desc}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{60 + i * 70}ms</div>
                  </div>
                ))}
                {state === 'running' && trace.length < 4 && (
                  <div className="trace-row">
                    <div className="trace-step" style={{ background: 'var(--accent-soft)', borderColor: 'oklch(0.85 0.08 280)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: 4, background: 'var(--accent)', animation: 'skel 0.8s linear infinite', display: 'block' }}></span>
                    </div>
                    <div>
                      <div className="trace-name skel" style={{ height: 14, width: 200, display: 'inline-block' }}></div>
                    </div>
                    <div></div>
                  </div>
                )}
              </div>
            </div>

            {/* Matched skill info */}
            {result && result.skill_id && (
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Matched skill</div>
                  <span className="badge active"><span className="dot"></span>Selected</span>
                </div>
                <div className="trace">
                  <div className="trace-row match">
                    <div className="trace-step"><Icon name="check" size={11} stroke={2.5} /></div>
                    <div>
                      <div className="trace-name" style={{ cursor: 'pointer' }} onClick={() => openSkill && openSkill(result.skill_id)}>
                        View matched skill <Icon name="arrow" size={11} />
                      </div>
                      <div className="trace-desc mono">{result.skill_id}</div>
                    </div>
                    <Confidence value={result.confidence} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="ring-wrap">
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500 }}>Confidence</div>
              <Ring value={result?.confidence ?? null} />
              <div className="ring-cap">
                {result == null ? 'awaiting result'
                  : result.confidence >= 0.85 ? 'high — auto-resolve'
                  : result.confidence >= 0.7 ? 'medium — agent assist'
                  : result.confidence > 0 ? 'low — needs review'
                  : 'no match · escalated'}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><div className="card-title">Input</div></div>
              <div className="card-body" style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {input || <span style={{ color: 'var(--ink-4)' }}>—</span>}
              </div>
            </div>

            {result && result.query_id && (
              <div className="card">
                <div className="card-head"><div className="card-title">Query ID</div></div>
                <div className="card-body">
                  <div className="id-tag" style={{ fontSize: 11.5, display: 'block', wordBreak: 'break-all' }}>{result.query_id}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
                    confidence: <span className="mono">{result.confidence != null ? `${Math.round(result.confidence * 100)}%` : '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showOverride && result?.query_id && (
        <OverrideModal queryId={result.query_id} onClose={() => setShowOverride(false)}
          onSubmitted={() => {}} goto={goto} />
      )}
    </div>
  );
};

// ─── Activity / Logs ──────────────────────────────────────────────────────────
const ActivityPage = ({ initialId, openSkill, goto }) => {
  const [queries, setQueries] = React.useState([]);
  const [skills, setSkills] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState(initialId || null);
  const [scope, setScope] = React.useState('all');
  const [showOverride, setShowOverride] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const PAGE_SIZE = 30;

  const load = React.useCallback(async (pg = 1) => {
    setLoading(true);
    setErr(null);
    try {
      const [qRes, sk] = await Promise.all([
        window.api.listQueries({ limit: PAGE_SIZE, page: pg }),
        window.api.listSkills({ limit: 100 }),
      ]);
      const rows = qRes.data || [];
      setQueries(rows);
      setTotal(qRes.total || 0);
      setSkills(sk);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(page); }, [load, page]);

  const filtered = queries.filter(q =>
    scope === 'all' ||
    (scope === 'escalated' && q.escalated) ||
    (scope === 'low' && q.confidence != null && q.confidence < 0.85 && q.matched_skill_id)
  );

  const sel = queries.find(q => q.id === selectedId) || filtered[0] || null;
  const selSkill = sel ? skills.find(s => s.id === sel.matched_skill_id) : null;
  const selOutput = sel?.output || {};
  const candidates = selOutput.pipeline?.candidates_evaluated || selOutput.candidates_evaluated || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Activity</h1>
          <p className="page-sub">Every query, every decision, every override. Click a row to see the full trace.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => load(page)}><Icon name="refresh" size={13} /> Refresh</button>
        </div>
      </div>

      {err && <ErrorAlert message={err} onRetry={() => load(page)} />}

      <div className="chip-group" style={{ marginBottom: 14, width: 'fit-content' }}>
        {[
          ['all', 'All', queries.length],
          ['escalated', 'Escalated', queries.filter(q => q.escalated).length],
          ['low', 'Low confidence', queries.filter(q => q.confidence != null && q.confidence < 0.85 && q.matched_skill_id).length],
        ].map(([k, v, n]) => (
          <button key={k} className={`chip ${scope === k ? 'active' : ''}`} onClick={() => setScope(k)}>
            {v} <span className="mono" style={{ fontSize: 10.5, marginLeft: 4, color: 'var(--ink-4)' }}>{n}</span>
          </button>
        ))}
      </div>

      <div className="logs-pair">
        <div className="logs-list">
          {loading && [1,2,3,4,5,6].map(i => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)' }}>
              <div className="skel" style={{ height: 14, width: '80%', marginBottom: 6 }}></div>
              <div className="skel" style={{ height: 11, width: '40%' }}></div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty">No queries{scope !== 'all' ? ' match this filter' : ' yet'}.</div>
          )}
          {!loading && filtered.map(q => {
            const sk = skills.find(s => s.id === q.matched_skill_id);
            return (
              <div key={q.id} className={`log-row ${selectedId === q.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(q.id)}>
                <div className="log-input truncate">{q.input}</div>
                <div className="log-meta">{q.id.slice(0, 8)}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)' }}>
                  {sk
                    ? <span style={{ color: 'var(--ink-3)' }}>{sk.name}</span>
                    : <span className="badge escalate" style={{ fontSize: 10.5 }}><span className="dot"></span>Escalated</span>}
                </div>
                <div style={{ justifySelf: 'end' }}><Confidence value={q.confidence} width={42} showNum={false} /></div>
              </div>
            );
          })}
          {!loading && total > PAGE_SIZE && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: '28px' }}>{page} / {Math.ceil(total / PAGE_SIZE)}</span>
              <button className="btn sm" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        <div className="log-detail">
          {!sel
            ? <div className="empty">{loading ? 'Loading…' : 'Select a query to see its trace.'}</div>
            : (
              <>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="id-tag">{sel.id}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{fmtRelative(sel.created_at)}</span>
                    {sel.escalated && <span className="badge escalate"><span className="dot"></span>Escalated</span>}
                  </div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 6 }}>Input</div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, padding: 14, background: 'var(--bg-subtle)', border: '1px solid var(--line)', borderRadius: 8 }}>{sel.input}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 6 }}>Decision</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                    <Ring value={sel.confidence} size={68} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 8 }}>
                        {selOutput.decision || '—'}
                      </div>
                      {selSkill && (
                        <button className="btn sm" onClick={() => openSkill && openSkill(selSkill.id)}>
                          {selSkill.name} <Icon name="arrow" size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 8 }}>Pipeline</div>
                  <div className="trace">
                    <div className="trace-row">
                      <div className="trace-step"><Icon name="check" size={11} stroke={2.5} /></div>
                      <div>
                        <div className="trace-name">Search method</div>
                        <div className="trace-desc mono">{sel.search_method || selOutput.pipeline?.method || '—'}</div>
                      </div>
                      <div></div>
                    </div>
                    {candidates.length === 0 && (
                      <div className="trace-row">
                        <div className="trace-step">—</div>
                        <div>
                          <div className="trace-name">No candidates</div>
                          <div className="trace-desc">Nothing scored high enough to match.</div>
                        </div>
                        <div></div>
                      </div>
                    )}
                    {candidates.map(c => {
                      const isMatch = sel.matched_skill_id === c.skill_id;
                      return (
                        <div key={c.skill_id} className={`trace-row ${isMatch ? 'match' : ''}`}>
                          <div className="trace-step">{isMatch ? <Icon name="check" size={11} stroke={2.5} /> : ''}</div>
                          <div>
                            <div className="trace-name">{c.name}</div>
                            <div className="trace-desc mono">keyword_score = {c.keyword_score}</div>
                          </div>
                          <div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button className="btn" onClick={() => setShowOverride(true)}>
                    <Icon name="flag" size={13} /> Override decision
                  </button>
                  <button className="btn ghost" style={{ marginLeft: 'auto' }}
                    onClick={() => alert(JSON.stringify(sel.output, null, 2))}>
                    View raw JSON
                  </button>
                </div>
              </>
            )}
        </div>
      </div>

      {showOverride && sel && (
        <OverrideModal queryId={sel.id} onClose={() => setShowOverride(false)}
          onSubmitted={() => {}} goto={goto} />
      )}
    </div>
  );
};

// ─── Settings ─────────────────────────────────────────────────────────────────
const SettingsPage = ({ workspace, onWorkspaceUpdated }) => {
  const [wsCopy, setWsCopy] = React.useState(null);
  const [apiKeys, setApiKeys] = React.useState([]);
  const [loadingKeys, setLoadingKeys] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [createdKey, setCreatedKey] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [success, setSuccess] = React.useState(null);

  React.useEffect(() => {
    if (workspace) setWsCopy({ ...workspace, settings: { ...workspace.settings } });
  }, [workspace]);

  const loadKeys = React.useCallback(async () => {
    setLoadingKeys(true);
    try {
      const keys = await window.api.listApiKeys();
      setApiKeys(keys);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  React.useEffect(() => { loadKeys(); }, [loadKeys]);

  const saveWorkspace = async () => {
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      const updated = await window.api.updateWorkspace({
        name: wsCopy.name,
        settings: wsCopy.settings,
      });
      onWorkspaceUpdated(updated);
      setSuccess('Workspace settings saved.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await window.api.createApiKey(newKeyName.trim());
      setCreatedKey(result);
      setNewKeyName('');
      await loadKeys();
    } catch (e) {
      setErr(e.message);
    }
  };

  const revokeKey = async (keyId) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await window.api.revokeApiKey(keyId);
      await loadKeys();
    } catch (e) {
      setErr(e.message);
    }
  };

  const setSetting = (k, v) => setWsCopy(w => ({ ...w, settings: { ...w.settings, [k]: v } }));

  if (!wsCopy) return <div className="page"><div className="empty">Loading workspace…</div></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Workspace configuration, model parameters, and API access.</p>
        </div>
      </div>

      {err && <ErrorAlert message={err} />}
      {success && <div className="alert success" style={{ marginBottom: 16 }}><Icon name="check2" size={14} />{success}</div>}

      {/* Workspace info */}
      <div className="card settings-section" style={{ marginBottom: 24 }}>
        <div className="card-head"><div className="card-title">Workspace</div></div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Name</div>
            <div className="settings-row-sub">Display name for this workspace</div>
          </div>
          <input className="settings-input" style={{ width: 200 }}
            value={wsCopy.name} onChange={e => setWsCopy(w => ({ ...w, name: e.target.value }))} />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Workspace ID</div>
            <div className="settings-row-sub">Use in API calls and scripts</div>
          </div>
          <span className="id-tag">{workspace.id}</span>
        </div>
      </div>

      {/* Model settings */}
      <div className="card settings-section" style={{ marginBottom: 24 }}>
        <div className="card-head"><div className="card-title">Query engine</div></div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Top-K candidates</div>
            <div className="settings-row-sub">Skills sent to the LLM for selection (default: 3)</div>
          </div>
          <input type="number" className="settings-input" min={1} max={20}
            value={wsCopy.settings.top_k}
            onChange={e => setSetting('top_k', Number(e.target.value))} />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Hybrid alpha</div>
            <div className="settings-row-sub">Vector weight in RRF fusion: 0 = keyword only, 1 = vector only (default: 0.5)</div>
          </div>
          <input type="number" className="settings-input" min={0} max={1} step={0.05}
            value={wsCopy.settings.hybrid_alpha}
            onChange={e => setSetting('hybrid_alpha', Number(e.target.value))} />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Duplicate threshold</div>
            <div className="settings-row-sub">Jaccard/cosine score above which new skills are flagged as duplicates (default: 0.75)</div>
          </div>
          <input type="number" className="settings-input" min={0} max={1} step={0.05}
            value={wsCopy.settings.duplicate_threshold}
            onChange={e => setSetting('duplicate_threshold', Number(e.target.value))} />
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={saveWorkspace} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="card settings-section" style={{ marginBottom: 24 }}>
        <div className="card-head">
          <div className="card-title">API keys</div>
          <span className="card-sub">Bearer auth · prefix cai_…</span>
        </div>

        {createdKey && (
          <div className="alert success" style={{ margin: '14px 18px' }}>
            <Icon name="key" size={14} />
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Key created — copy it now, it won't be shown again</div>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all', background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 4 }}>
                {createdKey.raw_key || createdKey.key || '(raw key not returned — check logs)'}
              </code>
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setCreatedKey(null)}>Dismiss</button>
            </div>
          </div>
        )}

        <table className="table">
          <thead>
            <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {loadingKeys && <SkeletonRow cols={6} />}
            {!loadingKeys && apiKeys.length === 0 && (
              <tr><td colSpan="6" className="empty">No API keys. Create one below.</td></tr>
            )}
            {!loadingKeys && apiKeys.map(k => (
              <tr key={k.id} style={{ cursor: 'default' }}>
                <td style={{ fontWeight: 500 }}>{k.name}</td>
                <td><span className="id-tag">{k.key_prefix}…</span></td>
                <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fmtDate(k.created_at)}</td>
                <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{k.last_used_at ? fmtRelative(k.last_used_at) : '—'}</td>
                <td>
                  {k.revoked_at
                    ? <span className="badge disabled">Revoked</span>
                    : <span className="badge active"><span className="dot"></span>Active</span>}
                </td>
                <td>
                  {!k.revoked_at && (
                    <button className="btn sm danger" onClick={() => revokeKey(k.id)}>
                      <Icon name="trash" size={11} /> Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '14px 18px', display: 'flex', gap: 8, borderTop: '1px solid var(--line-2)' }}>
          <input className="filter-input" style={{ maxWidth: 240 }} placeholder="Key name (e.g. Production)"
            value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createKey(); }} />
          <button className="btn primary" onClick={createKey} disabled={!newKeyName.trim()}>
            <Icon name="plus" size={13} /> Create key
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'oklch(0.85 0.06 25)' }}>
        <div className="card-head"><div className="card-title" style={{ color: 'var(--danger)' }}>Disconnect</div></div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Sign out of this workspace</div>
            <div className="settings-row-sub">Clears your API key from local storage. The workspace data is preserved.</div>
          </div>
          <button className="btn danger" onClick={() => {
            if (confirm('Disconnect from this workspace? You will need your API key to reconnect.')) {
              window.api.clearConfig();
              window.location.reload();
            }
          }}>
            <Icon name="logout" size={13} /> Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { QueryConsole, ActivityPage, SettingsPage, OverrideModal });
