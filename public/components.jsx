// Curtain — shared UI components

const Icon = ({ name, size = 16, stroke = 1.6, style: extraStyle }) => {
  const s = { width: size, height: size, strokeWidth: stroke, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', ...extraStyle };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    skills: <><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/><path d="m9 12 2 2 4-4"/></>,
    test: <><path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3"/><path d="M7 3h10"/></>,
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
    sources: <><path d="M4 5v14a2 2 0 0 0 2 2h12V3H6a2 2 0 0 0-2 2Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <><path d="m5 12 5 5L20 6"/></>,
    x: <><path d="M6 6l12 12M18 6 6 18"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    chevrondown: <><path d="m6 9 6 6 6-6"/></>,
    filter: <><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    bolt: <><path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/></>,
    brain: <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 3 3 0 0 0 3-2"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3 3 3 0 0 1-3-2"/><path d="M12 5v15"/></>,
    sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l4 4M14.5 14.5l4 4M5.5 18.5l4-4M14.5 9.5l4-4"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/></>,
    branch: <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M6 12c0-2 2-4 4-4h6"/></>,
    mssg: <><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/></>,
    arrowdown: <><path d="M12 5v14M6 13l6 6 6-6"/></>,
    arrowup: <><path d="M12 19V5M6 11l6-6 6 6"/></>,
    flag: <><path d="M4 21V4M4 4h13l-2 4 2 4H4"/></>,
    check2: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>,
    refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
    enter: <><path d="M9 10h11V5"/><path d="m4 14 5 5 5-5"/><path d="M9 19V10"/></>,
    key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3M17 6l3 3"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>,
    wand: <><path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 3.43L9.6 10.1"/><path d="m11.2 9.6-4.3 4.7c-.7.6-.5 1.7.5 2.2l7.1 3.2c.8.4 1.8 0 2.1-.8l2.3-5.4c.3-.8-.1-1.7-.9-2l-3.5-1.3"/><path d="M15 5c-1 3-5 3-7 6"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    extract: <><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></>,
    simulate: <><rect x="2" y="6" width="8" height="12" rx="1.5"/><rect x="14" y="6" width="8" height="12" rx="1.5"/><path d="M10 12h4"/><path d="M13 10l2 2-2 2"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/></>,
    mcp: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></>,
  };
  return <svg viewBox="0 0 24 24" {...s}>{paths[name] || null}</svg>;
};

const Sparkline = ({ data, w = 64, h = 28, color = 'var(--ink-3)' }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Confidence = ({ value, showNum = true, width = 60 }) => {
  if (value == null) return <span className="mono" style={{ color: 'var(--ink-4)' }}>—</span>;
  const pct = Math.round(value * 100);
  const cls = pct >= 85 ? 'high' : pct >= 70 ? 'mid' : 'low';
  return (
    <div className="conf">
      <div className={`conf-bar ${cls}`} style={{ width }}><span style={{ width: `${pct}%` }}></span></div>
      {showNum && <span>{pct}%</span>}
    </div>
  );
};

const Ring = ({ value, size = 92 }) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (value ?? 0));
  const color = value >= 0.85 ? 'var(--success)' : value >= 0.7 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="ring-label">{value == null ? '—' : `${Math.round(value * 100)}`}</div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active: { cls: 'active', label: 'Active' },
    pending_review: { cls: 'pending', label: 'Pending' },
    disabled: { cls: 'disabled', label: 'Disabled' },
  };
  const m = map[status] || map.disabled;
  return <span className={`badge ${m.cls}`}><span className="dot"></span>{m.label}</span>;
};

const Sidebar = ({ page, setPage, workspace, skillCount, pendingCount }) => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'skills', label: 'Skills', icon: 'skills', count: skillCount },
    { id: 'extraction', label: 'Extraction Studio', icon: 'sparkle' },
    { id: 'connections', label: 'Connections', icon: 'branch' },
    { id: 'mcp', label: 'MCP Console', icon: 'mcp' },
    { id: 'simulation', label: 'Simulation Lab', icon: 'simulate' },
    { id: 'test', label: 'Query Console', icon: 'bolt' },
    { id: 'live', label: 'Live Feed', icon: 'bolt' },
    { id: 'activity', label: 'Activity', icon: 'activity' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
  ];
  const more = [
    { id: 'docs',     label: 'Python SDK Docs', icon: 'book' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const wsShort = workspace?.id ? workspace.id.slice(0, 8) : '…';
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"></div>
        <div className="brand-name">Curtain</div>
        <div className="brand-ws" title={workspace?.id}>{wsShort}</div>
      </div>
      <div className="nav-section">
        <div className="nav-label">Workspace</div>
        {items.map(it => (
          <button key={it.id} className={`nav-item ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
            <span className="nav-icon"><Icon name={it.icon} size={15} /></span>
            <span>{it.label}</span>
            {it.count != null && <span className="nav-count">{it.count}</span>}
          </button>
        ))}
      </div>
      <div className="nav-section">
        <div className="nav-label">Config</div>
        {more.map(it => (
          <button key={it.id} className={`nav-item ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
            <span className="nav-icon"><Icon name={it.icon} size={15} /></span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="avatar">{(workspace?.name || 'WS').slice(0, 2).toUpperCase()}</div>
        <div className="user-meta">
          <span className="user-name">{workspace?.name || 'Workspace'}</span>
          <span className="user-role">Production</span>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ crumb, workspace }) => (
  <div className="topbar">
    <div className="topbar-crumb">
      <span>{workspace?.name || 'Curtain'}</span>
      {crumb && <><span className="sep">/</span><span style={{ color: 'var(--ink)' }}>{crumb}</span></>}
    </div>
    <div className="topbar-actions">
      <div className="topbar-search">
        <Icon name="search" size={14} />
        <span>Search skills, queries…</span>
        <kbd>⌘K</kbd>
      </div>
    </div>
  </div>
);

const SkeletonRow = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i}><div className="skel" style={{ height: 14, width: `${60 + Math.random() * 30}%` }}></div></td>
    ))}
  </tr>
);

const ErrorAlert = ({ message, onRetry }) => (
  <div className="alert err" style={{ marginBottom: 20 }}>
    <Icon name="x" size={14} />
    <div style={{ flex: 1 }}>
      {message}
      {onRetry && <button className="btn sm" style={{ marginLeft: 12 }} onClick={onRetry}>Retry</button>}
    </div>
  </div>
);

// Confirm delete / action modal
const ConfirmModal = ({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head">
        <div className="modal-title">{title}</div>
        <button className="btn ghost sm" onClick={onCancel}><Icon name="x" size={14} /></button>
      </div>
      <div className="modal-body">
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14 }}>{message}</p>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const fmtRelative = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
};

Object.assign(window, { Icon, Sparkline, Confidence, Ring, StatusBadge, Sidebar, Topbar, SkeletonRow, ErrorAlert, ConfirmModal, fmtDate, fmtRelative });
