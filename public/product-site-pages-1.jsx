/* global React, PSCommon */
(function() {
var { useState, useEffect, useRef, useMemo } = React;
var Ic = PSCommon.Ic, Reveal = PSCommon.Reveal, WLButton = PSCommon.WLButton, CTABanner = PSCommon.CTABanner;

// ─── Live counter (signups + decisions) ────────────────────────────
function LiveCounter() {
  const [n, setN] = useState({ signups: 100, decisions: 1000, teams: 23, audits: 612 });
  useEffect(() => {
    const t = setInterval(() => {
      setN(prev => ({
        signups: prev.signups + (Math.random() < 0.5 ? 1 : 0),
        decisions: prev.decisions + Math.floor(20 + Math.random() * 80),
        teams: prev.teams,
        audits: prev.audits + (Math.random() < 0.3 ? 1 : 0),
      }));
    }, 1800);
    return () => clearInterval(t);
  }, []);
  const fmt = (n) => n.toLocaleString();
  return (
    <div className="ps-counter">
      <div className="c"><div className="v">{fmt(n.signups)}</div><div className="l">on the waitlist</div></div>
      <div className="c"><div className="v">{fmt(n.decisions)}</div><div className="l">decisions evaluated · last 30d</div></div>
      <div className="c"><div className="v">{fmt(n.teams)}</div><div className="l">teams in closed beta</div></div>
      <div className="c"><div className="v">{fmt(n.audits)}</div><div className="l">audit exports this week</div></div>
    </div>
  );
}

// ─── Hero showcase ─────────────────────────────────────────────────
function HeroFrame() {
  const items = [
    { ic: '◐', label: 'Decisions', n: '12,481', active: true },
    { ic: '◇', label: 'Skills', n: '47' },
    { ic: '◈', label: 'Queries', n: '1,204' },
    { ic: '◰', label: 'Activity', n: '∞' },
    { ic: '◫', label: 'Analytics', n: '·' },
  ];
  return (
    <div className="ps-frame">
      <div className="ps-frame-bar">
        <div className="lights"><span/><span/><span/></div>
        <div className="url">www.curtainai.in/dashboard</div>
        <div className="nda">Beta preview</div>
      </div>
      <div className="ps-frame-body">
        <div className="ps-frame-side">
          <div className="lab">Workspace</div>
          {items.map((it, i) => (
            <div key={i} className={`item ${it.active ? 'active' : ''}`}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{it.ic}</span>
              {it.label}
              <span className="ct">{it.n}</span>
            </div>
          ))}
        </div>
        <FrameMain />
      </div>
    </div>
  );
}

function FrameMain() {
  const rows = [
    { id: 'Q-2841', skill: 'Handle refund request', input: 'Customer wants refund for order #8841', confidence: 94, status: 'matched', method: 'hybrid' },
    { id: 'Q-2840', skill: 'Apply discount code', input: 'Apply 18% discount to enterprise plan', confidence: 88, status: 'matched', method: 'hybrid' },
    { id: 'Q-2839', skill: null, input: 'Bulk supplier change for Q3', confidence: null, status: 'escalated', method: 'no_keyword_match' },
    { id: 'Q-2838', skill: 'Handle refund request', input: 'Refund $1,840 — annual plan cancellation', confidence: 76, status: 'matched', method: 'jaccard_only' },
    { id: 'Q-2837', skill: 'Cancel subscription', input: 'Cancel annual plan, effective immediately', confidence: 91, status: 'matched', method: 'hybrid' },
    { id: 'Q-2836', skill: 'Custom quote approval', input: 'Generate custom quote $42k for Halton', confidence: 82, status: 'matched', method: 'hybrid' },
  ];
  const statusStyle = (s) => ({
    matched: { bg: 'oklch(0.94 0.08 150)', color: '#155932' },
    escalated: { bg: 'oklch(0.94 0.08 80)', color: '#7a5500' },
  }[s] || { bg: 'var(--paper-2)', color: 'var(--ink-3)' });
  return (
    <div className="ps-frame-main">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.012em' }}>Query history · last 24 h</h3>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>live</span>
      </div>
      <div className="ps-query-table-wrap">
      <div style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', background: 'var(--bg)', minWidth: 340 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1.6fr 60px 90px', padding: '8px 12px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', background: 'var(--paper-2)', borderBottom: '1px solid var(--line-2)' }}>
          <span>ID</span><span>Query</span><span>Conf.</span><span>Status</span>
        </div>
        {rows.map(r => {
          const st = statusStyle(r.status);
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '70px 1.6fr 60px 90px', padding: '10px 12px', alignItems: 'center', fontSize: 12.5, borderBottom: '1px solid var(--line-2)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{r.id}</span>
              <span style={{ color: 'var(--ink-2)' }}>{r.input}<div style={{ color: 'var(--ink-4)', fontSize: 11.5, marginTop: 2 }}>{r.skill || 'escalated · no match'}</div></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.confidence ? (r.confidence >= 85 ? '#155932' : r.confidence >= 70 ? '#7a5500' : '#9a1a1a') : 'var(--ink-4)' }}>{r.confidence ? `${r.confidence}%` : '—'}</span>
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: st.bg, color: st.color, fontWeight: 500, justifySelf: 'start' }}>{r.status}</span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── HOME PAGE ─────────────────────────────────────────────────────
function HomePage({ openWaitlist, setPage }) {
  return (
    <div className="ps-page">
      {/* HERO */}
      <section className="ps-hero">
        <div className="ps-container">
          <div className="ps-hero-inner">
            <div>
              <div className="ps-hero-tag"><b>Closed Beta</b> <span className="pulse" /> Cohort 04 onboarding · spring '26</div>
              <h1 className="ps-h1">Decision infrastructure<br/>for AI agents.</h1>
              <p className="ps-sub" style={{ fontSize: 18, maxWidth: '54ch' }}>
                Curtain sits between your agents and the world. Every action is policy-checked, reviewable, and reversible — with a complete audit trail for the decisions that matter.
              </p>
              <div className="ps-hero-actions" style={{ marginTop: 28 }}>
                <WLButton size="lg" onClick={() => openWaitlist()} label="Join the waitlist" />
                <WLButton size="lg" ghost onClick={() => setPage('features')} label="See how it works" />
              </div>
              <div className="ps-hero-meta">
                <span><strong>100</strong> on waitlist</span><span className="dot"/>
                <span><strong>~2 wk</strong> invite cycle</span><span className="dot"/>
                <span>SOC 2 in audit</span><span className="dot"/>
                <span>REST API + SDKs</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <HeroFrame />
              <div className="ps-float tl">
                <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Median match time</div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>38ms</div>
              </div>
              <div className="ps-float br">
                <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Avg confidence</div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>91%</div>
              </div>
            </div>
          </div>
          <LiveCounter />
        </div>
      </section>

      {/* LOGOS */}
      <section style={{ padding: '8px 0 0' }}>
        <div className="ps-container">
          <div className="ps-logos-cap">Trusted by closed-beta teams shipping production agents</div>
          <div className="ps-logos">
            {['Halton','Foundry/9','Northwind','Aperture','Thirdline','Kestrel'].map((n, i) => (
              <div key={i} className={i % 2 ? 'ps-logo mono' : 'ps-logo'}>{n}</div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="ps-section">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">How it works</div>
              <h2 className="ps-h2">Three moves between your agent <em>and a decision shipping into the world.</em></h2>
            </div>
            <div className="right">Drop the API in front of any tool call. Define skills. Watch every decision become queryable, reviewable, and explainable.</div>
          </Reveal>
          <div className="ps-steps">
            <Reveal className="ps-step" delay={0}>
              <div className="num">01</div>
              <h3>Define skills</h3>
              <p>Create skills that describe your decisions — trigger conditions, actions, and confidence thresholds. Plain English compiles to evaluators.</p>
              <div className="vis">
                <div className="row"><span className="k">trigger</span><span className="v">"customer wants refund for order"</span></div>
                <div className="row"><span className="k">decision</span><span className="v">"Approve if order verified and amount &lt; $500"</span></div>
                <div className="out">→ active · confidence 0.94</div>
              </div>
            </Reveal>
            <Reveal className="ps-step" delay={120}>
              <div className="num">02</div>
              <h3>Query before acting</h3>
              <p>Before your agent takes any high-stakes action, POST the query to Curtain. Get back a matched skill, confidence score, and decision.</p>
              <div className="vis">
                <div className="row"><span className="k">query</span><span className="v">"Refund $284 for order #8841"</span></div>
                <div className="row"><span className="k">method</span><span className="v">hybrid (vector + Jaccard)</span></div>
                <div className="out">→ matched · 94% · escalate: false</div>
              </div>
            </Reveal>
            <Reveal className="ps-step" delay={240}>
              <div className="num">03</div>
              <h3>Review, override, audit</h3>
              <p>Reviewers triage escalated queries in seconds. Override any decision. Export a complete audit trail for any window.</p>
              <div className="vis">
                <div className="row"><span className="k">escalated</span><span className="v">Q-2839 · no matching skill</span></div>
                <div className="row"><span className="k">override</span><span className="v">by M. Reyes · approved</span></div>
                <div className="out">→ override logged · skill created</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURES OVERVIEW */}
      <section className="ps-section alt">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Platform</div>
              <h2 className="ps-h2">Everything between your agent and consequence.</h2>
            </div>
            <div className="right">Six primitives that turn agents from a black box into infrastructure your team can actually run.</div>
          </Reveal>
          <div className="ps-grid-3">
            {[
              { ic: <Ic.shield />, h: 'Skill engine', p: 'Plain-English skills compile to evaluators with confidence scores, escalation rules, and version history.' },
              { ic: <Ic.eye />, h: 'Query console', p: 'A purpose-built triage UI for testing queries against active skills. Median match under 40ms.' },
              { ic: <Ic.branch />, h: 'Override system', p: 'Every escalated query can be overridden. Overrides feed back to improve skill matching over time.' },
              { ic: <Ic.layers />, h: 'Decision log', p: 'Complete query history with pipeline traces, search methods, and candidate scores. Exportable.' },
              { ic: <Ic.graph />, h: 'Analytics', p: 'Confidence distributions, escalation rates, skill performance — daily stats and rolling trends.' },
              { ic: <Ic.key />, h: 'Workspaces & API keys', p: 'Per-workspace isolation, scoped API keys, and rate limiting. Bootstrap in 30 seconds.' },
            ].map((f, i) => (
              <Reveal key={i} className="ps-card" delay={i * 60}>
                <div className="ic">{f.ic}</div>
                <h4>{f.h}</h4>
                <p>{f.p}</p>
              </Reveal>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
            <WLButton onClick={() => setPage('features')} ghost label="Tour the features" />
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="ps-section">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Why Curtain</div>
              <h2 className="ps-h2">A purpose-built layer, <em>not a logging tool with extra steps.</em></h2>
            </div>
            <div className="right">Most "agent observability" tools watch decisions. Curtain governs them — and gives you the controls to fix them.</div>
          </Reveal>
          <div className="ps-cmp">
            <div className="ps-cmp-row head">
              <div className="ps-cmp-cell">Capability</div>
              <div className="ps-cmp-cell">Logging / observability tools</div>
              <div className="ps-cmp-cell">Curtain</div>
            </div>
            {[
              ['Catches bad decisions before they ship', 'Read-only after the fact', 'Skill matching + escalation before action'],
              ['Plain-English policy/skill authoring', 'No', 'Yes — compiles to evaluators'],
              ['Hybrid vector + keyword search', 'No', 'Hybrid RRF (vector + Jaccard)'],
              ['Per-workspace isolation + API keys', 'Shared dashboards', 'Full tenant isolation'],
              ['Complete decision trace & audit log', 'Append-only logs', 'Queryable history with pipeline traces'],
              ['Override loop → skill improvement', 'No', 'Human overrides feed back to skill corpus'],
            ].map((row, i) => (
              <div key={i} className="ps-cmp-row">
                <div className="ps-cmp-cell feature">{row[0]}</div>
                <div className="ps-cmp-cell cur"><span className="x"><Ic.close /></span>{row[1]}</div>
                <div className="ps-cmp-cell win"><span className="check"><Ic.check /></span>{row[2]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="ps-section dark">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Beta in numbers</div>
              <h2 className="ps-h2">Real load, real teams, real receipts.</h2>
            </div>
            <div className="right">Aggregate stats from cohorts 01–03. We'll publish a full benchmark with public beta in Q3.</div>
          </Reveal>
          <div className="ps-stats" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <div className="ps-stat" style={{ borderColor: 'rgba(255,255,255,0.12)' }}><div className="v">0.8<span className="u">M</span></div><div className="l" style={{ color: 'rgba(250,250,248,0.65)' }}>decisions evaluated</div></div>
            <div className="ps-stat" style={{ borderColor: 'rgba(255,255,255,0.12)' }}><div className="v">38<span className="u">ms</span></div><div className="l" style={{ color: 'rgba(250,250,248,0.65)' }}>median match latency</div></div>
            <div className="ps-stat" style={{ borderColor: 'rgba(255,255,255,0.12)' }}><div className="v">91<span className="u">%</span></div><div className="l" style={{ color: 'rgba(250,250,248,0.65)' }}>avg confidence score</div></div>
            <div className="ps-stat"><div className="v">99.97<span className="u">%</span></div><div className="l" style={{ color: 'rgba(250,250,248,0.65)' }}>API uptime</div></div>
          </div>
          <Reveal className="ps-quote" delay={120} style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--paper)' }}>
            <blockquote>"Curtain is the only thing that lets us put an agent in front of a customer and sleep at night. Our reviewers became our power users."</blockquote>
            <div className="who" style={{ borderTopColor: 'rgba(250,250,248,0.12)' }}>
              <div className="av">MR</div>
              <div>
                <div className="name">Maya Reyes</div>
                <div className="role" style={{ color: 'rgba(250,250,248,0.6)' }}>Head of Operations · Halton Logistics</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="ps-section tight">
        <div className="ps-container">
          <CTABanner openWaitlist={openWaitlist} />
        </div>
      </section>
    </div>
  );
}

// ─── FEATURES PAGE ─────────────────────────────────────────────────
function FeaturesPage({ openWaitlist, setPage }) {
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 48px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Features</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(38px, 5vw, 60px)' }}>The control surface for agent decisions.</h1>
          <p className="ps-sub" style={{ fontSize: 17 }}>Six tightly-integrated primitives. Drop them in one at a time, or all at once.</p>
        </div>
      </section>

      {[
        {
          ic: <Ic.shield />,
          eye: '01 · Skill engine',
          h: 'Policies you can read out loud.',
          p: 'Write what should happen in plain English. Curtain compiles it to a deterministic evaluator with configurable confidence thresholds, escalation routing, and version history for every content change.',
          bullets: ['Plain-language → compiled evaluators', 'Confidence threshold per skill', 'Version history with restore', 'Pending review → active state machine'],
          art: 'policy',
        },
        {
          ic: <Ic.eye />,
          eye: '02 · Query console',
          h: 'Test any query against your live skills.',
          p: 'The query console lets you run any input against your active skill corpus. See the full decision trace — search method, top candidates with scores, and the final matched skill.',
          bullets: ['Hybrid vector + Jaccard search (RRF)', 'Full pipeline trace per query', 'Candidate confidence scores', 'Escalation flag + reason'],
          art: 'review',
        },
        {
          ic: <Ic.branch />,
          eye: '03 · Override system',
          h: 'Every escalation is a learning opportunity.',
          p: 'When a query escalates (no match or low confidence), a reviewer corrects it. That override is stored and feeds back into skill refinement — closing the loop automatically.',
          bullets: ['Override any query decision', 'Override history per skill', 'Feed back to improve matching', 'Audit trail for every correction'],
          art: 'revert',
        },
        {
          ic: <Ic.layers />,
          eye: '04 · Decision log',
          h: 'A complete queryable history of every decision.',
          p: 'Every query is stored with its full pipeline trace: search method, vector candidates, Jaccard scores, RRF fusion, and final decision. Filter by escalation status, skill, or date range.',
          bullets: ['Full DecisionTrace JSONB per query', 'Filter by escalated, skill_id, date', 'Pagination with cursor support', 'search_method: hybrid | jaccard_only | no_match'],
          art: 'log',
        },
        {
          ic: <Ic.graph />,
          eye: '05 · Analytics',
          h: 'Know when your skill corpus drifts.',
          p: 'Daily materialized views show query volume, escalation rates, and confidence distributions per workspace and per skill. p50/p90/p99 confidence percentiles refreshed every 5 minutes.',
          bullets: ['Workspace-level daily stats', 'Per-skill confidence percentiles', 'Escalation rate trending', 'Materialized views, 5-min refresh'],
          art: 'drift',
        },
        {
          ic: <Ic.key />,
          eye: '06 · Workspaces & keys',
          h: 'Per-workspace isolation. Scoped API keys.',
          p: 'Each workspace is fully isolated — its own skills, queries, and API keys. Rate limiting (100 req/min), SHA-256 hashed key storage, and a bootstrap script to get started in 30 seconds.',
          bullets: ['Full tenant isolation', 'Rate limiting (100 req/min/workspace)', 'SHA-256 hashed key storage', 'Bootstrap script in one command'],
          art: 'identity',
        },
      ].map((f, i) => (
        <section key={i} className={`ps-section ${i % 2 ? 'alt' : ''}`}>
          <div className="ps-container">
            <Reveal className="ps-feature-grid">
              <div style={{ order: i % 2 ? 2 : 1 }}>
                <div className="ps-eyebrow">{f.eye}</div>
                <h2 className="ps-h2">{f.h}</h2>
                <p className="ps-sub">{f.p}</p>
                <ul className="ps-feature-bullets">
                  {f.bullets.map((b, j) => (
                    <li key={j} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--ink-2)', alignItems: 'flex-start', lineHeight: 1.45 }}>
                      <span style={{ color: 'var(--ink)', marginTop: 1 }}><Ic.check /></span>{b}
                    </li>
                  ))}
                </ul>
                <WLButton onClick={() => openWaitlist()} label="Get early access" />
              </div>
              <div style={{ order: i % 2 ? 1 : 2 }}>
                <FeatureArt kind={f.art} />
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      <section className="ps-section tight">
        <div className="ps-container">
          <CTABanner openWaitlist={openWaitlist} />
        </div>
      </section>
    </div>
  );
}

function FeatureArt({ kind }) {
  if (kind === 'policy') {
    return (
      <div className="ps-frame" style={{ minHeight: 360 }}>
        <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/skills/sk_refund</div></div>
        <div style={{ padding: '20px 22px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, background: 'var(--bg)' }}>
          <div style={{ color: 'var(--ink-4)', marginBottom: 6, fontSize: 11 }}>SKILL · sk_8f2a · active</div>
          <div><span style={{ color: 'oklch(0.55 0.18 280)', fontWeight: 600 }}>name</span>: <span style={{ color: 'oklch(0.55 0.14 80)' }}>"Handle refund request"</span></div>
          <div><span style={{ color: 'oklch(0.55 0.18 280)', fontWeight: 600 }}>trigger</span>: <span style={{ color: 'oklch(0.55 0.14 80)' }}>"customer wants refund for order"</span></div>
          <div><span style={{ color: 'oklch(0.55 0.18 280)', fontWeight: 600 }}>decision</span>: <span style={{ color: 'oklch(0.55 0.14 80)' }}>"Approve if verified and &lt; $500"</span></div>
          <div><span style={{ color: 'oklch(0.55 0.18 280)', fontWeight: 600 }}>escalation</span>: <span style={{ color: 'oklch(0.75 0.12 150)' }}>false</span></div>
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 8, fontSize: 12 }}>
            ✓ Active · v3 · confidence avg 94% · 12,481 queries matched
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'review') {
    return (
      <div className="ps-frame" style={{ minHeight: 360 }}>
        <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/query</div></div>
        <div style={{ padding: 22, background: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
          <div style={{ color: 'var(--ink-4)', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>POST /api/v1/query</div>
          <div style={{ padding: '10px 12px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 8, marginBottom: 10, fontSize: 12 }}>
            <div style={{ color: 'rgba(250,250,248,0.5)', marginBottom: 6 }}>request</div>
            <div>{'{'}</div>
            <div style={{ paddingLeft: 16 }}><span style={{ color: 'oklch(0.78 0.14 280)' }}>"customer_query"</span>: <span style={{ color: 'oklch(0.78 0.14 80)' }}>"Refund order #8841"</span></div>
            <div>{'}'}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'oklch(0.94 0.08 150)', borderRadius: 8, fontSize: 12 }}>
            <div style={{ color: '#155932', marginBottom: 6, fontWeight: 600 }}>matched · 94% confidence</div>
            <div style={{ color: '#155932' }}>Handle refund request · escalate: false</div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'revert') {
    return (
      <div className="ps-frame" style={{ minHeight: 360 }}>
        <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/overrides</div></div>
        <div style={{ padding: 22, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg-elev)', fontSize: 13 }}>
            <div style={{ color: 'var(--ink-4)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ESCALATED QUERY · Q-2839</div>
            "Bulk supplier change for Q3 procurement"
          </div>
          <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 18 }}>↓</div>
          <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg-elev)', fontSize: 13 }}>
            <div style={{ color: 'var(--ink-4)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>OVERRIDE · by M. Reyes</div>
            Matched: "Approve supplier changes &lt; $50k" · confidence: 0.82
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 9, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ic.check /> Override logged · skill suggestion queued
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'log') {
    return (
      <div className="ps-frame" style={{ minHeight: 360 }}>
        <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/activity</div></div>
        <div style={{ padding: 18, background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, minHeight: 280 }}>
          {[
            { id: 'Q-2841', method: 'hybrid', conf: '0.94', esc: false },
            { id: 'Q-2840', method: 'hybrid', conf: '0.88', esc: false },
            { id: 'Q-2839', method: 'no_keyword_match', conf: 'null', esc: true },
            { id: 'Q-2838', method: 'jaccard_only', conf: '0.76', esc: false },
            { id: 'Q-2837', method: 'hybrid', conf: '0.91', esc: false },
          ].map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px dashed rgba(250,250,248,0.1)' }}>
              <span style={{ color: 'oklch(0.78 0.14 80)' }}>{r.id}</span>
              <span style={{ color: 'rgba(250,250,248,0.5)' }}>{r.method}</span>
              <span style={{ marginLeft: 'auto', color: r.esc ? 'oklch(0.78 0.14 80)' : 'oklch(0.75 0.12 150)' }}>{r.esc ? '⚑ escalated' : `✓ ${r.conf}`}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, color: 'rgba(250,250,248,0.5)' }}>GET /api/v1/queries?escalated=false&limit=50</div>
          <div style={{ color: 'oklch(0.75 0.12 150)' }}>200 OK · 5 results · page 1/249</div>
        </div>
      </div>
    );
  }
  if (kind === 'drift') {
    const bars = [22, 26, 24, 28, 25, 30, 33, 38, 44, 51, 58, 62];
    return (
      <div className="ps-frame" style={{ minHeight: 360 }}>
        <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/analytics</div></div>
        <div style={{ padding: 22, background: 'var(--bg)' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>Escalation rate · last 12 h</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h * 1.6}px`, background: i >= 8 ? 'oklch(0.78 0.14 80)' : 'var(--ink-5)', borderRadius: '3px 3px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            <span>00:00</span><span>06:00</span><span>now</span>
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'oklch(0.96 0.06 80)', border: '1px solid oklch(0.85 0.08 80)', borderRadius: 8, fontSize: 12 }}>
            <b>Escalation spike</b> · 2.4× baseline since 14:20 — 6 new skills needed
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="ps-frame" style={{ minHeight: 360 }}>
      <div className="ps-frame-bar"><div className="lights"><span/><span/><span/></div><div className="url">www.curtainai.in/settings/api-keys</div></div>
      <div style={{ padding: 22, background: 'var(--bg)' }}>
        {[
          { name: 'Production', key: 'cai_prod_…8f2a', created: 'Apr 14' },
          { name: 'Staging', key: 'cai_stg_…4b91', created: 'Mar 28' },
          { name: 'CI / Testing', key: 'cai_ci_…2d07', created: 'Mar 12' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg-elev)', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{k.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>created {k.created}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'var(--paper-2)', borderRadius: 999, color: 'var(--ink-2)' }}>{k.key}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'oklch(0.94 0.08 150)', borderRadius: 999, color: '#155932' }}>active</span>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 4 }}>Rate limit: 100 req/min · SHA-256 hashed</div>
      </div>
    </div>
  );
}

window.PSPages1 = { HomePage, FeaturesPage };
})();
