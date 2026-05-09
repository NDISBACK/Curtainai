// Curtain — ExtractionStudio, AnalyticsPage

// ─── Extraction Studio ────────────────────────────────────────────────────────

const ExtractionStudio = ({ goto }) => {
  const [text, setText] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | extracting | done
  const [extracted, setExtracted] = React.useState([]);
  const [selected, setSelected] = React.useState(new Set());
  const [editing, setEditing] = React.useState({});
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);

  const extract = async () => {
    if (!text.trim()) return;
    setState('extracting');
    setExtracted([]);
    setSelected(new Set());
    setEditing({});
    setImportResult(null);
    setErr(null);
    try {
      const res = await window.api.extractSkills(text.trim());
      const skills = (res.skills || []).map((sk, i) => ({ ...sk, _id: `ex-${Date.now()}-${i}` }));
      for (let i = 0; i < skills.length; i++) {
        await new Promise(r => setTimeout(r, 220));
        setExtracted(prev => [...prev, skills[i]]);
        setSelected(prev => new Set([...prev, skills[i]._id]));
      }
      setState('done');
    } catch (e) {
      setErr(e.message);
      setState('idle');
    }
  };

  const importSelected = async () => {
    const toImport = extracted.filter(sk => selected.has(sk._id)).map(sk => {
      const overrides = editing[sk._id] || {};
      const merged = { ...sk, ...overrides };
      const condArr = Array.isArray(merged.conditions) ? merged.conditions : [];
      return {
        name: merged.name,
        trigger_condition: merged.trigger_condition,
        decision: merged.decision,
        conditions: condArr.length ? Object.fromEntries(condArr.map((c, i) => [String(i), c])) : null,
        escalation_required: merged.escalation_required,
      };
    });
    if (!toImport.length) return;
    setImporting(true);
    setErr(null);
    try {
      const results = await Promise.allSettled(toImport.map(sk => window.api.createSkill(sk)));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      setImportResult({ succeeded, failed });
    } catch (e) {
      setErr(e.message);
    } finally {
      setImporting(false);
    }
  };

  const setEdit = (id, field, value) => {
    setEditing(e => ({ ...e, [id]: { ...(e[id] || {}), [field]: value } }));
  };

  const getField = (sk, field) => (editing[sk._id] || {})[field] ?? sk[field];

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setText(ev.target?.result || '');
    reader.readAsText(file);
  };

  const selectedCount = selected.size;
  const canExtract = text.trim().length > 10;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Extraction Studio</h1>
          <p className="page-sub">Paste a support conversation — Curtain extracts reusable skills in seconds. Edit inline, then import what you want.</p>
        </div>
        {state === 'done' && (
          <button className="btn" onClick={() => { setState('idle'); setExtracted([]); setText(''); setImportResult(null); }}>
            <Icon name="plus" size={13} /> New extraction
          </button>
        )}
      </div>

      {err && <ErrorAlert message={err} onRetry={() => setErr(null)} />}

      {importResult && (
        <div className="alert success" style={{ marginBottom: 18 }}>
          <Icon name="check2" size={14} />
          <div>
            <strong>{importResult.succeeded} skill{importResult.succeeded !== 1 ? 's' : ''} added to Pending Review</strong>
            {importResult.failed > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--danger)' }}>· {importResult.failed} failed</span>
            )}
            <button className="btn sm" style={{ marginLeft: 12 }} onClick={() => goto('skills')}>
              Review now <Icon name="arrow" size={11} />
            </button>
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'extracting') && (
        <div className="console" style={{ marginBottom: 18 }}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}>
          <div className="console-head">
            <div className="lights"><span/><span/><span/></div>
            <span style={{ marginLeft: 8 }}>curtain · extraction studio</span>
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>POST /api/v1/extract</span>
          </div>
          <div className="console-body" style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span className="console-prompt">›</span>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={dragging
                ? 'Drop your .txt or .md file here…'
                : 'Paste a customer support conversation here…\n\nAgent: Thanks for reaching out!\nCustomer: I was charged twice for my subscription.\nAgent: I can see the duplicate — issuing a refund now.'}
              rows={10}
              disabled={state === 'extracting'}
              style={{ opacity: dragging ? 0.5 : 1 }}
            />
          </div>
          <div className="console-foot">
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              {text.length > 0 ? `${text.length.toLocaleString()} chars` : 'Drop a .txt or .md file · Zendesk, Intercom, Freshdesk exports work great'}
            </div>
            <button className="btn accent sm" onClick={extract} disabled={!canExtract || state === 'extracting'}>
              {state === 'extracting'
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span> Extracting…</>
                : <>Extract skills <Icon name="sparkle" size={12} /></>}
            </button>
          </div>
        </div>
      )}

      {state === 'extracting' && extracted.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 12 }}>Analyzing conversation patterns…</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)',
                  animation: `skel 0.8s ${i * 0.2}s ease-in-out infinite alternate` }}></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {extracted.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, fontSize: 14, color: 'var(--ink-2)' }}>
              <strong>{extracted.length} skill{extracted.length !== 1 ? 's' : ''} found</strong>
              <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>· {selectedCount} selected for import</span>
            </div>
            <button className="btn sm" onClick={() => setSelected(new Set(extracted.map(s => s._id)))}>Select all</button>
            <button className="btn sm" onClick={() => setSelected(new Set())}>None</button>
            <button className="btn primary"
              onClick={importSelected}
              disabled={importing || selectedCount === 0}>
              {importing ? 'Importing…' : `Import ${selectedCount} skill${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {extracted.map((sk, idx) => {
              const isSelected = selected.has(sk._id);
              const condArr = Array.isArray(getField(sk, 'conditions')) ? getField(sk, 'conditions') : [];
              const conf = sk.confidence;
              return (
                <div key={sk._id} className="card"
                  style={{
                    borderColor: isSelected ? 'var(--accent)' : 'var(--line)',
                    borderWidth: isSelected ? 2 : 1,
                    transition: 'border-color 150ms, border-width 150ms',
                    animation: `fadeInUp 280ms ${idx * 60}ms both`,
                  }}>
                  <div className="card-head" style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSelect(sk._id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(sk._id)}
                        onClick={e => e.stopPropagation()} style={{ width: 'auto', flexShrink: 0 }} />
                      <input
                        value={getField(sk, 'name')}
                        onChange={e => setEdit(sk._id, 'name', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ fontWeight: 600, fontSize: 14, border: 'none', background: 'transparent',
                          outline: 'none', flex: 1, padding: 0, color: 'var(--ink)', minWidth: 0 }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {sk.escalation_required && (
                        <span className="badge escalate"><span className="dot"></span>Escalates</span>
                      )}
                      <Ring value={conf} size={40} />
                    </div>
                  </div>
                  <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Trigger condition</label>
                      <textarea
                        value={getField(sk, 'trigger_condition')}
                        onChange={e => setEdit(sk._id, 'trigger_condition', e.target.value)}
                        rows={3} style={{ fontSize: 13 }}
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Decision</label>
                      <textarea
                        value={getField(sk, 'decision')}
                        onChange={e => setEdit(sk._id, 'decision', e.target.value)}
                        rows={3} style={{ fontSize: 13 }}
                      />
                    </div>
                    {condArr.length > 0 && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 6 }}>Conditions</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {condArr.map((c, ci) => (
                            <span key={ci} className="badge mono" style={{ fontSize: 11 }}>{String(c)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {state === 'done' && extracted.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 6 }}>No skill patterns found in this conversation.</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Try a longer exchange with a clear problem and resolution.</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Analytics Page ───────────────────────────────────────────────────────────

const AnalyticsPage = ({ goto }) => {
  const [analytics, setAnalytics] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [range, setRange] = React.useState(30);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
      const an = await window.api.getWorkspaceAnalytics(from, to);
      setAnalytics(an);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => { load(); }, [load]);

  const daily = analytics?.daily_breakdown || [];
  const topSkills = analytics?.top_skills || [];
  const matchRate = analytics?.match_rate != null ? Math.round(analytics.match_rate * 100) : null;
  const escalRate = analytics?.escalation_rate != null ? Math.round(analytics.escalation_rate * 100) : null;
  const avgConf = analytics?.avg_confidence != null ? Math.round(analytics.avg_confidence * 100) : null;
  const totalQ = analytics?.total_queries ?? null;

  const AreaChart = ({ data, height = 130 }) => {
    if (!data || data.length === 0) return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
        No data for this period
      </div>
    );
    const maxVal = Math.max(...data.map(d => d.total || 0), 1);
    const pad = { t: 12, r: 12, b: 32, l: 32 };
    const vbW = 600, vbH = height;
    const W = vbW - pad.l - pad.r;
    const H = vbH - pad.t - pad.b;
    const xS = i => data.length < 2 ? W / 2 : (i / (data.length - 1)) * W;
    const yS = v => H - (v / maxVal) * H;

    const line = (key) => data.map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${pad.l + xS(i)},${pad.t + yS(d[key] || 0)}`
    ).join(' ');

    const area = (key) =>
      `${line(key)} L${pad.l + W},${pad.t + H} L${pad.l},${pad.t + H} Z`;

    const labelEvery = Math.max(1, Math.floor(data.length / 5));

    return (
      <svg width="100%" viewBox={`0 0 ${vbW} ${vbH}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="gMatch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={pad.t + t * H} x2={pad.l + W} y2={pad.t + t * H}
              stroke="var(--line-2)" strokeWidth="1" />
            <text x={pad.l - 5} y={pad.t + t * H + 4} textAnchor="end" fontSize="10" fill="var(--ink-4)">
              {Math.round(maxVal * (1 - t))}
            </text>
          </g>
        ))}
        <path d={area('total')} fill="url(#gTotal)" />
        <path d={area('matched')} fill="url(#gMatch)" />
        <path d={line('total')} fill="none" stroke="var(--accent)" strokeWidth="1.75"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d={line('matched')} fill="none" stroke="var(--success)" strokeWidth="1.75"
          strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          if (i % labelEvery !== 0 && i !== data.length - 1) return null;
          const lbl = new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <text key={i} x={pad.l + xS(i)} y={vbH - 8} textAnchor="middle" fontSize="10" fill="var(--ink-4)">
              {lbl}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">Your AI's performance over time — match rates, confidence trends, and top-performing skills.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="chip-group">
            {[[7,'7d'],[30,'30d'],[90,'90d']].map(([d,l]) => (
              <button key={d} className={`chip ${range === d ? 'active' : ''}`} onClick={() => setRange(d)}>{l}</button>
            ))}
          </div>
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /></button>
        </div>
      </div>

      {err && <ErrorAlert message={err} onRetry={load} />}

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        {[
          {
            label: 'Match rate',
            value: loading ? '…' : (matchRate != null ? `${matchRate}%` : '—'),
            sub: 'queries resolved by AI',
            color: matchRate != null ? (matchRate >= 70 ? 'var(--success)' : matchRate >= 50 ? 'var(--warning)' : 'var(--danger)') : undefined,
          },
          {
            label: 'Escalation rate',
            value: loading ? '…' : (escalRate != null ? `${escalRate}%` : '—'),
            sub: 'forwarded to humans',
            color: escalRate != null ? (escalRate <= 20 ? 'var(--success)' : escalRate <= 40 ? 'var(--warning)' : 'var(--danger)') : undefined,
          },
          {
            label: 'Avg confidence',
            value: loading ? '…' : (avgConf != null ? `${avgConf}%` : '—'),
            sub: 'on matched queries',
            color: avgConf != null ? (avgConf >= 85 ? 'var(--success)' : avgConf >= 70 ? 'var(--warning)' : 'var(--danger)') : undefined,
          },
          {
            label: 'Total queries',
            value: loading ? '…' : (totalQ != null ? fmt(totalQ) : '—'),
            sub: `last ${range} days`,
          },
        ].map((m, i) => (
          <div key={i} className="metric">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-meta"><span>{m.sub}</span></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Daily query volume</div>
              <div className="card-sub">Total vs matched per day</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-4)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 18, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }}></span>
                Total
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 18, height: 2, background: 'var(--success)', display: 'inline-block', borderRadius: 1 }}></span>
                Matched
              </span>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {loading
              ? <div className="skel" style={{ height: 130, borderRadius: 6 }}></div>
              : <AreaChart data={daily} height={130} />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Top skills</div>
            <div className="card-sub">By match volume · {range}d</div>
          </div>
          <div className="card-body" style={{ paddingTop: 6 }}>
            {loading ? (
              [1,2,3,4].map(i => (
                <div key={i} className="skel" style={{ height: 34, borderRadius: 6, marginBottom: 8 }}></div>
              ))
            ) : topSkills.length === 0 ? (
              <div className="empty">No skill usage data yet.</div>
            ) : (
              topSkills.slice(0, 7).map((sk, i) => {
                const maxCount = topSkills[0]?.match_count || 1;
                const pct = Math.round(((sk.match_count || 0) / maxCount) * 100);
                return (
                  <div key={sk.skill_id || i} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4, gap: 8 }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {sk.skill_name || sk.skill_id?.slice(0, 12) || 'Unknown'}
                      </span>
                      <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11, flexShrink: 0 }}>
                        {sk.match_count}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 700ms cubic-bezier(0.2,0.8,0.2,1)' }}></div>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 2 }}>
                      avg conf {Math.round((sk.avg_confidence || 0) * 100)}%
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {!loading && daily.length === 0 && !err && (
        <div className="card">
          <div className="card-body" style={{ padding: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 6 }}>No analytics data for this period.</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 16 }}>Run queries from the Query Console to start tracking performance.</div>
            <button className="btn primary" onClick={() => goto('test')}>
              Open Query Console <Icon name="arrow" size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { ExtractionStudio, AnalyticsPage });
