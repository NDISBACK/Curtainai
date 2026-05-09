// Curtain — root App

const TWEAKS_DEFAULTS = {
  accentHue: 280,
  density: 'comfortable',
  consoleTheme: 'dark',
  showSparklines: true,
};

// ─── Setup / Auth screen ──────────────────────────────────────────────────────
const SetupScreen = ({ onConnected }) => {
  const [apiKey, setApiKey] = React.useState('');
  const [wsId, setWsId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const connect = async () => {
    if (!apiKey.trim() || !wsId.trim()) {
      setErr('Both fields are required.');
      return;
    }
    setLoading(true);
    setErr(null);
    window.api.configure(apiKey.trim(), wsId.trim());
    try {
      const ws = await window.api.getWorkspace();
      onConnected(ws);
    } catch (e) {
      window.api.clearConfig();
      setErr(e.status === 401 || e.status === 403
        ? 'Invalid API key or workspace ID.'
        : e.message || 'Could not connect.');
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen">
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div className="setup-logo">
          <div className="brand-mark"></div>
          <div className="brand-name" style={{ fontSize: 17 }}>Curtain</div>
        </div>
        <h2 className="setup-title">Connect your workspace</h2>
        <p className="setup-sub">Enter your workspace ID and API key to get started. You can find these after running the bootstrap script.</p>

        <div className="setup-field">
          <label className="setup-label">Workspace ID</label>
          <input className="setup-input" type="text" placeholder="xxxxxxxx-xxxx-…"
            value={wsId} onChange={e => setWsId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()} />
        </div>
        <div className="setup-field">
          <label className="setup-label">API Key</label>
          <input className="setup-input" type="password" placeholder="cai_…"
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()} />
        </div>

        {err && <div className="setup-err">{err}</div>}

        <button className="btn primary" style={{ width: '100%', marginTop: 20, justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
          onClick={connect} disabled={loading}>
          {loading ? 'Connecting…' : 'Connect workspace'}
        </button>

        <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink-2)' }}>First time?</strong> Run <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--line)', padding: '1px 5px', borderRadius: 3 }}>npx tsx scripts/bootstrap-workspace.ts "Your Company"</code> to create a workspace and API key.
        </div>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [workspace, setWorkspace] = React.useState(null);
  const [connected, setConnected] = React.useState(false);
  const [page, setPage] = React.useState('dashboard');
  const [skillId, setSkillId] = React.useState(null);
  const [activityFocus, setActivityFocus] = React.useState(null);
  const [skillCount, setSkillCount] = React.useState(null);
  const [tweaks, setTweak] = useTweaks(TWEAKS_DEFAULTS);

  // Apply tweaks live
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', `oklch(0.55 0.18 ${tweaks.accentHue})`);
    document.documentElement.style.setProperty('--accent-soft', `oklch(0.96 0.03 ${tweaks.accentHue})`);
    document.documentElement.style.setProperty('--accent-ink', `oklch(0.42 0.20 ${tweaks.accentHue})`);
    document.body.dataset.density = tweaks.density;
    document.body.dataset.console = tweaks.consoleTheme;
  }, [tweaks]);

  // Check if already configured
  React.useEffect(() => {
    if (window.api.isConfigured) {
      window.api.getWorkspace()
        .then(ws => { setWorkspace(ws); setConnected(true); })
        .catch(() => { window.api.clearConfig(); });
    }
  }, []);

  // Detect return from Gmail OAuth callback (?connected=gmail)
  React.useEffect(() => {
    if (!connected) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      goto('connections');
      window.history.replaceState({}, '', '/app.html');
    }
  }, [connected]);

  // Load skill count for sidebar badge
  React.useEffect(() => {
    if (!connected) return;
    window.api.listSkills({ limit: 200 })
      .then(sk => setSkillCount(sk.length))
      .catch(() => {});
  }, [connected]);

  const goto = (p, focus) => {
    setPage(p);
    if (p === 'activity' && focus) setActivityFocus(focus);
    if (p !== 'skill') setSkillId(null);
  };
  const openSkill = (id) => { setSkillId(id); setPage('skill'); };

  if (!connected) {
    return <SetupScreen onConnected={ws => { setWorkspace(ws); setConnected(true); }} />;
  }

  const navPage = page === 'skill' ? 'skills' : page;
  const crumbMap = {
    dashboard: 'Dashboard', skills: 'Skills', skill: 'Skills',
    test: 'Query Console', activity: 'Activity', settings: 'Settings',
    extraction: 'Extraction Studio', analytics: 'Analytics',
    simulation: 'Simulation Lab', docs: 'Python SDK Docs',
    connections: 'Connections',
    live: 'Live Feed',
  };
  const crumb = crumbMap[page] || page;

  let body;
  if (page === 'dashboard') body = <Dashboard goto={goto} openSkill={openSkill} workspace={workspace} />;
  else if (page === 'skills') body = <SkillsPage openSkill={openSkill} />;
  else if (page === 'skill') body = <SkillDetail id={skillId} back={() => goto('skills')} />;
  else if (page === 'test') body = <QueryConsole openSkill={openSkill} goto={goto} />;
  else if (page === 'activity') body = <ActivityPage initialId={activityFocus} openSkill={openSkill} goto={goto} />;
  else if (page === 'settings') body = <SettingsPage workspace={workspace} onWorkspaceUpdated={ws => setWorkspace(ws)} />;
  else if (page === 'extraction') body = <ExtractionStudio goto={goto} />;
  else if (page === 'analytics') body = <AnalyticsPage goto={goto} />;
  else if (page === 'simulation') body = <SimulationPage />;
  else if (page === 'connections') body = <ConnectionsPage goto={goto} />;
  else if (page === 'live') body = <LiveFeedPage />;
  else if (page === 'docs') body = <DocsPage />;
  else body = null;

  return (
    <div className="app">
      <Sidebar page={navPage} setPage={goto} workspace={workspace} skillCount={skillCount} />
      <div className="main">
        <Topbar crumb={crumb} workspace={workspace} />
        {body}
      </div>

      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Accent">
          <TweakSlider label="Hue" value={tweaks.accentHue} min={0} max={360} step={1}
            onChange={v => setTweak('accentHue', v)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[{n:'violet',h:280},{n:'indigo',h:265},{n:'blue',h:240},{n:'teal',h:200},{n:'green',h:150},{n:'amber',h:80}].map(p => (
              <button key={p.n} onClick={() => setTweak('accentHue', p.h)}
                style={{ width: 22, height: 22, borderRadius: 6, border: tweaks.accentHue===p.h?'2px solid var(--ink)':'1px solid var(--line)', background: `oklch(0.55 0.18 ${p.h})`, cursor: 'pointer' }}
                title={p.n} />
            ))}
          </div>
        </TweakSection>
        <TweakSection title="Density">
          <TweakRadio value={tweaks.density} options={[['compact','Compact'],['comfortable','Comfy']]}
            onChange={v => setTweak('density', v)} />
        </TweakSection>
        <TweakSection title="Console theme">
          <TweakRadio value={tweaks.consoleTheme} options={[['dark','Dark'],['light','Light']]}
            onChange={v => setTweak('consoleTheme', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
