// Curtain — MCP Console page

const McpConsolePage = ({ goto }) => {
  const mcpUrl = window.location.origin + '/mcp/v1';
  const apiKey = window.api._key || '';
  const maskedKey = apiKey ? apiKey.slice(0, 7) + '…' + apiKey.slice(-4) : '—';

  // ── State ──────────────────────────────────────────────────────────────────
  const [serverStatus, setServerStatus] = React.useState('checking'); // checking | live | error
  const [tools, setTools] = React.useState([]);
  const [toolsLoading, setToolsLoading] = React.useState(true);
  const [expandedTool, setExpandedTool] = React.useState(null);
  const [queries, setQueries] = React.useState([]);
  const [queriesLoading, setQueriesLoading] = React.useState(true);
  const [queryFilter, setQueryFilter] = React.useState('all'); // all | resolved | escalated
  const [testInput, setTestInput] = React.useState('');
  const [testLoading, setTestLoading] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);
  const [testRawReq, setTestRawReq] = React.useState(null);
  const [testRawRes, setTestRawRes] = React.useState(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const [snippetTab, setSnippetTab] = React.useState('python');
  const [copied, setCopied] = React.useState(null); // key of what was copied

  // ── Load on mount ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    checkServer();
    loadTools();
    loadQueries();
  }, []);

  const checkServer = async () => {
    setServerStatus('checking');
    try {
      const resp = await window.api.mcpCall('initialize');
      setServerStatus(resp.result ? 'live' : 'error');
    } catch (_) {
      setServerStatus('error');
    }
  };

  const loadTools = async () => {
    setToolsLoading(true);
    try {
      const data = await window.api.exportSkills('mcp_tools', 'active');
      setTools(Array.isArray(data) ? data : []);
    } catch (_) {
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  const loadQueries = async () => {
    setQueriesLoading(true);
    try {
      const res = await window.api.listQueries({ limit: 25 });
      setQueries(res.data || []);
    } catch (_) {
      setQueries([]);
    } finally {
      setQueriesLoading(false);
    }
  };

  // ── Test console ───────────────────────────────────────────────────────────
  const runTest = async () => {
    if (!testInput.trim() || testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    setShowRaw(false);

    const reqPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'curtain_decision', arguments: { customer_query: testInput.trim() } },
    };
    setTestRawReq(reqPayload);

    try {
      const resp = await window.api.mcpCall('tools/call', reqPayload.params);
      setTestRawRes(resp);
      if (resp.result) {
        setTestResult(resp.result);
      } else {
        setTestResult({ error: resp.error?.message || 'Unknown error' });
      }
    } catch (e) {
      setTestResult({ error: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  // ── Copy helper ────────────────────────────────────────────────────────────
  const copy = (key, text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(c => c === key ? null : c), 1500);
  };

  // ── Filtered queries ───────────────────────────────────────────────────────
  const filteredQueries = queries.filter(q => {
    if (queryFilter === 'resolved') return !q.escalated;
    if (queryFilter === 'escalated') return q.escalated;
    return true;
  });

  // ── Code snippets (key auto-populated) ────────────────────────────────────
  const snippets = {
    python: `import requests

# Discover your tool library
tools_resp = requests.post(
    "${mcpUrl}",
    headers={"Authorization": "Bearer ${apiKey}", "Content-Type": "application/json"},
    json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
)
tools = tools_resp.json()["result"]["tools"]
print(f"{len(tools)} tools available")

# Route a customer message
resp = requests.post(
    "${mcpUrl}",
    headers={"Authorization": "Bearer ${apiKey}", "Content-Type": "application/json"},
    json={
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {
            "name": "curtain_decision",
            "arguments": {"customer_query": "I was charged twice this month"},
        },
    },
)
result = resp.json()["result"]
decision   = result["content"][0]["text"]
escalate   = result["metadata"]["escalate"]
confidence = result["metadata"]["confidence"]

if escalate:
    route_to_human(decision)
else:
    send_to_customer(decision)  # confidence: {confidence}`,

    nodejs: `// Discover your tool library
const listResp = await fetch("${mcpUrl}", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
const { result: { tools } } = await listResp.json();
console.log(\`\${tools.length} tools available\`);

// Route a customer message
const resp = await fetch("${mcpUrl}", {
  method: "POST",
  headers: { "Authorization": "Bearer ${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: {
      name: "curtain_decision",
      arguments: { customer_query: "I was charged twice this month" },
    },
  }),
});
const { result } = await resp.json();
const decision   = result.content[0].text;
const escalate   = result.metadata.escalate;
const confidence = result.metadata.confidence;

if (escalate) routeToHuman(decision);
else sendToCustomer(decision);`,

    claude: `// claude_desktop_config.json
// Place this file at:
//   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
//   Windows: %APPDATA%\\Claude\\claude_desktop_config.json

{
  "mcpServers": {
    "curtain": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}

// After saving, restart Claude Desktop.
// Your Curtain skills will appear as tools in every conversation.`,

    curl: `# Handshake
curl -s -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | jq .result.serverInfo

# List tools
curl -s -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq '[.result.tools[].name]'

# Route a query
curl -s -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{
      "name":"curtain_decision",
      "arguments":{"customer_query":"I was charged twice this month"}
    }
  }' | jq '{decision: .result.content[0].text, escalate: .result.metadata.escalate}'`,
  };

  // ── Export tools JSON ──────────────────────────────────────────────────────
  const exportToolsJson = () => {
    const blob = new Blob([JSON.stringify(tools, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curtain-mcp-tools.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const StatusPill = () => {
    const map = {
      checking: { color: 'var(--ink-4)', bg: 'var(--bg-subtle)', dot: 'var(--ink-4)', label: 'Checking…' },
      live:     { color: 'var(--success)', bg: 'var(--success-soft)', dot: 'var(--success)', label: 'Live' },
      error:    { color: 'var(--danger)', bg: 'var(--danger-soft)', dot: 'var(--danger)', label: 'Unreachable' },
    };
    const s = map[serverStatus];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: s.color, background: s.bg, borderRadius: 6, padding: '3px 9px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }}></span>
        {s.label}
      </span>
    );
  };

  const CopyBtn = ({ id, text, label = 'Copy' }) => (
    <button className="btn ghost sm" onClick={() => copy(id, text)} style={{ fontSize: 12, gap: 5 }}>
      <Icon name={copied === id ? 'check' : 'copy'} size={12} />
      {copied === id ? 'Copied!' : label}
    </button>
  );

  const CodeBlock = ({ code, id }) => (
    <div style={{ position: 'relative' }}>
      <pre style={{ background: 'var(--ink)', color: '#e8e6e0', borderRadius: 10, padding: '16px 18px', fontFamily: 'var(--font-mono)', fontSize: 12.5, overflowX: 'auto', margin: 0, lineHeight: 1.65, whiteSpace: 'pre' }}>{code}</pre>
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <CopyBtn id={id} text={code} />
      </div>
    </div>
  );

  const infoRowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-2)' };
  const infoLabelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--ink-4)', width: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' };
  const infoValueStyle = { fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  const filterBtnStyle = (active) => ({
    padding: '4px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: 'none',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--ink-3)',
  });

  const tabStyle = (active) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
    background: active ? 'var(--bg-elev)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-3)',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  });

  return (
    <div className="page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <h1 className="page-title">MCP Console</h1>
          <p className="page-sub">Connect any AI agent to your skill library via the Model Context Protocol.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusPill />
          <button className="btn ghost sm" onClick={() => { checkServer(); loadTools(); loadQueries(); }}>
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── A: Connection info card ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-title">Connection Details</div>
          <StatusPill />
        </div>
        <div className="card-body">
          <div style={{ ...infoRowStyle }}>
            <div style={infoLabelStyle}>Endpoint</div>
            <div style={infoValueStyle}>{mcpUrl}</div>
            <CopyBtn id="endpoint" text={mcpUrl} />
          </div>
          <div style={{ ...infoRowStyle }}>
            <div style={infoLabelStyle}>Protocol</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', flex: 1 }}>2024-11-05 (JSON-RPC 2.0)</div>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <div style={infoLabelStyle}>Auth Header</div>
            <div style={infoValueStyle}>Authorization: Bearer {maskedKey}</div>
            <CopyBtn id="authheader" text={`Authorization: Bearer ${apiKey}`} />
            <CopyBtn id="apikey" text={apiKey} label="Copy key" />
          </div>
        </div>
      </div>

      {/* ── B: Test console + Tool library ─────────────────────────────────── */}
      <div className="dash-main-grid" style={{ marginBottom: 22 }}>

        {/* Left: Live test console */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Live Test Console</div>
            <span className="card-sub">Send a real JSON-RPC tools/call request</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <textarea
                rows={3}
                placeholder="Type a customer message to test — e.g. &quot;I was charged twice this month&quot;"
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runTest(); }}
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div className="field-hint">Press ⌘↵ to send</div>
            </div>
            <button className="btn accent" onClick={runTest} disabled={testLoading || !testInput.trim()} style={{ alignSelf: 'flex-start' }}>
              {testLoading ? 'Calling tool…' : <><Icon name="mcp" size={13} /> Send to MCP</>}
            </button>

            {testResult && !testResult.error && (() => {
              const content = testResult.content?.[0]?.text || '—';
              const meta    = testResult.metadata || {};
              const esc     = testResult.isError || meta.escalate;
              return (
                <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Confidence value={meta.confidence} width={80} />
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 5,
                      background: esc ? 'var(--danger-soft)' : 'var(--success-soft)',
                      color: esc ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {esc ? '↑ ESCALATE' : '✓ AUTO-RESOLVE'}
                    </span>
                    {meta.skill_id && (
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                        skill: {meta.skill_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={() => setShowRaw(v => !v)}>
                    <Icon name={showRaw ? 'chevrondown' : 'chevron'} size={12} />
                    {showRaw ? 'Hide' : 'Show'} raw JSON-RPC
                  </button>
                  {showRaw && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Request</div>
                      <CodeBlock code={JSON.stringify(testRawReq, null, 2)} id="rawreq" />
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Response</div>
                      <CodeBlock code={JSON.stringify(testRawRes, null, 2)} id="rawres" />
                    </div>
                  )}
                </div>
              );
            })()}

            {testResult?.error && (
              <div className="alert err" style={{ margin: 0 }}>
                <Icon name="x" size={14} /> {testResult.error}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tool library */}
        <div className="card">
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-title">
                Tool Library
                {!toolsLoading && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--ink-4)' }}>{tools.length} active</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn ghost sm" onClick={loadTools}><Icon name="refresh" size={12} /></button>
              {tools.length > 0 && (
                <button className="btn ghost sm" onClick={exportToolsJson}>
                  <Icon name="arrowdown" size={12} /> Export JSON
                </button>
              )}
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            {toolsLoading && (
              <table className="table"><tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={1} />)}</tbody></table>
            )}
            {!toolsLoading && tools.length === 0 && (
              <div className="empty" style={{ padding: 24 }}>
                No active skills. <button className="btn ghost sm" onClick={() => goto('skills')}>Go to Skills →</button>
              </div>
            )}
            {!toolsLoading && tools.map((t, i) => {
              const hasEscalation = t.description?.includes('Requires escalation');
              const isOpen = expandedTool === i;
              const trigger = t.description?.split('\n')[0] || '';
              return (
                <div key={i} style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <button
                    onClick={() => setExpandedTool(isOpen ? null : i)}
                    style={{ width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'transparent', border: 'none', cursor: 'pointer', padding: '10px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</span>
                        {hasEscalation && <span className="badge" style={{ fontSize: 10.5, background: 'var(--warning-soft)', color: 'var(--warning)' }}>Escalates</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trigger}</div>
                    </div>
                    <Icon name="chevron" size={12} style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: '120ms', color: 'var(--ink-4)', marginTop: 3, flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 18px 14px', background: 'var(--accent-soft)' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.6 }}>{t.description}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Input Schema</div>
                      <CodeBlock code={JSON.stringify(t.inputSchema, null, 2)} id={`schema-${i}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── C: Quick-start snippets ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div className="card-title">Quick-Start Integration</div>
          <span className="card-sub">Copy-paste code to connect your AI agent in minutes</span>
        </div>
        <div className="card-body" style={{ gap: 16 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-subtle)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
            {[['python','Python'],['nodejs','Node.js'],['claude','Claude Desktop'],['curl','curl']].map(([id, label]) => (
              <button key={id} style={tabStyle(snippetTab === id)} onClick={() => setSnippetTab(id)}>{label}</button>
            ))}
          </div>
          <CodeBlock code={snippets[snippetTab]} id={`snippet-${snippetTab}`} />
        </div>
      </div>

      {/* ── D: Recent activity ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title">Recent Query Activity</div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-subtle)', borderRadius: 6, padding: 3 }}>
            {[['all','All'],['resolved','Auto-resolved'],['escalated','Escalated']].map(([id, label]) => (
              <button key={id} style={filterBtnStyle(queryFilter === id)} onClick={() => setQueryFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th style={{ width: '40%' }}>Query</th>
              <th>Skill matched</th>
              <th>Confidence</th>
              <th>Routing</th>
            </tr>
          </thead>
          <tbody>
            {queriesLoading && <SkeletonRow cols={5} />}
            {!queriesLoading && filteredQueries.length === 0 && (
              <tr><td colSpan={5} className="empty">
                {queryFilter === 'all'
                  ? 'No queries yet. Use the test console above to make your first call.'
                  : `No ${queryFilter} queries in this range.`}
              </td></tr>
            )}
            {!queriesLoading && filteredQueries.map(q => {
              const trace = q.output || {};
              const skillName = trace.pipeline?.candidates_evaluated?.find(c => c.skill_id === q.matched_skill_id)?.name || null;
              return (
                <tr key={q.id}>
                  <td style={{ fontSize: 12, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{fmtRelative(q.created_at)}</td>
                  <td style={{ maxWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{q.input}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {skillName
                      ? <span className="mono" style={{ fontSize: 12 }}>{skillName}</span>
                      : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                  </td>
                  <td><Confidence value={q.confidence} /></td>
                  <td>
                    {q.escalated
                      ? <span className="badge escalate" style={{ fontSize: 11 }}><span className="dot"></span>Escalate</span>
                      : <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>✓ Resolved</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
