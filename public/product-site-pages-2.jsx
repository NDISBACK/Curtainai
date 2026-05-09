/* global React, PSCommon */
(function() {
var { useState, useEffect } = React;
var Ic = PSCommon.Ic, Reveal = PSCommon.Reveal, WLButton = PSCommon.WLButton, CTABanner = PSCommon.CTABanner;

// ─── PRICING PAGE ──────────────────────────────────────────────────
function PricingPage({ openWaitlist }) {
  const tiers = [
    {
      name: 'Audience',
      tag: 'Build with us',
      price: 0, per: 'free',
      meta: '50k queries / month. Closed-beta access.',
      feats: ['Up to 3 workspaces', '50,000 queries/month', '7-day query history', 'Slack & email alerts', 'Community Discord'],
    },
    {
      name: 'Front row',
      tag: 'Most beta teams',
      price: 1900, per: 'mo',
      meta: 'For teams shipping agents to customers.',
      feats: ['Unlimited workspaces', '5M queries/month included', '90-day query history', 'Webhooks + PagerDuty', 'Per-workspace policy overrides', 'Analytics + drift alerts', 'SOC 2 evidence on request'],
      featured: true,
    },
    {
      name: 'Encore',
      tag: 'Enterprise',
      price: null, per: '',
      meta: 'Custom volume, deployment, and audit terms.',
      feats: ['Everything in Front row', 'Self-hosted or VPC deployment', 'Unlimited query history', 'Custom DPA, BAA, MSA', 'Founder-led onboarding', 'Quarterly business reviews', '24/7 priority support'],
    },
  ];

  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 32px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Pricing</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}><Ic.lock style={{ width: 30, height: 30, marginRight: 10, verticalAlign: 'baseline' }} />Pricing announcement coming soon.</h1>
          <p className="ps-sub" style={{ fontSize: 17 }}>We are finalizing beta packaging. Pricing will open in a later announcement.</p>
        </div>
      </section>

      <section className="ps-section tight">
        <div className="ps-container">
          <div className="ps-pricing">
            {tiers.map((t, i) => (
              <Reveal key={i} className={`ps-price ${t.featured ? 'feat' : ''}`} delay={i * 80}>
                {t.featured && <div className="ps-price-badge">Most popular</div>}
                <div className="ps-price-name">{t.name} · {t.tag}</div>
                <div className="ps-price-amt">
                  {t.price === null ? 'Talk to us' : t.price === 0 ? 'Free' : (<>
                    <span className="cur">$</span>{t.price.toLocaleString()}<span className="per">/{t.per}</span>
                  </>)}
                </div>
                <p className="ps-price-meta">{t.meta}</p>
                <ul className="ps-price-feats">
                  {t.feats.map((f, j) => <li key={j}><span className="ck"><Ic.check /></span>{f}</li>)}
                </ul>
                <button
                  type="button"
                  className={`wl-btn ${i === 0 ? 'ghost' : ''}`}
                  disabled
                  title="Pricing will be announced soon"
                  style={{ width: '100%', justifyContent: 'center', opacity: 0.72, cursor: 'not-allowed' }}
                >
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Ic.lock style={{ width: 13, height: 13 }} />
                    Pricing locked
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            Pricing is currently locked · we will announce details in a later release
          </div>
        </div>
      </section>

      <section className="ps-section alt">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Add-ons</div>
              <h2 className="ps-h2">Pay only for what you need beyond the included volume.</h2>
            </div>
          </Reveal>
          <div className="ps-grid-3">
            {[
              { h: 'Queries', p: 'Beyond included monthly queries', amt: '$0.0008', sub: 'per query' },
              { h: 'History retention', p: 'Extended query history beyond plan default', amt: '$0.20', sub: 'per GB / month' },
              { h: 'On-prem deploy', p: 'Self-hosted control plane', amt: 'Encore', sub: 'plan only' },
            ].map((a, i) => (
              <Reveal key={i} className="ps-card" delay={i * 60}>
                <h4>{a.h}</h4>
                <p>{a.p}</p>
                <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em' }}>{a.amt}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{a.sub}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">FAQ</div>
              <h2 className="ps-h2">Pricing questions <em>we hear most.</em></h2>
            </div>
          </Reveal>
          <div className="ps-faq">
            {[
              ['How long does beta pricing last?', 'When you join the waitlist and onboard during the closed beta, your plan price is locked for 12 months from your start date — even after we launch GA pricing.'],
              ['Is there a free tier?', 'Yes — the Audience plan is free up to 50,000 queries per month. It\'s designed for teams evaluating Curtain, building demos, or running internal agents.'],
              ['How is a "query" counted?', 'A query is a single call to POST /api/v1/query. Failed requests due to auth errors, retries from 5xx responses, and health checks do not count.'],
              ['Do you offer non-profit or research pricing?', 'Yes. Email founders@curtain.dev with a short note about your work and we\'ll set you up.'],
              ['Can I bring my own LLM provider?', 'Yes. Curtain is provider-agnostic — the query engine works independently of whichever model produces the agent\'s actions.'],
              ['What happens if I exceed my plan?', 'You\'ll see usage in real-time in your dashboard. We never throttle agents in production; overage is billed at the per-query rate above.'],
            ].map(([q, a], i) => (
              <details key={i} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section tight">
        <div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div>
      </section>
    </div>
  );
}

// ─── DOCS PAGE (real API) ──────────────────────────────────────────
function DocsPage({ openWaitlist }) {
  const [active, setActive] = useState('quickstart');
  const sections = [
    { id: 'quickstart', label: 'Quickstart' },
    { id: 'auth', label: 'Authentication' },
    { id: 'query', label: 'POST /query' },
    { id: 'skills', label: 'Skills' },
    { id: 'extract', label: 'Extraction' },
    { id: 'history', label: 'Query history' },
  ];

  const jumpToSection = (id) => {
    const target = document.getElementById(`docs-${id}`);
    if (!target) return;
    setActive(id);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '56px 0 32px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Docs · public preview</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(36px, 4.4vw, 56px)' }}>Build a decision-aware agent in <em>10 minutes.</em></h1>
          <p className="ps-sub">Real API reference for the Curtain REST API. Full reference, SDK guides, and API keys ship to closed-beta teams.</p>
        </div>
      </section>

      <section className="ps-section" style={{ paddingTop: 24 }}>
        <div className="ps-container">
          <div className="docs-banner">
            <div style={{ width: 36, height: 36, background: 'var(--ink)', color: 'var(--paper)', borderRadius: 9, display: 'grid', placeItems: 'center' }}><Ic.lock /></div>
            <div style={{ flex: 1 }}>
              <b>API keys</b> (format: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>cai_…</code>) are issued during beta onboarding. Join the waitlist to get yours.
            </div>
            <WLButton size="sm" onClick={() => openWaitlist()} label="Get keys" />
          </div>

          <div className="docs-layout">
            <aside className="docs-side">
              <div>
                <h5>Get started</h5>
                <ul>
                  {sections.slice(0, 2).map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={active === s.id ? 'active' : ''}
                        onClick={() => jumpToSection(s.id)}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5>Core endpoints</h5>
                <ul>
                  {sections.slice(2).map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={active === s.id ? 'active' : ''}
                        onClick={() => jumpToSection(s.id)}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5>Reference <Ic.lock style={{ width: 11, height: 11, marginLeft: 4, color: 'var(--ink-4)' }} /></h5>
                <ul style={{ opacity: 0.5 }}>
                  <li><a>Workspaces</a></li>
                  <li><a>Analytics</a></li>
                  <li><a>Simulation</a></li>
                  <li><a>MCP server</a></li>
                </ul>
              </div>
            </aside>

            <div className="docs-content">
              <h2 id="docs-quickstart">Quickstart</h2>
              <p>Bootstrap a workspace, create a skill, and run your first query — all in under 10 minutes.</p>
              <div className="docs-code"><span className="c"># 1. Bootstrap a workspace (run once)</span>
<span className="k">npx</span> tsx scripts/bootstrap-workspace.ts <span className="s">"Acme Corp"</span>
<span className="c"># → prints WS_ID and API_KEY (cai_…)</span>

<span className="c"># 2. Set env vars</span>
<span className="k">export</span> CURTAIN_WS=<span className="s">"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"</span>
<span className="k">export</span> CURTAIN_KEY=<span className="s">"cai_…"</span>

<span className="c"># 3. Create your first skill</span>
<span className="k">curl</span> -X POST https://your-curtain-host/api/v1/skills \
  -H <span className="s">"Authorization: Bearer $CURTAIN_KEY"</span> \
  -H <span className="s">"Content-Type: application/json"</span> \
  -d <span className="s">{`'{
    "name": "Handle refund request",
    "trigger_condition": "customer wants a refund for their order",
    "decision": "Approve if order is verified and amount is under $500",
    "escalation_required": false
  }'`}</span>

<span className="c"># 4. Run a query</span>
<span className="k">curl</span> -X POST https://your-curtain-host/api/v1/query \
  -H <span className="s">"Authorization: Bearer $CURTAIN_KEY"</span> \
  -H <span className="s">"Content-Type: application/json"</span> \
  -d <span className="s">{`'{"customer_query": "I need a refund for order #8841"}'`}</span></div>

              <h3 id="docs-auth">Authentication</h3>
              <p>All endpoints except <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>GET /api/v1/health</code> and <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>POST /api/v1/workspaces</code> require a Bearer token. Tokens are scoped to a workspace and rate-limited to 100 requests/minute.</p>
              <div className="docs-code"><span className="c"># Every authenticated request needs this header</span>
Authorization: Bearer cai_your_api_key_here

<span className="c"># Rate limit: 100 requests/minute per workspace</span>
<span className="c"># Exceeding returns 429 with Retry-After header</span></div>

              <h3 id="docs-query">POST /api/v1/query</h3>
              <p>The core endpoint. Takes a natural-language query and matches it against your active skills using hybrid search (vector similarity + Jaccard, fused via RRF). Returns a full decision trace.</p>
              <div className="docs-code"><span className="c">// Request</span>
POST /api/v1/query
Authorization: Bearer cai_…
Content-Type: application/json

{'{'}
  <span className="field">"customer_query"</span>: <span className="s">"I need a refund for order #8841 — $284"</span>
{'}'}

<span className="c">// Response 200</span>
{'{'}
  <span className="field">"success"</span>: <span className="k">true</span>,
  <span className="field">"data"</span>: {'{'}
    <span className="field">"id"</span>: <span className="s">"Q-2841"</span>,
    <span className="field">"input"</span>: <span className="s">"I need a refund for order #8841 — $284"</span>,
    <span className="field">"output"</span>: {'{'}
      <span className="field">"matched_skill"</span>: {'{'}
        <span className="field">"id"</span>: <span className="s">"sk_8f2a…"</span>,
        <span className="field">"name"</span>: <span className="s">"Handle refund request"</span>,
        <span className="field">"decision"</span>: <span className="s">"Approve if order verified and amount &lt; $500"</span>
      {'}'},
      <span className="field">"confidence"</span>: <span className="k">0.94</span>,
      <span className="field">"escalated"</span>: <span className="k">false</span>,
      <span className="field">"search_method"</span>: <span className="s">"hybrid"</span>,
      <span className="field">"pipeline"</span>: {'{'}
        <span className="field">"vector_candidates"</span>: <span className="k">6</span>,
        <span className="field">"jaccard_fused"</span>: <span className="k">true</span>,
        <span className="field">"top_k"</span>: <span className="k">3</span>
      {'}'},
      <span className="field">"candidates"</span>: [
        {'{'}  <span className="field">"skill_name"</span>: <span className="s">"Handle refund request"</span>, <span className="field">"score"</span>: <span className="k">0.94</span>  {'}'},
        {'{'}  <span className="field">"skill_name"</span>: <span className="s">"Process return"</span>, <span className="field">"score"</span>: <span className="k">0.61</span>  {'}'}
      ]
    {'}'}
  {'}'}
{'}'}</div>
              <p>The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>search_method</code> field will be one of: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>"hybrid"</code> (vector + Jaccard), <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>"jaccard_only"</code> (embedding unavailable), <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>"no_active_skills"</code>, or <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>"no_keyword_match"</code> (escalated).</p>

              <h3 id="docs-skills">Skills API</h3>
              <p>Skills are the unit of policy. Each skill has a trigger condition (what the query is about), a decision (what to do), optional structured conditions, and an escalation flag.</p>
              <div className="docs-code"><span className="c">// Create a skill — POST /api/v1/skills</span>
{'{'}
  <span className="field">"name"</span>: <span className="s">"Handle refund request"</span>,          <span className="c">// required</span>
  <span className="field">"trigger_condition"</span>: <span className="s">"customer wants refund"</span>,  <span className="c">// required — used for matching</span>
  <span className="field">"decision"</span>: <span className="s">"Approve if verified and &lt;$500"</span>,  <span className="c">// required — what to do</span>
  <span className="field">"conditions"</span>: {'{'}                              <span className="c">// optional JSONB</span>
    <span className="field">"max_amount"</span>: <span className="k">500</span>,
    <span className="field">"require_verified"</span>: <span className="k">true</span>
  {'}'},
  <span className="field">"escalation_required"</span>: <span className="k">false</span>              <span className="c">// default false</span>
{'}'}

<span className="c">// Skill status flow</span>
<span className="c">// created           → pending_review</span>
<span className="c">// PATCH /approve     → active  (queryable)</span>
<span className="c">// PATCH /disable     → disabled</span>
<span className="c">// content edit       → pending_review (version snapshot written)</span></div>

              <h3 id="docs-extract">Extraction API</h3>
              <p>POST a conversation transcript and Curtain extracts candidate skills automatically using GPT-4o. Returns a list of extracted skills ready for review and approval.</p>
              <div className="docs-code"><span className="c">// POST /api/v1/extract</span>
{'{'}
  <span className="field">"conversation"</span>: <span className="s">"Agent: I can help with that refund.\nCustomer: Great, it was $284 for order #8841.\nAgent: Approved — refund initiated."</span>,
  <span className="field">"context"</span>: <span className="s">"Customer support agent"</span>  <span className="c">// optional hint</span>
{'}'}

<span className="c">// Response: array of extracted skill drafts</span>
{'{'}
  <span className="field">"data"</span>: {'{'}
    <span className="field">"skills"</span>: [
      {'{'}
        <span className="field">"name"</span>: <span className="s">"Handle refund under $500"</span>,
        <span className="field">"trigger_condition"</span>: <span className="s">"customer requests refund for recent order"</span>,
        <span className="field">"decision"</span>: <span className="s">"Approve and initiate refund immediately"</span>,
        <span className="field">"escalation_required"</span>: <span className="k">false</span>
      {'}'}
    ]
  {'}'}
{'}'}</div>

              <h3 id="docs-history">Query history</h3>
              <p>Paginated history of all queries with full decision traces. Filter by escalation status, skill, or date range.</p>
              <div className="docs-code"><span className="c">// GET /api/v1/queries</span>
<span className="c">// Query params:</span>
<span className="c">//   from=ISO8601  to=ISO8601  page=1  limit=50</span>
<span className="c">//   escalated=true|false  skill_id=sk_…</span>

GET /api/v1/queries?escalated=true&limit=20&page=1

<span className="c">// Response</span>
{'{'}
  <span className="field">"data"</span>: {'{'}
    <span className="field">"queries"</span>: [ <span className="c">/* array of query objects */</span> ],
    <span className="field">"total"</span>: <span className="k">1204</span>,
    <span className="field">"page"</span>: <span className="k">1</span>,
    <span className="field">"limit"</span>: <span className="k">20</span>
  {'}'}
{'}'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="ps-section tight"><div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div></section>
    </div>
  );
}

// ─── CUSTOMERS PAGE ────────────────────────────────────────────────
function CustomersPage({ openWaitlist }) {
  const useCases = [
    {
      vertical: 'Customer Support',
      h: 'Handle refunds, plan changes, and escalations without ticket-by-ticket review.',
      p: 'Deploy a support agent that policy-checks every action before it reaches the customer. Routine decisions auto-match a skill; edge cases escalate to a human with full context — query, history, and a suggested resolution already in the console.',
      bullets: ['Refund approval policies by amount and account status', 'Plan change and cancellation workflows', 'Escalation routing with full decision trace'],
    },
    {
      vertical: 'Sales & Quoting',
      h: 'Every quote your agent generates is policy-checked before it reaches the customer.',
      p: 'Sales agents that handle custom quotes, discount requests, and contract changes need guardrails that move as fast as the deal. Curtain matches each action to a skill, scores confidence, and flags anything outside policy for a reviewer — in under 40ms.',
      bullets: ['Discount approval by tier, amount, and deal size', 'Custom quote generation with policy bounds', 'Contract change routing with audit trail'],
    },
    {
      vertical: 'Operations & Logistics',
      h: 'Put guardrails on the decisions that cost money when they go wrong.',
      p: 'Ops agents rerouting shipments, swapping suppliers, or holding inventory are making decisions with real dollar consequences. Curtain sits between the agent and the action — matching each decision to a skill, enforcing thresholds, and logging everything for your next audit.',
      bullets: ['Supplier swap and procurement approvals', 'Inventory hold and fulfillment routing', 'Exportable audit log for any quarter'],
    },
  ];
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 48px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Use cases</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(40px, 5vw, 60px)' }}>What teams are building with Curtain.</h1>
          <p className="ps-sub" style={{ fontSize: 17 }}>Three patterns we see across every team in the closed beta — no matter the industry.</p>
        </div>
      </section>

      <section className="ps-section" style={{ paddingTop: 24 }}>
        <div className="ps-container" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {useCases.map((u, i) => (
            <Reveal key={i} className="story" delay={i * 80}>
              <div>
                <div style={{ display: 'inline-block', padding: '3px 10px', background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderRadius: 999, fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                  {u.vertical}
                </div>
                <h3 style={{ marginTop: 0 }}>{u.h}</h3>
                <p>{u.p}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {u.bullets.map((b, j) => (
                    <li key={j} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--ink-2)', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ink)', marginTop: 2, flexShrink: 0 }}><Ic.check /></span>{b}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                <div style={{ padding: '20px 22px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-elev)' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
                    Interested in deploying Curtain for {u.vertical.toLowerCase()}?
                  </div>
                  <WLButton size="sm" onClick={() => openWaitlist()} label="Talk to us →" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="ps-section alt">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">More patterns</div>
              <h2 className="ps-h2">Where else teams are putting Curtain.</h2>
            </div>
          </Reveal>
          <div className="ps-uc">
            {[
              { h: 'Internal ops', p: 'Procurement, expense, access requests — gate the actions, ship the speed.' },
              { h: 'Healthcare workflows', p: 'Prior auth, appointment routing, care coordination — with human-in-the-loop for high-risk decisions.' },
              { h: 'Fintech & payments', p: 'Transaction approvals, limit overrides, fraud escalations — policy-matched before they clear.' },
              { h: 'Legal & compliance', p: 'Contract review, policy Q&A, regulatory filings — every decision logged for the audit.' },
            ].map((u, i) => (
              <Reveal key={i} className="ps-card" delay={i * 60}>
                <h4>{u.h}</h4>
                <p>{u.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section tight"><div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div></section>
    </div>
  );
}

// ─── SECURITY PAGE ─────────────────────────────────────────────────
function SecurityPage({ openWaitlist }) {
  const cells = [
    { ic: <Ic.lock />, h: 'Encryption everywhere', p: 'TLS 1.3 in transit. AES-256-GCM at rest. Per-tenant data keys with envelope encryption.' },
    { ic: <Ic.shield />, h: 'Zero-trust networking', p: 'mTLS between services. Tenant-scoped service identities. No shared credentials across customers.' },
    { ic: <Ic.layers />, h: 'Complete query traces', p: 'Every decision is stored with its full pipeline trace. Immutable once written. Export at any time.' },
    { ic: <Ic.key />, h: 'Scoped API keys', p: 'Keys are SHA-256 hashed at rest. Rate limiting (100 req/min) per workspace. Revoke anytime.' },
    { ic: <Ic.eye />, h: 'Least-privilege access', p: 'Curtain staff have no production data access. Break-glass workflows are logged and customer-notified.' },
    { ic: <Ic.branch />, h: 'Data residency', p: 'US, EU, and UK regions today. APAC in audit. Region pinning at the workspace level.' },
  ];
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 32px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Security</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(40px, 5vw, 60px)' }}>Built for teams who'll be audited <em>by someone with subpoena power.</em></h1>
          <p className="ps-sub">Curtain is the audit substrate, not just an integration partner. Here's how we keep your decisions — and our access — in check.</p>
        </div>
      </section>

      <section className="ps-section">
        <div className="ps-container">
          <div className="cert-row">
            <div className="cert"><span className="d" /> SOC 2 Type II · in audit</div>
            <div className="cert"><span className="d" /> ISO 27001 · scoped</div>
            <div className="cert"><span className="d" /> GDPR · DPA available</div>
            <div className="cert"><span className="d" /> HIPAA · BAA on Encore</div>
            <div className="cert"><span className="d" /> Pen tested · quarterly</div>
            <div style={{ marginLeft: 'auto' }}>
              <WLButton size="sm" ghost onClick={() => openWaitlist()} label="Request security pack" />
            </div>
          </div>

          <div className="sec-grid">
            {cells.map((c, i) => (
              <Reveal key={i} className="sec-cell" delay={i * 40}>
                <div className="ic">{c.ic}</div>
                <div>
                  <h4>{c.h}</h4>
                  <p>{c.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section alt">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Trust</div>
              <h2 className="ps-h2">What we won't do.</h2>
            </div>
            <div className="right">A short list, in plain English, of guarantees we make to every beta customer in writing.</div>
          </Reveal>
          <div className="ps-grid-2">
            {[
              ['We won\'t train on your data.', 'Your queries, skills, and decision traces never enter any model training pipeline. Period. Contract clause #4.'],
              ['We won\'t silently alter your query history.', 'Every query is stored immutably. We can\'t edit history; neither can you. Query traces are append-only.'],
              ['We won\'t introduce a hard dependency we can\'t replace.', 'Your data is exportable as standard JSON/CSV at any time. Self-hosting available on Encore.'],
              ['We won\'t add a critical vendor without telling you.', 'Sub-processor list is published. Changes are emailed 30 days before they take effect.'],
            ].map(([h, p], i) => (
              <Reveal key={i} className="ps-card" delay={i * 60}>
                <h4>{h}</h4>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section tight"><div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div></section>
    </div>
  );
}

// ─── COMPANY PAGE ──────────────────────────────────────────────────
function CompanyPage({ openWaitlist }) {
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 32px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Company</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}>We're building the substrate for trustworthy agents.</h1>
          <p className="ps-sub" style={{ fontSize: 17 }}>A small founding team across NYC and Lisbon. Backed by experience shipping agentic systems at scale.</p>
        </div>
      </section>

      <section className="ps-section">
        <div className="ps-container ps-why-grid">
          <Reveal>
            <div className="ps-eyebrow">Why now</div>
            <h2 className="ps-h2">Agents are shipping faster than the controls around them.</h2>
            <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 14 }}>
              Every team we talk to is putting an autonomous agent in front of a real customer this year. Most of them are duct-taping logging, prompt injection filters, and a Slack channel where someone hopes to catch problems before they go viral.
            </p>
            <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              That's not infrastructure. That's a vibe. We're building the layer underneath: skill-based decision matching, reviewable queries, reversible actions, audit-grade history. The boring stuff agents need before they become normal.
            </p>
          </Reveal>
          <Reveal delay={120} className="ps-quote" style={{ marginTop: 0, alignSelf: 'center' }}>
            <blockquote>"We don't need agents to be perfect. We need them to be reviewable, reversible, and accountable. That's a software problem, not a model problem."</blockquote>
            <div className="who">
              <div className="av">ND</div>
              <div>
                <div className="name">Naman Dogra</div>
                <div className="role">Co-founder & CEO</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="ps-section alt">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Team</div>
              <h2 className="ps-h2">A small, deliberate team.</h2>
            </div>
            <div className="right">Hiring senior engineers in NYC, Lisbon, and remote-friendly EU/EST.</div>
          </Reveal>
          <div className="ps-grid-4">
            {[
              { i: 'ND', n: 'Naman Dogra', r: 'CEO ·' },
              { i: 'A', n: 'Aniket', r: 'CTO ·' },
              { i: 'DK', n: 'Daksh Kotwal', r: 'CMO. ' },
            ].map((p, i) => (
              <Reveal key={i} className="ps-card" delay={i * 50} style={{ alignItems: 'flex-start' }}>
                <div className="ic" style={{ background: 'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.55 0.14 230))', borderColor: 'transparent', color: 'white', fontWeight: 600 }}>
                  {p.i}
                </div>
                <h4>{p.n}</h4>
                <p>{p.r}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section">
        <div className="ps-container">
          <Reveal className="ps-section-head">
            <div>
              <div className="ps-eyebrow">Open roles</div>
              <h2 className="ps-h2">Build the layer everyone will need.</h2>
            </div>
          </Reveal>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg-elev)' }}>
            {[
              { t: 'Senior Distributed Systems Engineer', l: 'NYC · Lisbon · Remote (EU/EST)', d: 'Engineering' },
              { t: 'Founding Designer', l: 'NYC or Lisbon', d: 'Design' },
              { t: 'Forward Deployed Engineer', l: 'NYC', d: 'Engineering' },
              { t: 'Security Engineer (audit & compliance)', l: 'Remote', d: 'Engineering' },
              { t: 'Founding Account Executive', l: 'NYC', d: 'Go-to-market' },
            ].map((j, i) => (
              <div key={i} className="ps-job-row" style={{ borderBottom: i < 4 ? '1px solid var(--line-2)' : 'none' }}>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{j.t}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13.5 }}>{j.l}</div>
                <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)' }}>{j.d}</div>
                <WLButton size="sm" ghost onClick={() => openWaitlist()} label="Apply" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section tight"><div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div></section>
    </div>
  );
}

// ─── CHANGELOG PAGE ────────────────────────────────────────────────
function ChangelogPage({ openWaitlist }) {
  const entries = [
    { v: '0.7.0', d: 'Apr 14, 2026', tag: 'beta', items: ['Hybrid search GA: vector (text-embedding-3-small) + Jaccard fused via RRF', 'Analytics materialized views (5-min refresh) — workspace + skill daily stats', 'Simulation Lab: test query batches against skill corpus', 'Extraction Studio: extract skills from conversation transcripts via GPT-4o'] },
    { v: '0.6.2', d: 'Mar 28, 2026', tag: 'patch', items: ['Fix: search_method constraint violation on no_keyword_match queries', 'Override history now linked to skill versions', 'Query history: pagination cursor + escalated filter'] },
    { v: '0.6.0', d: 'Mar 12, 2026', tag: 'minor', items: ['Cohort 03 onboarding window opens', 'Skill versioning: immutable snapshots on content edits', 'Confidence percentiles (p50/p90/p99) per skill via RPC', 'EU region: data residency pinning'] },
    { v: '0.5.0', d: 'Feb 22, 2026', tag: 'minor', items: ['Skill state machine: pending_review → active → disabled', 'API key management: create, list, revoke per workspace', 'Rate limiter: 100 req/min per workspace (in-memory sliding window)'] },
    { v: '0.4.0', d: 'Feb 03, 2026', tag: 'minor', items: ['Cohort 02 onboarding', 'pgvector integration: IVFFlat index, 1536-dim embeddings', 'Hybrid search with configurable alpha (workspace setting)', 'Public docs preview'] },
  ];
  return (
    <div className="ps-page">
      <section className="ps-hero" style={{ padding: '64px 0 32px' }}>
        <div className="ps-container">
          <div className="ps-eyebrow">Changelog</div>
          <h1 className="ps-h1" style={{ fontSize: 'clamp(36px, 4.4vw, 56px)' }}>What we shipped this <em>fortnight.</em></h1>
          <p className="ps-sub">Release cadence is every two weeks during closed beta. Bigger versions land alongside cohort onboarding windows.</p>
        </div>
      </section>

      <section className="ps-section" style={{ paddingTop: 16 }}>
        <div className="ps-container" style={{ maxWidth: 880 }}>
          {entries.map((e, i) => (
            <Reveal key={i} delay={i * 50} className="ps-changelog-row" style={{ padding: '28px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>v{e.v}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 4 }}>{e.d}</div>
                <div style={{ marginTop: 10, display: 'inline-block', padding: '2px 9px', fontSize: 10.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: 999, background: e.tag === 'beta' ? 'oklch(0.96 0.04 280)' : e.tag === 'patch' ? 'var(--paper-2)' : 'oklch(0.96 0.04 80)', color: 'var(--ink-2)' }}>{e.tag}</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {e.items.map((it, j) => (
                  <li key={j} style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--ink-4)', marginTop: 5, flexShrink: 0 }}>—</span>{it}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="ps-section tight"><div className="ps-container"><CTABanner openWaitlist={openWaitlist} /></div></section>
    </div>
  );
}

window.PSPages2 = { PricingPage, DocsPage, CustomersPage, SecurityPage, CompanyPage, ChangelogPage };
})();
