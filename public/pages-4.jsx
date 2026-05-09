// Curtain — SimulationPage

// ─── Change type metadata ─────────────────────────────────────────────────────
const CHANGE_META = {
  auto_to_escalate: {
    label: 'Coverage loss',
    color: 'var(--danger)',
    bg: 'var(--danger-soft)',
    borderColor: 'oklch(0.85 0.06 25)',
    icon: 'arrowup',
    desc: 'Was auto-resolved — now escalates',
  },
  escalate_to_auto: {
    label: 'Coverage gain',
    color: 'var(--success)',
    bg: 'var(--success-soft)',
    borderColor: 'oklch(0.85 0.06 150)',
    icon: 'arrowdown',
    desc: 'Was escalating — now auto-resolved',
  },
  decision_changed: {
    label: 'Decision changed',
    color: 'var(--warning)',
    bg: 'var(--warning-soft)',
    borderColor: 'oklch(0.85 0.07 80)',
    icon: 'edit',
    desc: 'Same outcome, different decision text',
  },
  confidence_shift: {
    label: 'Confidence shift',
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
    borderColor: 'oklch(0.88 0.06 280)',
    icon: 'chart',
    desc: 'Significant confidence delta (>20pp)',
  },
};

// ─── Pick Active Skill Modal ──────────────────────────────────────────────────
const PickSkillModal = ({ activeSkills, disabledIds, onPick, onClose }) => {
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => { ref.current?.focus(); }, []);

  const filtered = activeSkills.filter(s =>
    !disabledIds.has(s.id) &&
    (q === '' ||
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      (s.trigger_condition || '').toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Choose a skill to modify</div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <input
            ref={ref}
            className="filter-input"
            style={{ width: '100%' }}
            placeholder="Filter by name or trigger condition…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div style={{ padding: '8px 8px', maxHeight: 340, overflowY: 'auto' }}>
          {activeSkills.length === 0 && (
            <div className="empty" style={{ padding: '24px 16px', textAlign: 'center' }}>No active skills found.</div>
          )}
          {filtered.length === 0 && activeSkills.length > 0 && (
            <div className="empty" style={{ padding: '24px 16px', textAlign: 'center' }}>No skills match "{q}"</div>
          )}
          {filtered.map(s => (
            <div key={s.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px', cursor: 'pointer', borderRadius: 7,
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onPick(s); onClose(); }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13.5, marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.trigger_condition}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 }}>
                <Confidence value={s.confidence} width={44} showNum={false} />
                <Icon name="arrow" size={12} style={{ color: 'var(--ink-4)' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{filtered.length} of {activeSkills.length} skills</span>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Sim Skill Editor Card ────────────────────────────────────────────────────
const SimSkillCard = ({ skill, idx, onChange, onRemove }) => {
  const isNew = skill.isNew;
  return (
    <div className="card" style={{
      animation: `fadeInUp 200ms ${idx * 50}ms both`,
      borderColor: isNew ? 'var(--accent)' : 'oklch(0.85 0.07 80)',
      boxShadow: isNew
        ? '0 0 0 1px oklch(0.85 0.06 280 / 0.4)'
        : '0 0 0 1px oklch(0.85 0.06 80 / 0.3)',
    }}>
      <div className="card-head" style={{ borderBottomColor: isNew ? 'oklch(0.9 0.04 280)' : 'oklch(0.9 0.04 80)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {isNew
            ? <span className="badge accent" style={{ flexShrink: 0 }}>New</span>
            : <span className="badge pending" style={{ flexShrink: 0 }}>Modified</span>}
          <input
            value={skill.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Skill name…"
            style={{
              flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5,
              border: 'none', background: 'transparent', outline: 'none',
              padding: 0, color: 'var(--ink)',
            }}
          />
        </div>
        <button className="btn ghost sm" onClick={onRemove} title="Remove from simulation">
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Trigger condition *</label>
          <textarea
            value={skill.trigger_condition}
            onChange={e => onChange('trigger_condition', e.target.value)}
            placeholder="Describe the customer situation that fires this skill."
            rows={3}
            style={{ fontSize: 13 }}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Decision *</label>
          <textarea
            value={skill.decision}
            onChange={e => onChange('decision', e.target.value)}
            placeholder="Exact text returned to the agent when this skill matches."
            rows={3}
            style={{ fontSize: 13 }}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Conditions <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>optional · one per line</span></label>
          <input
            value={skill.conditions}
            onChange={e => onChange('conditions', e.target.value)}
            placeholder="e.g. plan_type = annual"
            style={{ fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
          <input
            type="checkbox"
            id={`esc-${skill._uid}`}
            checked={skill.escalation_required}
            onChange={e => onChange('escalation_required', e.target.checked)}
            style={{ width: 'auto' }}
          />
          <label htmlFor={`esc-${skill._uid}`} style={{ fontSize: 13, cursor: 'pointer', margin: 0, color: 'var(--ink-2)' }}>
            Requires human escalation
          </label>
        </div>
      </div>
    </div>
  );
};

// ─── Example Row (before/after) ───────────────────────────────────────────────
const ExampleRow = ({ ex, isExpanded, onToggle }) => {
  const meta = ex.change_type ? CHANGE_META[ex.change_type] : null;

  return (
    <div style={{
      border: `1px solid ${isExpanded && meta ? meta.borderColor : 'var(--line)'}`,
      borderRadius: 8,
      overflow: 'hidden',
      transition: 'border-color 150ms, box-shadow 150ms',
      boxShadow: isExpanded ? 'var(--shadow-card)' : 'none',
      background: 'var(--bg-elev)',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 14px',
          cursor: 'pointer',
          background: isExpanded ? 'var(--bg-subtle)' : 'transparent',
          transition: 'background 100ms',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          color: 'var(--ink-4)',
        }}>
          <Icon name={isExpanded ? 'chevrondown' : 'chevron'} size={12} stroke={2.5} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ex.query}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {ex.query_id.slice(0, 8)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Mini before/after confidence diff */}
          {ex.changed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              <span>{ex.before.confidence != null ? `${Math.round(ex.before.confidence * 100)}%` : '—'}</span>
              <Icon name="arrow" size={10} />
              <span style={{ color: meta?.color }}>
                {ex.after.confidence != null ? `${Math.round(ex.after.confidence * 100)}%` : '—'}
              </span>
            </div>
          )}
          {meta
            ? (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 999,
                background: meta.bg, color: meta.color,
                border: `1px solid ${meta.borderColor}`,
              }}>
                {meta.label}
              </span>
            )
            : (
              <span style={{ fontSize: 11.5, color: 'var(--ink-5)', fontWeight: 500 }}>Unchanged</span>
            )}
        </div>
      </div>

      {/* Expanded before / after panel */}
      {isExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${meta ? meta.borderColor : 'var(--line)'}`,
        }}>
          {/* Before */}
          <div style={{ padding: '16px 18px', borderRight: `1px solid ${meta ? meta.borderColor : 'var(--line)'}` }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em',
              color: 'var(--ink-4)', fontWeight: 600, marginBottom: 10,
            }}>
              Before
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {ex.before.escalate
                ? <span className="badge escalate"><span className="dot"></span>Escalated</span>
                : <span className="badge active"><span className="dot"></span>Auto-resolved</span>}
              <Confidence value={ex.before.confidence} width={54} />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              {ex.before.decision}
            </div>
          </div>

          {/* After */}
          <div style={{
            padding: '16px 18px',
            background: meta ? meta.bg : 'var(--bg-subtle)',
          }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em',
              color: meta ? meta.color : 'var(--ink-4)', fontWeight: 600, marginBottom: 10,
            }}>
              After — {meta ? meta.desc : 'No change'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {ex.after.escalate
                ? <span className="badge escalate"><span className="dot"></span>Escalated</span>
                : <span className="badge active"><span className="dot"></span>Auto-resolved</span>}
              <Confidence value={ex.after.confidence} width={54} />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              {ex.after.decision}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Simulation Page ──────────────────────────────────────────────────────────
const SimulationPage = () => {
  const [phase, setPhase] = React.useState('setup');       // 'setup' | 'running' | 'results'
  const [simSkills, setSimSkills] = React.useState([]);
  const [sampleSize, setSampleSize] = React.useState(100);
  const [result, setResult] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [activeSkills, setActiveSkills] = React.useState([]);
  const [loadingActive, setLoadingActive] = React.useState(true);
  const [runSteps, setRunSteps] = React.useState([]);
  const [exFilter, setExFilter] = React.useState('all');
  const [expanded, setExpanded] = React.useState(new Set());
  const [showPickModal, setShowPickModal] = React.useState(false);

  // Load active skills for reference pane
  React.useEffect(() => {
    window.api.listSkills({ limit: 200 })
      .then(sk => setActiveSkills(sk.filter(s => s.status === 'active')))
      .catch(() => {})
      .finally(() => setLoadingActive(false));
  }, []);

  // IDs already loaded into simulation
  const loadedIds = React.useMemo(
    () => new Set(simSkills.filter(s => s.id).map(s => s.id)),
    [simSkills]
  );

  const addFromActive = (skill) => {
    if (loadedIds.has(skill.id)) return;
    const condStr = skill.conditions
      ? (Array.isArray(skill.conditions)
          ? skill.conditions
          : Object.values(skill.conditions)
        ).join('\n')
      : '';
    setSimSkills(prev => [...prev, {
      _uid: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      id: skill.id,
      name: skill.name || '',
      trigger_condition: skill.trigger_condition || '',
      decision: skill.decision || '',
      conditions: condStr,
      escalation_required: skill.escalation_required || false,
      confidence: skill.confidence,
      isModified: true,
    }]);
  };

  const addNew = () => {
    setSimSkills(prev => [...prev, {
      _uid: `sim-new-${Date.now()}`,
      name: '',
      trigger_condition: '',
      decision: '',
      conditions: '',
      escalation_required: false,
      confidence: null,
      isNew: true,
    }]);
  };

  const updateSkill = (uid, field, value) => {
    setSimSkills(prev => prev.map(s => s._uid === uid ? { ...s, [field]: value } : s));
  };

  const removeSkill = (uid) => {
    setSimSkills(prev => prev.filter(s => s._uid !== uid));
  };

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runSim = async () => {
    if (!simSkills.length) { setErr('Add at least one skill to simulate.'); return; }
    const bad = simSkills.find(s => !s.name.trim() || !s.trigger_condition.trim() || !s.decision.trim());
    if (bad) { setErr('Every skill needs a name, trigger condition, and decision.'); return; }

    setPhase('running');
    setErr(null);
    setRunSteps([]);

    const steps = [
      { label: 'Loading historical queries', desc: `Sampling ${sampleSize} most recent queries from your workspace` },
      { label: 'Embedding simulation skills', desc: 'Generating vectors for modified and new skills' },
      { label: 'Running decision pipeline', desc: `Testing each query through simulated skill set in parallel batches` },
      { label: 'Aggregating impact report', desc: 'Classifying change types and computing coverage deltas' },
    ];

    const payload = {
      simulation_skills: simSkills.map(s => {
        const condArr = s.conditions
          ? s.conditions.split('\n').map(c => c.trim()).filter(Boolean)
          : [];
        return {
          ...(s.id ? { id: s.id } : {}),
          name: s.name.trim(),
          trigger_condition: s.trigger_condition.trim(),
          decision: s.decision.trim(),
          conditions: condArr.length ? Object.fromEntries(condArr.map((c, i) => [String(i), c])) : null,
          escalation_required: s.escalation_required,
          confidence: s.confidence,
        };
      }),
      sample_size: sampleSize,
    };

    const apiCall = window.api.runSimulation(payload);

    // Animate steps while real call is running
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      setRunSteps(prev => [...prev, steps[i]]);
    }

    try {
      const res = await apiCall;
      setResult(res);
      setExpanded(new Set());
      setExFilter('all');
      setPhase('results');
    } catch (e) {
      setErr(e.message || 'Simulation failed.');
      setPhase('setup');
    }
  };

  const reset = () => {
    setPhase('setup');
    setErr(null);
  };

  // Filtered examples for results view
  const filteredExamples = React.useMemo(() => {
    if (!result?.examples) return [];
    const exs = result.examples;
    if (exFilter === 'changed') return exs.filter(e => e.changed);
    if (exFilter === 'loss') return exs.filter(e => e.change_type === 'auto_to_escalate');
    if (exFilter === 'gain') return exs.filter(e => e.change_type === 'escalate_to_auto');
    if (exFilter === 'unchanged') return exs.filter(e => !e.changed);
    return exs;
  }, [result, exFilter]);

  // ── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const canRun = simSkills.length > 0;
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Simulation Lab</h1>
            <p className="page-sub">Test skill changes against real historical traffic before deploying. Read-only — no data is written, no skills are modified.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {result && (
              <button className="btn" onClick={() => setPhase('results')}>
                <Icon name="chart" size={13} /> Last results
              </button>
            )}
          </div>
        </div>

        {err && <ErrorAlert message={err} onRetry={() => setErr(null)} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Left — skill editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Skills to simulate</div>
                  <div className="card-sub">These replace or supplement your active skill set during the run</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => setShowPickModal(true)} disabled={loadingActive}>
                    <Icon name="edit" size={12} /> Modify active
                  </button>
                  <button className="btn sm primary" onClick={addNew}>
                    <Icon name="plus" size={12} /> New skill
                  </button>
                </div>
              </div>

              {simSkills.length === 0 ? (
                <div className="card-body">
                  <div style={{
                    border: '1.5px dashed var(--line)',
                    borderRadius: 10,
                    padding: '36px 24px',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, margin: '0 auto 14px',
                      background: 'var(--bg-subtle)', border: '1px solid var(--line)',
                      display: 'grid', placeItems: 'center', color: 'var(--ink-4)',
                    }}>
                      <Icon name="simulate" size={20} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                      No skills added
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 20, maxWidth: '36ch', margin: '0 auto 20px' }}>
                      Pick an existing active skill to modify, or create a brand new one to test what would happen.
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button className="btn" onClick={() => setShowPickModal(true)} disabled={loadingActive}>
                        <Icon name="edit" size={13} /> Modify active skill
                      </button>
                      <button className="btn primary" onClick={addNew}>
                        <Icon name="plus" size={13} /> New skill
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-body" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {simSkills.map((sk, i) => (
                    <SimSkillCard
                      key={sk._uid}
                      skill={sk}
                      idx={i}
                      onChange={(f, v) => updateSkill(sk._uid, f, v)}
                      onRemove={() => removeSkill(sk._uid)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Run options */}
            <div className="card">
              <div className="card-head">
                <div className="card-title">Run options</div>
              </div>
              <div className="card-body">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 8 }}>
                    Sample size — most recent queries
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="chip-group">
                      {[25, 50, 100, 250, 500].map(n => (
                        <button
                          key={n}
                          className={`chip ${sampleSize === n ? 'active' : ''}`}
                          onClick={() => setSampleSize(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>queries</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
                    Larger samples are more statistically representative but take longer to run.
                  </div>
                </div>
              </div>
              <div className="card-foot">
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>
                  {!canRun
                    ? 'Add at least one skill to run a simulation'
                    : `${simSkills.length} skill${simSkills.length !== 1 ? 's' : ''} · ${sampleSize} queries · read-only`}
                </div>
                <button
                  className="btn primary"
                  disabled={!canRun}
                  onClick={runSim}
                  style={{ gap: 8 }}
                >
                  <Icon name="simulate" size={13} /> Run simulation
                </button>
              </div>
            </div>
          </div>

          {/* Right — active skill baseline */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Baseline skill set</div>
                <div className="card-sub">
                  {loadingActive ? 'Loading…' : `${activeSkills.length} active skills in production`}
                </div>
              </div>
            </div>
            <div style={{ padding: '8px 0 8px' }}>
              {loadingActive && [1,2,3,4].map(i => (
                <div key={i} style={{ padding: '8px 18px' }}>
                  <div className="skel" style={{ height: 13, width: '70%', marginBottom: 5 }}></div>
                  <div className="skel" style={{ height: 11, width: '90%' }}></div>
                </div>
              ))}
              {!loadingActive && activeSkills.length === 0 && (
                <div className="empty" style={{ padding: '24px', textAlign: 'center' }}>
                  No active skills. Create and approve skills first.
                </div>
              )}
              {!loadingActive && activeSkills.slice(0, 12).map(s => {
                const overridden = loadedIds.has(s.id);
                return (
                  <div key={s.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '9px 18px',
                      borderBottom: '1px solid var(--line-2)',
                      background: overridden ? 'var(--warning-soft)' : 'transparent',
                      transition: 'background 100ms',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 500,
                        color: overridden ? 'var(--warning)' : 'var(--ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {overridden && '↩ '}{s.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {s.trigger_condition}
                      </div>
                    </div>
                    {overridden
                      ? <span style={{ fontSize: 10.5, color: 'var(--warning)', fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>Override</span>
                      : (
                        <button
                          className="btn ghost sm"
                          style={{ flexShrink: 0, padding: '2px 7px', fontSize: 11.5 }}
                          onClick={() => addFromActive(s)}
                        >
                          Modify
                        </button>
                      )}
                  </div>
                );
              })}
              {!loadingActive && activeSkills.length > 12 && (
                <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--ink-4)' }}>
                  +{activeSkills.length - 12} more active skills · unchanged in simulation
                </div>
              )}
            </div>
          </div>
        </div>

        {showPickModal && (
          <PickSkillModal
            activeSkills={activeSkills}
            disabledIds={loadedIds}
            onPick={addFromActive}
            onClose={() => setShowPickModal(false)}
          />
        )}
      </div>
    );
  }

  // ── Running phase ────────────────────────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Running simulation…</h1>
            <p className="page-sub">
              Testing {simSkills.length} skill{simSkills.length !== 1 ? 's' : ''} against {sampleSize} historical queries. This may take up to a minute.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 580 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">Pipeline</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--accent)', display: 'block', animation: 'skel 0.8s ease-in-out infinite alternate' }}></span>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Running</span>
              </div>
            </div>
            <div className="trace">
              {runSteps.map((s, i) => (
                <div key={i} className="trace-row">
                  <div className="trace-step" style={{ background: 'var(--success-soft)', borderColor: 'oklch(0.85 0.06 150)' }}>
                    <Icon name="check" size={11} stroke={2.5} style={{ color: 'var(--success)' }} />
                  </div>
                  <div>
                    <div className="trace-name">{s.label}</div>
                    <div className="trace-desc">{s.desc}</div>
                  </div>
                  <div></div>
                </div>
              ))}
              {runSteps.length < 4 && (
                <div className="trace-row">
                  <div className="trace-step" style={{ background: 'var(--accent-soft)', borderColor: 'oklch(0.85 0.08 280)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 4, background: 'var(--accent)', animation: 'skel 0.8s linear infinite', display: 'block' }}></span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="trace-name">
                      <span className="skel" style={{ height: 13, width: 220, display: 'inline-block' }}></span>
                    </div>
                    <div className="trace-desc">
                      <span className="skel" style={{ height: 11, width: 300, display: 'inline-block', marginTop: 5 }}></span>
                    </div>
                  </div>
                  <div></div>
                </div>
              )}
            </div>
            <div className="card-foot">
              <span>{sampleSize} queries × {simSkills.length} skill override{simSkills.length !== 1 ? 's' : ''}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>POST /api/v1/simulate</span>
            </div>
          </div>

          {/* Skill summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {simSkills.map(sk => (
              <div key={sk._uid} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 13,
              }}>
                {sk.isNew
                  ? <span className="badge accent" style={{ fontSize: 10.5 }}>New</span>
                  : <span className="badge pending" style={{ fontSize: 10.5 }}>Modified</span>}
                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{sk.name || '(untitled)'}</span>
                {sk.id && (
                  <span className="id-tag" style={{ marginLeft: 'auto' }}>{sk.id.slice(0, 8)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Results phase ────────────────────────────────────────────────────────────
  const { impact_summary, top_impacted_skills } = result;
  const totalQ = result.total_queries;
  const changedPct = Math.round((result.changed_decisions / Math.max(totalQ, 1)) * 100);
  const netCoverage = impact_summary.escalate_to_auto - impact_summary.auto_to_escalate;

  const Verdict = () => {
    if (result.changed_decisions === 0) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--success-soft)', display: 'grid', placeItems: 'center', color: 'var(--success)', flexShrink: 0 }}>
          <Icon name="check2" size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>No impact detected</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>All {totalQ} decisions remain identical under this change.</div>
        </div>
      </div>
    );
    if (netCoverage > 0 && impact_summary.auto_to_escalate === 0) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--success-soft)', display: 'grid', placeItems: 'center', color: 'var(--success)', flexShrink: 0 }}>
          <Icon name="arrowdown" size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--success)' }}>Pure coverage gain</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>+{impact_summary.escalate_to_auto} queries resolved · zero coverage regression.</div>
        </div>
      </div>
    );
    if (impact_summary.auto_to_escalate > 0 && impact_summary.escalate_to_auto === 0) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--danger-soft)', display: 'grid', placeItems: 'center', color: 'var(--danger)', flexShrink: 0 }}>
          <Icon name="arrowup" size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--danger)' }}>Coverage regression</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>{impact_summary.auto_to_escalate} queries will now escalate instead of resolving.</div>
        </div>
      </div>
    );
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: netCoverage >= 0 ? 'var(--success-soft)' : 'var(--warning-soft)', display: 'grid', placeItems: 'center', color: netCoverage >= 0 ? 'var(--success)' : 'var(--warning)', flexShrink: 0 }}>
          <Icon name="chart" size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: netCoverage > 0 ? 'var(--success)' : netCoverage < 0 ? 'var(--danger)' : 'var(--warning)' }}>
            Net coverage {netCoverage > 0 ? `+${netCoverage}` : netCoverage}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>
            {impact_summary.escalate_to_auto} gained · {impact_summary.auto_to_escalate} lost
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Simulation Results</h1>
          <p className="page-sub">
            {fmt(totalQ)} queries tested · {changedPct}% of decisions would change
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={reset}>
            <Icon name="refresh" size={13} /> New simulation
          </button>
          <button className="btn" onClick={() => setPhase('setup')}>
            <Icon name="edit" size={13} /> Edit skills
          </button>
        </div>
      </div>

      {/* Impact summary metrics */}
      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <div className="metric">
          <div className="metric-label">Queries tested</div>
          <div className="metric-value">{fmt(totalQ)}</div>
          <div className="metric-meta"><span>historical queries</span></div>
        </div>
        <div className="metric">
          <div className="metric-label">Decisions changed</div>
          <div className="metric-value" style={{ color: result.changed_decisions > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {fmt(result.changed_decisions)}
          </div>
          <div className="metric-meta"><span>{changedPct}% of total</span></div>
        </div>
        <div className="metric">
          <div className="metric-label">Coverage gain</div>
          <div className="metric-value" style={{ color: impact_summary.escalate_to_auto > 0 ? 'var(--success)' : undefined }}>
            +{impact_summary.escalate_to_auto}
          </div>
          <div className="metric-meta"><span>escalated → auto-resolved</span></div>
        </div>
        <div className="metric">
          <div className="metric-label">Coverage loss</div>
          <div className="metric-value" style={{ color: impact_summary.auto_to_escalate > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {impact_summary.auto_to_escalate > 0 ? `-${impact_summary.auto_to_escalate}` : '0'}
          </div>
          <div className="metric-meta"><span>auto-resolved → escalated</span></div>
        </div>
      </div>

      {/* Impact breakdown bar */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div className="card-title">Impact breakdown</div>
          <div className="card-sub">{result.changed_decisions} of {totalQ} queries affected · {Math.round(result.unchanged / Math.max(totalQ, 1) * 100)}% stable</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              ['auto_to_escalate', impact_summary.auto_to_escalate],
              ['escalate_to_auto', impact_summary.escalate_to_auto],
              ['decision_changed', impact_summary.decision_changed],
              ['confidence_shift', impact_summary.confidence_shift],
            ].map(([key, count]) => {
              const m = CHANGE_META[key];
              const active = count > 0;
              return (
                <div key={key} style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: active ? m.bg : 'var(--bg-subtle)',
                  border: `1px solid ${active ? m.borderColor : 'var(--line-2)'}`,
                  opacity: active ? 1 : 0.55,
                  transition: 'opacity 200ms',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: active ? `oklch(from ${m.color} l c h / 0.15)` : 'var(--line)', display: 'grid', placeItems: 'center', color: active ? m.color : 'var(--ink-4)' }}>
                      <Icon name={m.icon} size={13} />
                    </div>
                    <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: active ? m.color : 'var(--ink-4)', lineHeight: 1 }}>
                      {count}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? m.color : 'var(--ink-4)', marginBottom: 3 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.4 }}>
                    {m.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        {/* Examples */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div className="chip-group">
              {[
                ['all', `All · ${result.examples?.length ?? 0}`],
                ['changed', `Changed · ${result.changed_decisions}`],
                ['loss', `Loss · ${impact_summary.auto_to_escalate}`],
                ['gain', `Gain · ${impact_summary.escalate_to_auto}`],
                ['unchanged', `Stable · ${result.unchanged}`],
              ].map(([k, label]) => (
                <button key={k} className={`chip ${exFilter === k ? 'active' : ''}`} onClick={() => setExFilter(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn ghost sm" onClick={() => setExpanded(new Set(filteredExamples.map(e => e.query_id)))}>
                Expand all
              </button>
              <button className="btn ghost sm" onClick={() => setExpanded(new Set())}>
                Collapse
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredExamples.length === 0 && (
              <div className="card">
                <div className="card-body" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>
                  No examples match this filter.
                </div>
              </div>
            )}
            {filteredExamples.map(ex => (
              <ExampleRow
                key={ex.query_id}
                ex={ex}
                isExpanded={expanded.has(ex.query_id)}
                onToggle={() => toggleExpand(ex.query_id)}
              />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Verdict */}
          <div className="card">
            <div className="card-head"><div className="card-title">Verdict</div></div>
            <div className="card-body">
              <Verdict />
              <div style={{
                marginTop: 14, padding: '10px 12px',
                background: 'var(--bg-subtle)', borderRadius: 6,
                fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55,
              }}>
                {result.unchanged} of {totalQ} queries ({Math.round(result.unchanged / Math.max(totalQ, 1) * 100)}%) produce identical decisions. {result.changed_decisions > 0 ? `Review the ${result.changed_decisions} changed example${result.changed_decisions !== 1 ? 's' : ''} before deploying.` : 'This change is safe to deploy.'}
              </div>
            </div>
          </div>

          {/* Top impacted skills */}
          {top_impacted_skills.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Top impacted skills</div>
                <div className="card-sub">by queries affected</div>
              </div>
              <div className="card-body" style={{ paddingTop: 8 }}>
                {top_impacted_skills.map((sk, i) => {
                  const maxCount = top_impacted_skills[0]?.queries_affected || 1;
                  const pct = Math.round((sk.queries_affected / maxCount) * 100);
                  return (
                    <div key={sk.skill_id || i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4, gap: 8 }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {sk.skill_name || 'Unknown'}
                        </span>
                        <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11, flexShrink: 0 }}>
                          {sk.queries_affected}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'var(--accent)', borderRadius: 2,
                          transition: 'width 700ms cubic-bezier(0.2,0.8,0.2,1)',
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Run config */}
          <div className="card">
            <div className="card-head"><div className="card-title">Configuration</div></div>
            <div className="card-body" style={{ padding: '12px 18px' }}>
              <dl className="kv" style={{ fontSize: 12.5 }}>
                <dt>Skills tested</dt>
                <dd>{simSkills.length}</dd>
                <dt>Modified</dt>
                <dd>{simSkills.filter(s => s.isModified).length}</dd>
                <dt>New</dt>
                <dd>{simSkills.filter(s => s.isNew).length}</dd>
                <dt>Sample size</dt>
                <dd>{sampleSize} queries</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SimulationPage });
