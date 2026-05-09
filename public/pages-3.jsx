// Curtain — ExtractionStudio, AnalyticsPage

// ─── Extraction Studio ────────────────────────────────────────────────────────

const ExtractionStudio = ({ goto }) => {
  const [text, setText]           = React.useState('');
  const [state, setState]         = React.useState('idle'); // idle | extracting | done
  const [extracted, setExtracted] = React.useState([]);
  const [selected, setSelected]   = React.useState(new Set());
  const [editing, setEditing]     = React.useState({});
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState(null);
  const [err, setErr]             = React.useState(null);
  const [dragging, setDragging]   = React.useState(false);
  const [deepMode, setDeepMode]   = React.useState(false);
  const [multiMode, setMultiMode] = React.useState(false);
  const [phase, setPhase]         = React.useState('');
  const [meta, setMeta]           = React.useState(null);
  const phaseTimerRef             = React.useRef(null);

  const DEEP_PHASES = [
    { label: 'Pass 1 — Broad scan, extracting all patterns…', duration: 5000 },
    { label: 'Pass 2 — Deep analysis, finding what was missed…', duration: 6000 },
    { label: 'Pass 3 — Merging, deduplicating, normalizing…', duration: 5000 },
  ];

  const startPhaseTimer = () => {
    let idx = 0;
    setPhase(DEEP_PHASES[0].label);
    const tick = () => {
      idx++;
      if (idx < DEEP_PHASES.length) {
        setPhase(DEEP_PHASES[idx].label);
        phaseTimerRef.current = setTimeout(tick, DEEP_PHASES[idx].duration);
      }
    };
    phaseTimerRef.current = setTimeout(tick, DEEP_PHASES[0].duration);
  };

  const stopPhaseTimer = () => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    setPhase('');
  };

  const extract = async () => {
    if (!text.trim()) return;
    setState('extracting');
    setExtracted([]);
    setSelected(new Set());
    setEditing({});
    setImportResult(null);
    setMeta(null);
    setErr(null);

    if (deepMode) startPhaseTimer();

    try {
      // Multi-mode: split on \n---\n and pass as conversations[]
      const conversations = multiMode
        ? text.split(/\n---+\n/).map(s => s.trim()).filter(s => s.length > 10)
        : null;
      const input = conversations || text.trim();

      const res = await window.api.extractSkills(input, {
        deep: deepMode,
        workspace_id: window.api._wsId || undefined,
      });

      stopPhaseTimer();
      if (res.meta) setMeta(res.meta);

      const skills = (res.skills || []).map((sk, i) => ({ ...sk, _id: `ex-${Date.now()}-${i}` }));
      for (let i = 0; i < skills.length; i++) {
        await new Promise(r => setTimeout(r, 120));
        setExtracted(prev => [...prev, skills[i]]);
        setSelected(prev => new Set([...prev, skills[i]._id]));
      }
      setState('done');
    } catch (e) {
      stopPhaseTimer();
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
          <p className="page-sub">Paste a support conversation — Curtain extracts every reusable skill, including implicit patterns. Enable Deep Scan for exhaustive multi-pass extraction.</p>
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
        <>
          {/* Mode toggle row */}
          <div style={{ display: 'flex', gap: 18, marginBottom: 10, alignItems: 'center' }}>
            <div className="chip-group">
              <button className={`chip ${!multiMode ? 'active' : ''}`} onClick={() => setMultiMode(false)}>Single conversation</button>
              <button className={`chip ${multiMode ? 'active' : ''}`} onClick={() => setMultiMode(true)}>
                Multiple conversations <span style={{ fontSize: 10, color: 'var(--ink-4)', marginLeft: 3 }}>(separate with ---)</span>
              </button>
            </div>
          </div>

          <div className="console" style={{ marginBottom: 18 }}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}>
            <div className="console-head">
              <div className="lights"><span/><span/><span/></div>
              <span style={{ marginLeft: 8 }}>curtain · extraction studio</span>
              <span style={{ marginLeft: 'auto', fontSize: 11 }}>POST /api/v1/extract{deepMode ? '?deep=true' : ''}</span>
            </div>
            <div className="console-body" style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span className="console-prompt">›</span>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={dragging
                  ? 'Drop your .txt or .md file here…'
                  : multiMode
                    ? 'Paste multiple conversations separated by ---\n\nAgent: Thanks for reaching out!\nCustomer: I was double charged.\nAgent: I can see the duplicate — issuing a refund now.\n\n---\n\nAgent: Hi! How can I help?\nCustomer: I need to cancel my account.\nAgent: I can help with that…'
                    : 'Paste a customer support conversation here…\n\nAgent: Thanks for reaching out!\nCustomer: I was charged twice for my subscription.\nAgent: I can see the duplicate — issuing a refund now.'}
                rows={10}
                disabled={state === 'extracting'}
                style={{ opacity: dragging ? 0.5 : 1 }}
              />
            </div>
            <div className="console-foot">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  {text.length > 0 ? `${text.length.toLocaleString()} chars` : 'Drop a .txt or .md file · Zendesk, Intercom, Freshdesk exports work great'}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                  color: deepMode ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={deepMode} onChange={e => setDeepMode(e.target.checked)}
                    disabled={state === 'extracting'} style={{ width: 'auto' }} />
                  <strong>Deep scan</strong>
                  <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(~15s · 3 passes)</span>
                </label>
              </div>
              <button className="btn accent sm" onClick={extract} disabled={!canExtract || state === 'extracting'}>
                {state === 'extracting'
                  ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span> Extracting…</>
                  : <>{deepMode ? '🔬' : ''} Extract skills <Icon name="sparkle" size={12} /></>}
              </button>
            </div>
          </div>
        </>
      )}

      {state === 'extracting' && extracted.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 6 }}>
              {deepMode && phase ? phase : 'Analyzing conversation patterns…'}
            </div>
            {deepMode && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                {DEEP_PHASES.map((p, i) => (
                  <div key={i} style={{
                    height: 3, borderRadius: 2, flex: 1, maxWidth: 80,
                    background: phase === p.label ? 'var(--accent)' : 'var(--line)',
                    transition: 'background 300ms',
                  }} />
                ))}
              </div>
            )}
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
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>{extracted.length} skill{extracted.length !== 1 ? 's' : ''} found</strong>
              <span style={{ color: 'var(--ink-4)', fontSize: 14 }}>· {selectedCount} selected</span>
              {meta?.passes_run > 1 && (
                <span className="badge" style={{ background: 'oklch(from var(--accent) l c h / 0.12)', color: 'var(--accent)', fontSize: 11 }}>
                  {meta.passes_run}-pass extraction
                </span>
              )}
              {meta?.quality_warning && (
                <span className="badge" style={{ background: 'oklch(from var(--warning) l c h / 0.12)', color: 'var(--warning)', fontSize: 11 }}>
                  ⚠ {meta.quality_warning}
                </span>
              )}
            </div>
            {(meta?.categories_detected || []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center' }}>Topics:</span>
                {meta.categories_detected.map(cat => (
                  <span key={cat} className="badge mono" style={{ fontSize: 11, textTransform: 'capitalize' }}>{cat}</span>
                ))}
              </div>
            )}
            {meta?.passes_run > 1 && (
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                Pass 1: <strong style={{ color: 'var(--ink-2)' }}>{meta.pass1_count}</strong>
                {' · '}Pass 2 new: <strong style={{ color: 'var(--ink-2)' }}>{meta.pass2_count}</strong>
                {' · '}After merge: <strong style={{ color: 'var(--accent)' }}>{meta.merged_count}</strong>
                {meta.segments_detected > 1 && <> · <strong>{meta.segments_detected} topics detected</strong></>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}></div>
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
                      {sk.existing_skill_match && (
                        <span className="badge" title={`Similar to "${sk.existing_skill_match.name}" (${Math.round(sk.existing_skill_match.similarity * 100)}% match)`}
                          style={{ background: 'oklch(from var(--warning) l c h / 0.12)', color: 'var(--warning)', fontSize: 10, cursor: 'help' }}>
                          ⚠ Similar exists
                        </span>
                      )}
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

// ─── Gaps Tab ────────────────────────────────────────────────────────────────

const GapsTab = ({ goto }) => {
  const [report, setReport]         = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [err, setErr]               = React.useState(null);
  const [dismissed, setDismissed]   = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('curtain_dismissed_gaps') || '[]'); }
    catch { return []; }
  });
  const [creating, setCreating]     = React.useState(null); // cluster being turned into a skill
  const [saving, setSaving]         = React.useState(false);
  const [saveOk, setSaveOk]         = React.useState(null);
  const [saveErr, setSaveErr]       = React.useState(null);
  const [editSkill, setEditSkill]   = React.useState({});

  React.useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try { setReport(await window.api.getGapAnalysis(200)); }
      catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('curtain_dismissed_gaps', JSON.stringify(next));
  };

  const openCreate = (cluster) => {
    setEditSkill({ ...cluster.suggested_skill });
    setCreating(cluster);
    setSaveOk(null); setSaveErr(null);
  };

  const saveSkill = async () => {
    if (!creating) return;
    setSaving(true); setSaveErr(null);
    try {
      await window.api.createSkill({
        name:               editSkill.name,
        trigger_condition:  editSkill.trigger_condition,
        decision:           editSkill.decision,
        conditions:         null,
        escalation_required: editSkill.escalation_required ?? false,
        confidence:         editSkill.confidence ?? null,
      });
      setSaveOk(true);
      dismiss(creating.id);
      setTimeout(() => { setCreating(null); setSaveOk(null); }, 1200);
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const visible = (report?.clusters || []).filter(c => !dismissed.includes(c.id));

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
      {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 140, borderRadius: 10 }}></div>)}
    </div>
  );

  if (err) return <ErrorAlert message={err} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Analyzed <strong>{report?.total_escalations_analyzed ?? 0}</strong> escalations
            {report?.ungrouped_count > 0 && (
              <span style={{ color: 'var(--ink-4)' }}> · {report.ungrouped_count} ungrouped outliers hidden</span>
            )}
          </div>
        </div>
        {dismissed.length > 0 && (
          <button className="btn sm" onClick={() => {
            setDismissed([]);
            localStorage.removeItem('curtain_dismissed_gaps');
          }}>Show dismissed ({dismissed.length})</button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ color: 'var(--ink-5)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <Icon name="chart" size={26} stroke={1.25} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
              No gaps detected
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              Your AI is handling everything — or not enough queries have been escalated yet.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visible.map((cluster, idx) => (
            <div key={cluster.id} className="card" style={{ animation: `fadeInUp 240ms ${idx * 50}ms both` }}>
              <div className="card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    background: 'var(--danger)', color: '#fff', borderRadius: 6,
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.03em',
                  }}>{cluster.size} queries</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cluster.suggested_skill.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => dismiss(cluster.id)}
                    style={{ color: 'var(--ink-4)' }}>Dismiss</button>
                  <button className="btn primary sm" onClick={() => openCreate(cluster)}>
                    <Icon name="plus" size={12} /> Create skill
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 8 }}>
                  Representative queries
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {cluster.representative_queries.map((q, qi) => (
                    <div key={qi} style={{
                      background: 'var(--surface-2)', borderRadius: 6, padding: '7px 11px',
                      fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic',
                    }}>"{q}"</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 4 }}>Suggested trigger</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{cluster.suggested_skill.trigger_condition}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 500, marginBottom: 4 }}>Suggested decision</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{cluster.suggested_skill.decision}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-4)' }}>
                  Last seen: {new Date(cluster.last_seen).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Skill Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Create skill from gap</h3>
              <button className="btn icon" onClick={() => setCreating(null)}><Icon name="x" size={15} /></button>
            </div>
            <div className="modal-body">
              {saveOk ? (
                <div className="alert success" style={{ margin: 0 }}>
                  <Icon name="check2" size={14} /> Skill added to Pending Review
                </div>
              ) : (
                <>
                  {saveErr && <ErrorAlert message={saveErr} onRetry={() => setSaveErr(null)} />}
                  <div className="field">
                    <label>Name</label>
                    <input value={editSkill.name || ''} onChange={e => setEditSkill(s => ({ ...s, name: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Trigger condition</label>
                    <textarea rows={3} value={editSkill.trigger_condition || ''} onChange={e => setEditSkill(s => ({ ...s, trigger_condition: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Decision</label>
                    <textarea rows={3} value={editSkill.decision || ''} onChange={e => setEditSkill(s => ({ ...s, decision: e.target.value }))} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editSkill.escalation_required}
                      onChange={e => setEditSkill(s => ({ ...s, escalation_required: e.target.checked }))}
                      style={{ width: 'auto' }} />
                    Requires escalation
                  </label>
                </>
              )}
            </div>
            {!saveOk && (
              <div className="modal-foot">
                <button className="btn" onClick={() => setCreating(null)}>Cancel</button>
                <button className="btn primary" onClick={saveSkill} disabled={saving}>
                  {saving ? 'Saving…' : 'Add to Pending Review'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Analytics Page ───────────────────────────────────────────────────────────

const AnalyticsPage = ({ goto }) => {
  const [tab, setTab]               = React.useState('overview');
  const [analytics, setAnalytics]   = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [err, setErr]               = React.useState(null);
  const [range, setRange]           = React.useState(30);

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
          {tab === 'overview' && (
            <>
              <div className="chip-group">
                {[[7,'7d'],[30,'30d'],[90,'90d']].map(([d,l]) => (
                  <button key={d} className={`chip ${range === d ? 'active' : ''}`} onClick={() => setRange(d)}>{l}</button>
                ))}
              </div>
              <button className="btn" onClick={load}><Icon name="refresh" size={13} /></button>
            </>
          )}
        </div>
      </div>

      <div className="chip-group" style={{ marginBottom: 20 }}>
        <button className={`chip ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`chip ${tab === 'gaps' ? 'active' : ''}`} onClick={() => setTab('gaps')}>
          Skills Gap Radar
          <span style={{
            marginLeft: 6, background: 'var(--danger)', color: '#fff',
            borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px',
          }}>new</span>
        </button>
      </div>

      {tab === 'gaps' && <GapsTab goto={goto} />}

      {tab === 'overview' && <>

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

      </>}
    </div>
  );
};

Object.assign(window, { ExtractionStudio, AnalyticsPage, GapsTab });
