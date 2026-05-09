// Curtain — LiveFeedPage (real-time decision stream)

const MAX_DECISIONS = 100;
const ROLLING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const confColor = (conf, escalated) => {
  if (escalated) return 'var(--danger)';
  if (conf == null) return 'var(--ink-4)';
  if (conf >= 0.85) return 'var(--success)';
  if (conf >= 0.65) return 'var(--warning)';
  return 'var(--danger)';
};

const ConfDot = ({ conf, escalated }) => (
  <span style={{
    display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
    background: confColor(conf, escalated), flexShrink: 0,
    boxShadow: `0 0 0 2.5px oklch(from ${confColor(conf, escalated)} l c h / 0.25)`,
  }} />
);

const LiveFeedPage = () => {
  const [decisions, setDecisions] = React.useState([]);
  const [connected, setConnected] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const pausedRef = React.useRef(false);
  const bufferRef = React.useRef([]);
  const readerRef = React.useRef(null);

  const pushDecision = React.useCallback((d) => {
    setDecisions(prev => {
      const next = [d, ...prev];
      return next.length > MAX_DECISIONS ? next.slice(0, MAX_DECISIONS) : next;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let reader = null;

    const connect = async () => {
      setErr(null);
      setConnected(false);
      try {
        const res = await fetch('/api/v1/stream/decisions', {
          headers: { 'Authorization': `Bearer ${window.api._key}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        setConnected(true);

        reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              const d = JSON.parse(raw);
              if (pausedRef.current) {
                bufferRef.current.push(d);
              } else {
                pushDecision(d);
              }
            } catch {}
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setConnected(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      reader?.cancel().catch(() => {});
      setConnected(false);
    };
  }, [pushDecision]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    if (!next && bufferRef.current.length > 0) {
      // Flush buffered decisions
      const buffered = bufferRef.current.splice(0);
      setDecisions(prev => {
        const next2 = [...buffered.reverse(), ...prev];
        return next2.length > MAX_DECISIONS ? next2.slice(0, MAX_DECISIONS) : next2;
      });
    }
  };

  // Rolling stats (last 5 min)
  const now = Date.now();
  const recent = decisions.filter(d => {
    const age = now - new Date(d.created_at).getTime();
    return age <= ROLLING_WINDOW_MS;
  });
  const matchRate = recent.length > 0
    ? Math.round((recent.filter(d => !d.escalated).length / recent.length) * 100)
    : null;
  const escalCount = recent.filter(d => d.escalated).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Live Decision Stream
            {connected && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, color: 'var(--success)',
                background: 'oklch(from var(--success) l c h / 0.12)',
                borderRadius: 20, padding: '3px 10px',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)',
                  animation: 'skel 1s ease-in-out infinite alternate' }}/>
                LIVE
              </span>
            )}
            {!connected && !err && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-4)' }}>Connecting…</span>
            )}
          </h1>
          <p className="page-sub">Every AI decision as it happens — color-coded by confidence. Run a query to see it appear here.</p>
        </div>
        <button className={`btn ${paused ? 'primary' : ''}`} onClick={togglePause}>
          {paused
            ? <><Icon name="refresh" size={13} /> Resume {bufferRef.current.length > 0 ? `(+${bufferRef.current.length})` : ''}</>
            : <><Icon name="pause" size={13} /> Pause</>}
        </button>
      </div>

      {err && <ErrorAlert message={err} />}

      {/* Rolling stats */}
      <div className="metric-grid" style={{ marginBottom: 18 }}>
        {[
          { label: 'Decisions (5 min)', value: fmt(recent.length), sub: 'rolling window' },
          {
            label: 'Match rate',
            value: matchRate != null ? `${matchRate}%` : '—',
            sub: 'queries resolved by AI',
            color: matchRate != null ? (matchRate >= 70 ? 'var(--success)' : matchRate >= 50 ? 'var(--warning)' : 'var(--danger)') : undefined,
          },
          { label: 'Escalations', value: fmt(escalCount), sub: 'in last 5 min',
            color: escalCount > 0 ? 'var(--danger)' : undefined },
          { label: 'Total shown', value: fmt(decisions.length), sub: `last ${MAX_DECISIONS} decisions` },
        ].map((m, i) => (
          <div key={i} className="metric">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-meta"><span>{m.sub}</span></div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--success)', label: 'High confidence (≥85%)' },
          { color: 'var(--warning)', label: 'Fair confidence (65–84%)' },
          { color: 'var(--danger)', label: 'Low confidence / escalated' },
        ].map((l, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
        {paused && bufferRef.current.length > 0 && (
          <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
            ⏸ {bufferRef.current.length} decision{bufferRef.current.length !== 1 ? 's' : ''} buffered
          </span>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 10 }}></th>
              <th>Query</th>
              <th>Skill matched</th>
              <th style={{ width: 90 }}>Confidence</th>
              <th style={{ width: 80 }}>Method</th>
              <th style={{ width: 80 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {decisions.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-4)', fontSize: 13 }}>
                  {connected
                    ? 'Waiting for decisions… Run a query via the Query Console or API to see it appear here in real time.'
                    : 'Connecting to stream…'}
                </td>
              </tr>
            )}
            {decisions.map((d, i) => (
              <tr key={d.id || i} style={{ animation: i === 0 ? 'fadeInUp 200ms both' : 'none' }}>
                <td style={{ verticalAlign: 'middle' }}>
                  <ConfDot conf={d.confidence} escalated={d.escalated} />
                </td>
                <td style={{ maxWidth: 320 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)' }}>
                    "{d.input}"
                  </div>
                  {d.escalated && (
                    <span className="badge escalate" style={{ fontSize: 10, marginTop: 2 }}>
                      <span className="dot" /> Escalated
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 13, color: d.skill_name ? 'var(--ink)' : 'var(--ink-4)' }}>
                  {d.skill_name ?? <em>No match</em>}
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: confColor(d.confidence, d.escalated), fontWeight: 600 }}>
                    {d.confidence != null ? `${Math.round(d.confidence * 100)}%` : '—'}
                  </span>
                </td>
                <td>
                  <span className="badge mono" style={{ fontSize: 10 }}>
                    {d.search_method?.replace('_', ' ') ?? '—'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  {fmtRelative(d.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { LiveFeedPage });
