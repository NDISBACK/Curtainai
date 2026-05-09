// Curtain — Python SDK Documentation Page

// ─── Reusable doc primitives ──────────────────────────────────────────────────

const CodeBlock = ({ code, lang = 'python', label }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <div className="doc-code">
      <div className="doc-code-head">
        <span>{label || lang}</span>
        <button className="btn ghost sm" onClick={copy}>
          <Icon name={copied ? 'check2' : 'copy'} size={11} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="doc-code-body">{code.trim()}</pre>
    </div>
  );
};

const ParamTable = ({ rows }) => (
  <table className="doc-table" style={{ marginTop: 12 }}>
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Type</th>
        <th>Default</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(([name, type, def, desc]) => (
        <tr key={name}>
          <td>{name}</td>
          <td className="td-type">{type}</td>
          <td className="td-default">{def}</td>
          <td className="td-desc">{desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const FieldTable = ({ rows }) => (
  <table className="doc-table" style={{ marginTop: 12 }}>
    <thead>
      <tr><th>Field</th><th>Type</th><th>Description</th></tr>
    </thead>
    <tbody>
      {rows.map(([name, type, desc]) => (
        <tr key={name}>
          <td>{name}</td>
          <td className="td-type">{type}</td>
          <td className="td-desc">{desc}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Returns = ({ type }) => (
  <div className="doc-returns">
    <span className="doc-returns-label">Returns</span>
    <span className="doc-returns-type">{type}</span>
  </div>
);

const MethodBar = ({ sig }) => (
  <div className="doc-method-bar">
    <span dangerouslySetInnerHTML={{ __html: sig }} />
  </div>
);

const Note = ({ children, warn }) => (
  <div className={`doc-note${warn ? ' warn' : ''}`}>
    <Icon name={warn ? 'flag' : 'sparkle'} size={14} style={{ flexShrink: 0, marginTop: 1 }} />
    <span>{children}</span>
  </div>
);

const IC = ({ children }) => (
  <code className="doc-inline-code">{children}</code>
);

// ─── TOC data ─────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: 'install',     label: 'Installation' },
  { id: 'quickstart',  label: 'Quick Start' },
  { id: 'config',      label: 'Configuration' },
  { id: 'clients',     label: 'Clients' },
  { id: 'res-queries',    label: 'queries',    sub: true },
  { id: 'res-skills',     label: 'skills',     sub: true },
  { id: 'res-simulation', label: 'simulation', sub: true },
  { id: 'res-extraction', label: 'extraction', sub: true },
  { id: 'res-workspaces', label: 'workspaces', sub: true },
  { id: 'res-analytics',  label: 'analytics',  sub: true },
  { id: 'models',      label: 'Models' },
  { id: 'pagination',  label: 'Pagination' },
  { id: 'errors',      label: 'Error Handling' },
  { id: 'examples',    label: 'Examples' },
];

// ─── DocsPage ─────────────────────────────────────────────────────────────────

const DocsPage = () => {
  const [active, setActive] = React.useState('install');

  React.useEffect(() => {
    const els = document.querySelectorAll('.doc-section, .doc-sub');
    if (!els.length) return;
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.id) setActive(e.target.id);
        }
      },
      { rootMargin: '-8% 0px -86% 0px', threshold: 0 }
    );
    els.forEach(el => el.id && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Python SDK</h1>
          <p className="page-sub">Reference documentation for the <IC>curtain-ai</IC> package — v0.1.0 · Python 3.9+</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge accent mono">v0.1.0</span>
          <span className="badge mono">Python 3.9+</span>
        </div>
      </div>

      <div className="doc-layout">

        {/* ── Left TOC ── */}
        <nav className="doc-toc">
          <div className="doc-toc-label">On this page</div>
          {TOC_ITEMS.map((item, i) => {
            const prev = TOC_ITEMS[i - 1];
            const showSep = !item.sub && prev?.sub;
            return (
              <React.Fragment key={item.id}>
                {showSep && <div className="doc-toc-sep" />}
                <button
                  className={`doc-toc-item${item.sub ? ' toc-sub' : ''}${active === item.id ? ' toc-active' : ''}`}
                  onClick={() => scrollTo(item.id)}
                >
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div>

          {/* Installation */}
          <section id="install" className="doc-section">
            <h2 className="doc-h2">Installation</h2>
            <p className="doc-lead">Install via pip. No additional configuration is required beyond a valid API key.</p>
            <CodeBlock lang="bash" code={`pip install curtain-ai`} />
            <p className="doc-p">For development or running examples directly from the repo:</p>
            <CodeBlock lang="bash" code={`cd sdk/python\npip install -e ".[dev]"`} />
            <FieldTable rows={[
              ['requests ≥ 2.31', 'sync HTTP transport', ''],
              ['httpx ≥ 0.27',    'async HTTP transport', ''],
              ['pydantic ≥ 2.0',  'model validation',     ''],
            ]} />
          </section>

          {/* Quick Start */}
          <section id="quickstart" className="doc-section">
            <h2 className="doc-h2">Quick Start</h2>
            <p className="doc-lead">Two lines to run your first decision query.</p>
            <CodeBlock lang="python" code={`from curtain import CurtainClient

client = CurtainClient(
    api_key="cai_<64 hex chars>",   # or set CURTAIN_API_KEY env var
    workspace_id="<workspace-uuid>",
)

result = client.queries.run("Customer was double-charged in April")

if result.escalate:
    route_to_human(result.query_id)         # no skill matched
else:
    send_reply(result.decision)              # auto-resolved
    print(f"Confidence: {result.confidence:.0%}")`} />

            <h3 className="doc-h3">Async (FastAPI / aiohttp)</h3>
            <CodeBlock lang="python" code={`import asyncio
from curtain import AsyncCurtainClient

async def main():
    async with AsyncCurtainClient(
        api_key="cai_...",
        workspace_id="<workspace-uuid>",
    ) as client:
        result = await client.queries.run("Refund for duplicate charge")
        print(result.decision)

asyncio.run(main())`} />
          </section>

          {/* Configuration */}
          <section id="config" className="doc-section">
            <h2 className="doc-h2">Configuration</h2>
            <p className="doc-lead">All parameters can be supplied as constructor arguments or environment variables. The constructor argument takes precedence.</p>
            <table className="doc-table">
              <thead>
                <tr><th>Parameter</th><th>Env variable</th><th>Default</th><th>Description</th></tr>
              </thead>
              <tbody>
                {[
                  ['api_key',      'CURTAIN_API_KEY',       '—',                                  'Required. Format: cai_ + 64 hex chars'],
                  ['workspace_id', 'CURTAIN_WORKSPACE_ID',  'None',                               'Default workspace UUID (optional, can be passed per-call)'],
                  ['base_url',     'CURTAIN_BASE_URL',       'http://localhost:3000/api/v1',       'Override for staging / production'],
                  ['timeout',      '—',                      '30.0',                               'Per-request timeout in seconds'],
                ].map(([p, e, d, desc]) => (
                  <tr key={p}>
                    <td>{p}</td>
                    <td className="td-type">{e}</td>
                    <td className="td-default">{d}</td>
                    <td className="td-desc">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <CodeBlock lang="bash" label="environment" code={`export CURTAIN_API_KEY=cai_abc123...
export CURTAIN_WORKSPACE_ID=550e8400-e29b-41d4-a716-446655440000
export CURTAIN_BASE_URL=https://api.curtainai.com/api/v1`} />
            <Note>API key format is <IC>cai_</IC> followed by exactly 64 lowercase hex characters. A <IC>ConfigurationError</IC> is raised at construction if the format is wrong — no network call is made.</Note>
          </section>

          {/* Clients */}
          <section id="clients" className="doc-section">
            <h2 className="doc-h2">Clients</h2>
            <p className="doc-lead">Two client classes are provided — sync and async. Both expose the same six resource namespaces.</p>

            <h3 className="doc-h3">CurtainClient (sync)</h3>
            <p className="doc-p">Backed by <IC>requests.Session</IC>. Thread-safe; the session is connection-pooled and reused across all calls.</p>
            <CodeBlock lang="python" code={`from curtain import CurtainClient

# Basic
client = CurtainClient(api_key="cai_...", workspace_id="ws-uuid")

# As context manager (auto-closes session on exit)
with CurtainClient(api_key="cai_...") as client:
    skills = list(client.skills.iter(status="active"))

# Manual close
client = CurtainClient(api_key="cai_...")
try:
    result = client.queries.run("...")
finally:
    client.close()`} />

            <h3 className="doc-h3">AsyncCurtainClient (async)</h3>
            <p className="doc-p">Backed by <IC>httpx.AsyncClient</IC>. All resource methods are coroutines — remember to <IC>await</IC> them. Always use as an async context manager to ensure connection cleanup.</p>
            <CodeBlock lang="python" code={`from curtain import AsyncCurtainClient

async with AsyncCurtainClient(api_key="cai_...", workspace_id="ws-uuid") as client:
    result = await client.queries.run("Customer query here")

# Manual lifecycle
client = AsyncCurtainClient(api_key="cai_...")
result = await client.queries.run("...")
await client.aclose()`} />

            <p className="doc-p" style={{ marginTop: 16 }}>Both clients expose:</p>
            <FieldTable rows={[
              ['client.queries',    'QueriesResource',    'Run decisions, browse history, submit overrides'],
              ['client.skills',     'SkillsResource',     'CRUD, state machine, versions, analytics'],
              ['client.simulation', 'SimulationResource', 'What-if testing against historical traffic'],
              ['client.extraction', 'ExtractionResource', 'Extract skills from conversation transcripts'],
              ['client.workspaces', 'WorkspacesResource', 'Workspace lifecycle and API key management'],
              ['client.analytics',  'AnalyticsResource',  'Workspace-level aggregated metrics'],
            ]} />
          </section>

          <hr className="doc-divider" />
          <h2 className="doc-h2" style={{ marginBottom: 8, marginTop: 56 }}>Resources</h2>
          <p className="doc-lead">Each resource is accessed as a property of the client. Async mirrors have identical signatures with <IC>async def</IC> methods.</p>

          {/* queries */}
          <div id="res-queries" className="doc-sub" style={{ marginTop: 32 }}>
            <div className="doc-res-intro">
              <Icon name="bolt" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.queries</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Run the decision engine against your active skill set</span>
              <span className="doc-res-path">POST /query · GET /queries</span>
            </div>

            <h3 className="doc-h3">run(query)</h3>
            <p className="doc-p">Route a customer message through the active skill set. The engine embeds the query, runs hybrid search (Jaccard + vector), and uses an LLM to select the best match.</p>
            <CodeBlock lang="python" code={`result = client.queries.run("Customer was charged twice for their subscription")

result.query_id      # str  — UUID for this query
result.decision      # str | None  — decision text (None if escalated)
result.confidence    # float | None  — 0.0–1.0 (None if escalated)
result.escalate      # bool  — True when no skill matched
result.resolved      # bool  — convenience: not escalate
result.skill_id      # str | None  — matched skill UUID
result.search_method # str | None  — "hybrid" | "jaccard_only" | "no_keyword_match"`} />
            <Returns type="QueryResult" />
            <ParamTable rows={[['query', 'str', '—', 'Natural-language description of the customer\'s situation']]} />

            <h3 className="doc-h3">list(…)</h3>
            <p className="doc-p">Fetch one page of historical query records.</p>
            <CodeBlock lang="python" code={`records = client.queries.list(
    from_="2024-01-01T00:00:00Z",
    to="2024-01-31T23:59:59Z",
    escalated=True,         # True = only escalated, False = only matched
    skill_id="skill-uuid",  # filter by matched skill
    page=1, limit=20,
)`} />
            <Returns type="List[QueryRecord]" />

            <h3 className="doc-h3">iter(…)</h3>
            <p className="doc-p">Lazy iterator — fetches pages on demand. Accepts the same filters as <IC>list()</IC> plus <IC>page_size</IC>.</p>
            <CodeBlock lang="python" code={`for record in client.queries.iter(escalated=True, page_size=50):
    review_and_override(record)`} />

            <h3 className="doc-h3">override(query_id, corrected_decision)</h3>
            <p className="doc-p">Submit a human-reviewed correction. Stored and may auto-generate a new <IC>pending_review</IC> skill.</p>
            <CodeBlock lang="python" code={`override = client.queries.override(
    "qr-uuid",
    "Issue a full refund and send a 10% discount code.",
)
print(override.id, override.corrected_decision)`} />
            <Returns type="Override" />
          </div>

          {/* skills */}
          <div id="res-skills" className="doc-sub">
            <div className="doc-res-intro">
              <Icon name="skills" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.skills</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>CRUD · state machine · versions · analytics</span>
              <span className="doc-res-path">GET/POST/PATCH/DELETE /skills</span>
            </div>

            <p className="doc-p">Skills have a three-state lifecycle. Editing content fields on an <IC>active</IC> skill automatically resets it to <IC>pending_review</IC> and writes a version snapshot.</p>
            <CodeBlock lang="python" label="state machine" code={`pending_review  ──approve()──▶  active  ──disable()──▶  disabled
                                                               │
disabled  ◀──enable()──────────────────────────────────────────┘`} />

            <h3 className="doc-h3">create(…)</h3>
            <CodeBlock lang="python" code={`skill = client.skills.create(
    name="Duplicate Charge Refund",
    trigger_condition="Customer was charged twice for the same order",
    decision="Verify the duplicate, issue a full refund, and send confirmation.",
    escalation_required=False,  # optional
)
# Always starts in pending_review — call approve() before it matches queries`} />
            <Returns type="Skill" />
            <Note warn>Raises <IC>DuplicateSkillError</IC> (409) if a semantically similar skill already exists.</Note>

            <h3 className="doc-h3">State transitions</h3>
            <CodeBlock lang="python" code={`skill = client.skills.approve("skill-uuid")   # pending_review → active
skill = client.skills.disable("skill-uuid")   # active → disabled
skill = client.skills.enable("skill-uuid")    # disabled → pending_review`} />

            <h3 className="doc-h3">list(…) &amp; iter(…)</h3>
            <CodeBlock lang="python" code={`# One page
skills = client.skills.list(status="active", page=1, limit=50)

# All pages lazily
for skill in client.skills.iter(status="active"):
    print(skill.name)

# Page by page (bulk ops)
for page in client.skills.iter(status="pending_review").pages():
    bulk_notify_reviewers(page)`} />

            <h3 className="doc-h3">export(…) &amp; import_skills(…)</h3>
            <CodeBlock lang="python" code={`from curtain import ImportSkillPayload

# Export in four formats
functions = client.skills.export(format="openai_functions")
tools     = client.skills.export(format="mcp_tools")
lc_tools  = client.skills.export(format="langchain")

# Bulk import
result = client.skills.import_skills([
    ImportSkillPayload(
        name="Password Reset",
        trigger_condition="Customer forgot their password",
        decision="Send a reset link to the verified email address.",
    ),
])
print(f"{result.created} created, {result.skipped_duplicates} duplicates skipped")`} />

            <h3 className="doc-h3">Version history</h3>
            <CodeBlock lang="python" code={`versions = client.skills.get_versions("skill-uuid")
for v in versions:
    print(f"v{v.version}  {v.created_at.date()}  {v.trigger_condition[:60]}")

# Restore a previous version as a new pending_review skill
restored = client.skills.restore_version("skill-uuid", version=1)
client.skills.approve(restored.id)`} />

            <h3 className="doc-h3">get_analytics(…)</h3>
            <CodeBlock lang="python" code={`stats = client.skills.get_analytics(
    "skill-uuid",
    from_="2024-01-01T00:00:00Z",
    to="2024-01-31T23:59:59Z",
)
print(f"p50 confidence: {stats.confidence_distribution.p50:.2f}")
print(f"p99 confidence: {stats.confidence_distribution.p99:.2f}")`} />
            <Returns type="SkillAnalytics" />
          </div>

          {/* simulation */}
          <div id="res-simulation" className="doc-sub">
            <div className="doc-res-intro">
              <Icon name="simulate" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.simulation</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>What-if testing · fully read-only</span>
              <span className="doc-res-path">POST /simulate</span>
            </div>
            <p className="doc-p">Replay historical queries through a modified skill set and get a before/after comparison. No skills are modified and no queries are stored.</p>

            <h3 className="doc-h3">run(simulation_skills, *, query_ids, sample_size)</h3>
            <CodeBlock lang="python" code={`from curtain import SimulationSkillInput

modified = SimulationSkillInput(
    id="existing-skill-uuid",   # replaces this skill in the test
    name="Refund Policy v2",
    trigger_condition="Customer requests refund for any charge",
    decision="Issue refund within 12 hours and send confirmation email.",
)

result = client.simulation.run([modified], sample_size=200)

print(f"Queries tested:    {result.total_queries}")
print(f"Decisions changed: {result.changed_decisions}  ({result.change_rate:.1%})")
print(f"Coverage gain:    +{result.impact_summary.escalate_to_auto}")
print(f"Coverage loss:    -{result.impact_summary.auto_to_escalate}")
print(f"Net coverage:      {result.impact_summary.net_coverage:+d}")`} />
            <Returns type="SimulationResult" />
            <ParamTable rows={[
              ['simulation_skills', 'List[SimulationSkillInput]', '—',    'Skills to test. If id matches an existing active skill it replaces it; otherwise it is added alongside existing actives'],
              ['query_ids',         'List[str] | None',           'None', 'Test against specific historical query UUIDs (overrides sample_size)'],
              ['sample_size',       'int',                        '100',  'Number of recent queries to sample (1–500). Ignored when query_ids is provided'],
            ]} />
          </div>

          {/* extraction */}
          <div id="res-extraction" className="doc-sub">
            <div className="doc-res-intro">
              <Icon name="sparkle" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.extraction</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Extract skills from conversation transcripts</span>
              <span className="doc-res-path">POST /extract</span>
            </div>
            <p className="doc-p">Extracted skills are <strong>not persisted automatically</strong> — call <IC>skills.create()</IC> and <IC>skills.approve()</IC> for each one you want to keep.</p>

            <h3 className="doc-h3">extract(conversation)</h3>
            <CodeBlock lang="python" code={`transcript = """
Agent: Hi, how can I help?
Customer: I was charged twice for my subscription last month.
Agent: I can see the duplicate — issuing a refund now.
"""

skills = client.extraction.extract(transcript)
for skill in skills:
    print(skill.name, "— confidence:", skill.confidence)
    new = client.skills.create(
        name=skill.name,
        trigger_condition=skill.trigger_condition,
        decision=skill.decision,
    )
    client.skills.approve(new.id)`} />
            <Returns type="List[ExtractedSkill]" />
            <ParamTable rows={[['conversation', 'str', '—', 'Raw conversation text. Max 50,000 characters']]} />
          </div>

          {/* workspaces */}
          <div id="res-workspaces" className="doc-sub">
            <div className="doc-res-intro">
              <Icon name="settings" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.workspaces</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Workspace lifecycle · API key management</span>
              <span className="doc-res-path">GET/POST/PATCH/DELETE /workspaces</span>
            </div>

            <h3 className="doc-h3">create(name)</h3>
            <p className="doc-p">Does not require authentication — this is the bootstrap endpoint.</p>
            <CodeBlock lang="python" code={`ws = client.workspaces.create("Acme Support")
print(ws.id, ws.settings.top_k)  # 3 (default)`} />

            <h3 className="doc-h3">update(workspace_id, *, name, settings)</h3>
            <CodeBlock lang="python" code={`ws = client.workspaces.update(
    "ws-uuid",
    name="Acme Support (Production)",
    settings={
        "top_k": 5,
        "hybrid_alpha": 0.7,     # 0=keyword-only, 1=vector-only
        "duplicate_threshold": 0.8,
    },
)`} />

            <h3 className="doc-h3">API key management</h3>
            <CodeBlock lang="python" code={`# Create — raw key returned ONCE, save it immediately
created = client.workspaces.create_api_key(
    "ws-uuid", "ci-key", expires_at="2025-12-31T23:59:59Z"
)
print(created.key)   # "cai_<64hex>" — shown once only

# List (no raw values returned)
keys = client.workspaces.list_api_keys("ws-uuid")
for k in keys:
    print(k.name, k.is_active)

# Revoke (irreversible)
client.workspaces.revoke_api_key("ws-uuid", "key-uuid")`} />
          </div>

          {/* analytics */}
          <div id="res-analytics" className="doc-sub">
            <div className="doc-res-intro">
              <Icon name="chart" size={15} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: 14 }}>client.analytics</strong>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Aggregated workspace-level metrics</span>
              <span className="doc-res-path">GET /workspaces/:id/analytics</span>
            </div>

            <h3 className="doc-h3">get_workspace(workspace_id, *, from_, to)</h3>
            <CodeBlock lang="python" code={`from datetime import datetime, timedelta, timezone

now = datetime.now(tz=timezone.utc)
stats = client.analytics.get_workspace(
    "ws-uuid",
    from_=(now - timedelta(days=7)).isoformat(),
    to=now.isoformat(),
)

print(f"Match rate:      {stats.match_rate:.1%}")
print(f"Escalation rate: {stats.escalation_rate:.1%}")
print(f"Avg confidence:  {stats.avg_confidence:.2f}")

for skill in stats.top_skills[:5]:
    print(f"  {skill.skill_name}: {skill.match_count} matches")`} />
            <Returns type="WorkspaceAnalytics" />
            <p className="doc-p" style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>Both <IC>from_</IC> and <IC>to</IC> are optional — omitting both returns all-time totals.</p>
          </div>

          {/* Models */}
          <hr className="doc-divider" />
          <section id="models" className="doc-section" style={{ marginTop: 56 }}>
            <h2 className="doc-h2">Models</h2>
            <p className="doc-lead">All response models are immutable (<IC>frozen=True</IC>) and forward-compatible (<IC>extra="allow"</IC>). Input models (<IC>SimulationSkillInput</IC>, <IC>ImportSkillPayload</IC>) are mutable.</p>

            <h3 className="doc-h3">QueryResult</h3>
            <FieldTable rows={[
              ['query_id',      'str',          'UUID of this query'],
              ['decision',      'str | None',   'Decision text (None when escalated)'],
              ['confidence',    'float | None', 'Match confidence 0–1 (None when escalated)'],
              ['escalate',      'bool',         'True when no skill matched'],
              ['skill_id',      'str | None',   'Matched skill UUID'],
              ['skill_name',    'str | None',   'Matched skill name'],
              ['search_method', 'str | None',   '"hybrid", "jaccard_only", "no_keyword_match"'],
              ['resolved ⁽¹⁾',  'bool',         'Property: not escalate'],
            ]} />

            <h3 className="doc-h3">Skill</h3>
            <FieldTable rows={[
              ['id',                  'str',        'UUID'],
              ['name',                'str',        'Human-readable name'],
              ['trigger_condition',   'str | None', 'Natural-language trigger'],
              ['decision',            'str | None', 'Decision text'],
              ['status',              'SkillStatus','pending_review · active · disabled'],
              ['version',             'int',        'Current snapshot version'],
              ['escalation_required', 'bool',       'Always escalate when matched'],
              ['confidence',          'float | None','Confidence threshold hint'],
              ['is_active ⁽¹⁾',       'bool',       'Property: status == "active"'],
              ['is_pending ⁽¹⁾',      'bool',       'Property: status == "pending_review"'],
              ['is_disabled ⁽¹⁾',     'bool',       'Property: status == "disabled"'],
            ]} />

            <h3 className="doc-h3">SimulationResult</h3>
            <FieldTable rows={[
              ['total_queries',      'int',                     'Queries replayed'],
              ['changed_decisions',  'int',                     'Queries with different outcome'],
              ['unchanged',          'int',                     'Queries with identical outcome'],
              ['impact_summary',     'SimulationImpactSummary', 'Change type breakdown'],
              ['top_impacted_skills','List[TopImpactedSkill]',  'Most-affected skills'],
              ['examples',           'List[SimulationExample]', 'Before/after query pairs'],
              ['change_rate ⁽¹⁾',    'float',                   'Property: changed / total'],
            ]} />

            <h3 className="doc-h3">SimulationImpactSummary</h3>
            <FieldTable rows={[
              ['auto_to_escalate', 'int',   'Coverage loss — was resolving, now escalates'],
              ['escalate_to_auto', 'int',   'Coverage gain — was escalating, now resolves'],
              ['decision_changed', 'int',   'Same outcome type, different decision text'],
              ['confidence_shift', 'float', 'Mean confidence delta across changed queries'],
              ['net_coverage ⁽¹⁾',  'int',   'Property: escalate_to_auto − auto_to_escalate'],
            ]} />

            <h3 className="doc-h3">CreatedApiKey</h3>
            <FieldTable rows={[
              ['id',          'str',           'Key UUID (use this to revoke)'],
              ['name',        'str',           'Human-readable label'],
              ['key',         'str',           'Raw cai_<64hex> — returned once only, never stored server-side'],
              ['key_prefix',  'str',           'First characters for identification'],
              ['expires_at',  'datetime|None', 'Expiry time (None = never expires)'],
              ['revoked_at',  'datetime|None', 'Revocation time (None = still active)'],
              ['is_active ⁽¹⁾','bool',         'Property: not revoked and not expired'],
            ]} />
            <p className="doc-p" style={{ fontSize: 12, color: 'var(--ink-4)' }}>⁽¹⁾ Computed property — not a stored field.</p>
          </section>

          {/* Pagination */}
          <section id="pagination" className="doc-section">
            <h2 className="doc-h2">Pagination</h2>
            <p className="doc-lead">List endpoints expose both a single-page <IC>list()</IC> and a lazy <IC>iter()</IC> method. Iterators fetch the next page automatically as items are consumed.</p>

            <CodeBlock lang="python" code={`# Single page — you manage page numbers
page = client.skills.list(status="active", page=2, limit=50)

# Lazy item-by-item iterator (recommended for large datasets)
for skill in client.skills.iter(status="active", page_size=50):
    process(skill)

# Page-by-page — good for bulk operations
for page in client.skills.iter(status="active").pages():
    bulk_index(page)

# Async
async for skill in client.skills.iter(status="active"):
    await process(skill)

async for page in client.skills.iter().apages():
    await bulk_index(page)`} />

            <FieldTable rows={[
              ['SyncPaginator[T]',   '__iter__, pages()',          'Sync lazy iterator'],
              ['AsyncPaginator[T]',  '__aiter__, apages()',        'Async lazy iterator'],
            ]} />
          </section>

          {/* Error Handling */}
          <section id="errors" className="doc-section">
            <h2 className="doc-h2">Error Handling</h2>
            <p className="doc-lead">Every non-2xx response is mapped to a typed exception. Catch broadly with <IC>CurtainError</IC> or narrow to specific subclasses.</p>

            <div className="exc-tree">
              <div><span className="exc-base">CurtainError</span><span className="exc-http">  base class for all SDK errors</span></div>
              <div>├── <span className="exc-name">ConfigurationError</span><span className="exc-http">  bad api_key format or base_url</span></div>
              <div>├── <span className="exc-name">TransportError</span><span className="exc-http">  network failure, timeout, DNS error</span></div>
              <div>└── <span className="exc-name">APIError</span><span className="exc-http">  any non-2xx from server</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">AuthenticationError</span><span className="exc-http">  401</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">PermissionError</span><span className="exc-http">  403</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">NotFoundError</span><span className="exc-http">  404</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">ValidationError</span><span className="exc-http">  400</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">DuplicateSkillError</span><span className="exc-http">  409</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">UnprocessableError</span><span className="exc-http">  422</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span className="exc-name">RateLimitError</span><span className="exc-http">  429  (raised after all retries exhausted)</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;└── <span className="exc-name">ServerError</span><span className="exc-http">  500/502/503</span></div>
            </div>

            <h3 className="doc-h3">Example handler</h3>
            <CodeBlock lang="python" code={`import time
from curtain.exceptions import (
    AuthenticationError, RateLimitError,
    NotFoundError, TransportError, ServerError, CurtainError,
)

try:
    result = client.queries.run(user_message)

except AuthenticationError:
    raise RuntimeError("API key invalid — regenerate from the dashboard.")

except RateLimitError as e:
    # SDK retried automatically — all attempts exhausted
    time.sleep(e.retry_after or 60)
    result = client.queries.run(user_message)

except TransportError as e:
    # Server never reached — network issue
    result = fallback_response()

except ServerError as e:
    # Log correlation_id for support lookup
    log.error(f"Server error [{e.correlation_id}]: {e.message}")
    result = fallback_response()

except CurtainError as e:
    log.error(f"Curtain error {e.http_status}: {e.message}")`} />

            <h3 className="doc-h3">Exception attributes</h3>
            <FieldTable rows={[
              ['message',        'str',          'All',           'Human-readable error description'],
              ['http_status',    'int | None',   'APIError',      'HTTP status code'],
              ['correlation_id', 'str | None',   'APIError',      'Server-side trace ID for support'],
              ['retry_after',    'float | None', 'RateLimitError','Suggested wait time in seconds'],
            ].map(([f, t, on, d]) => [f, t, d])} />

            <h3 className="doc-h3">Retry behaviour</h3>
            <p className="doc-p">The SDK automatically retries on transient failures with exponential back-off before raising.</p>
            <table className="doc-table">
              <thead><tr><th>Status</th><th>Retried?</th><th>Back-off</th></tr></thead>
              <tbody>
                {[
                  ['429 Rate Limited',           'Yes', '1s → 2s → 4s  (or Retry-After header)'],
                  ['500/502/503 Server Error',   'Yes', '1s → 2s → 4s'],
                  ['4xx (except 429)',           'No',  'Raises immediately'],
                  ['Network / timeout',          'No',  'Raises TransportError immediately'],
                ].map(([s, r, b]) => (
                  <tr key={s}>
                    <td>{s}</td>
                    <td className="td-type">{r}</td>
                    <td className="td-desc">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Examples */}
          <section id="examples" className="doc-section">
            <h2 className="doc-h2">Examples</h2>
            <p className="doc-lead">Full end-to-end patterns for the most common integration scenarios. Runnable examples are in <IC>sdk/python/examples/</IC>.</p>

            <h3 className="doc-h3">1 — Bootstrap a new workspace</h3>
            <CodeBlock lang="python" code={`from curtain import CurtainClient

bootstrap = CurtainClient(api_key="cai_" + "0" * 64)
ws = bootstrap.workspaces.create("Acme Support")

key = bootstrap.workspaces.create_api_key(ws.id, "primary")
print(f"Workspace: {ws.id}")
print(f"API key:   {key.key}")   # save this — shown only once

import os
os.environ["CURTAIN_API_KEY"] = key.key
os.environ["CURTAIN_WORKSPACE_ID"] = ws.id`} />

            <h3 className="doc-h3">2 — Chatbot handler (FastAPI / async)</h3>
            <CodeBlock lang="python" code={`import os
from curtain import AsyncCurtainClient
from curtain.exceptions import CurtainError

client = AsyncCurtainClient(
    api_key=os.environ["CURTAIN_API_KEY"],
    workspace_id=os.environ["CURTAIN_WORKSPACE_ID"],
)

async def handle_message(session_id: str, text: str) -> dict:
    try:
        result = await client.queries.run(text)
    except CurtainError:
        return {"reply": "I'm having trouble right now.", "escalated": True}

    if result.escalate:
        await queue_for_human(session_id, text, result.query_id)
        return {
            "reply": f"An agent will follow up. Ref: {result.query_id[:8].upper()}",
            "escalated": True,
        }
    return {"reply": result.decision, "escalated": False, "confidence": result.confidence}

# @app.on_event("shutdown")
# async def shutdown(): await client.aclose()`} />

            <h3 className="doc-h3">3 — Simulation deploy gate</h3>
            <CodeBlock lang="python" code={`from curtain import CurtainClient, SimulationSkillInput

client = CurtainClient(api_key=os.environ["CURTAIN_API_KEY"])
SKILL_ID = "your-skill-uuid"
MAX_REGRESSIONS = 5

proposed = SimulationSkillInput(
    id=SKILL_ID,
    name="Refund Policy v3",
    trigger_condition="Customer requests refund for any charge",
    decision="Issue refund within 6 hours.",
)

result = client.simulation.run([proposed], sample_size=500)
loss = result.impact_summary.auto_to_escalate

if loss > MAX_REGRESSIONS:
    print(f"REJECTED — {loss} regressions exceed threshold {MAX_REGRESSIONS}")
else:
    client.skills.update(SKILL_ID,
        trigger_condition=proposed.trigger_condition,
        decision=proposed.decision)
    client.skills.approve(SKILL_ID)
    print(f"Deployed. Net coverage: {result.impact_summary.net_coverage:+d}")`} />

            <h3 className="doc-h3">4 — Extract skills from ticket export</h3>
            <CodeBlock lang="python" code={`from curtain.exceptions import DuplicateSkillError

tickets = load_zendesk_export("tickets.json")
imported = 0

for ticket in tickets[:50]:
    extracted = client.extraction.extract(ticket["conversation"])
    for skill in extracted:
        if skill.confidence < 0.7:
            continue
        try:
            new = client.skills.create(
                name=skill.name,
                trigger_condition=skill.trigger_condition,
                decision=skill.decision,
            )
            client.skills.approve(new.id)
            imported += 1
        except DuplicateSkillError:
            pass   # already covered by an existing skill

print(f"Imported {imported} new skills")`} />

            <h3 className="doc-h3">5 — Weekly analytics report</h3>
            <CodeBlock lang="python" code={`from datetime import datetime, timedelta, timezone

now = datetime.now(tz=timezone.utc)
stats = client.analytics.get_workspace(
    os.environ["CURTAIN_WORKSPACE_ID"],
    from_=(now - timedelta(days=7)).isoformat(),
    to=now.isoformat(),
)

print(f"=== Last 7 days ===")
print(f"Total queries:   {stats.total_queries:,}")
print(f"Match rate:      {stats.match_rate:.1%}")
print(f"Escalation rate: {stats.escalation_rate:.1%}")
print(f"Avg confidence:  {stats.avg_confidence:.2f}")
print()
print("Top skills:")
for s in stats.top_skills[:5]:
    print(f"  {s.skill_name:<40} {s.match_count:>4} matches")`} />

            <h3 className="doc-h3">Running the test suite</h3>
            <CodeBlock lang="bash" code={`cd sdk/python
pip install -e ".[dev]"
pytest tests/ -v        # 32 tests, mocked HTTP — no live server needed`} />
          </section>

        </div>{/* end doc-content */}
      </div>{/* end doc-layout */}
    </div>
  );
};

Object.assign(window, { DocsPage });
