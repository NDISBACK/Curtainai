/* global React, ReactDOM */
(function() {
var { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Icons ───────────────────────────────────────────────────────
const Ic = {
  arrow: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  check: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  close: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bolt: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  shield: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  graph: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>,
  layers: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  branch: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>,
  eye: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  lock: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  key: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="m18 5 3 3"/><path d="m15 8 3 3"/></svg>,
  zap: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  ext: (p) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 17L17 7"/><polyline points="7 7 17 7 17 17"/></svg>,
};

// ─── Brand mark SVG matching the dashboard aesthetic ──────────────
// Dark square with two white vertical bars — same as CSS .brand-mark
function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect width="22" height="22" rx="5" fill="var(--ink)"/>
      <rect x="5" y="5" width="4" height="12" rx="1.5" fill="#FCFBF8"/>
      <rect x="13" y="5" width="4" height="12" rx="1.5" fill="#FCFBF8"/>
    </svg>
  );
}

// ─── Reveal-on-scroll ──────────────────────────────────────────────
function Reveal({ children, delay = 0, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { setTimeout(() => setShown(true), delay); io.unobserve(el); }
      });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <Tag ref={ref} className={`ps-reveal ${shown ? 'in' : ''} ${rest.className || ''}`} {...rest}>{children}</Tag>;
}

// ─── Waitlist button ───────────────────────────────────────────────
function WLButton({ size = 'md', ghost = false, label = 'Join waitlist', onClick, fullWidth = false, style }) {
  const cls = `wl-btn ${size === 'sm' ? 'sm' : ''} ${size === 'lg' ? 'lg' : ''} ${ghost ? 'ghost' : ''}`;
  return (
    <button className={cls} onClick={onClick} style={{ ...(fullWidth ? { width: '100%', justifyContent: 'center' } : {}), ...style }}>
      {!ghost && <span className="wl-glint" />}
      <span style={{ position: 'relative' }}>{label}</span>
      <Ic.arrow className="wl-arrow" />
    </button>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────
function WaitlistModal({ open, initialEmail = '', onClose, onSubmit, submitted }) {
  const [form, setForm] = useState({ email: '', name: '', company: '', role: 'Engineering', size: '11–50' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(prev => ({ ...prev, email: initialEmail || '' }));
    setError('');
  }, [open, initialEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim(),
          company: form.company.trim(),
          role: form.role,
          size: form.size,
        }),
      });

      if (!res.ok) {
        let message = 'Could not submit. Please try again.';
        try {
          const payload = await res.json();
          if (payload?.error) message = payload.error;
        } catch (_err) {}
        throw new Error(message);
      }

      const pos = 1247 + Math.floor(Math.random() * 60);
      onSubmit({ ...form, position: pos, ts: new Date().toISOString() });
    } catch (err) {
      setError(err?.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ps-modal" onClick={onClose}>
      <div className="ps-modal-card" onClick={e => e.stopPropagation()}>
        <button className="ps-modal-close" onClick={onClose}><Ic.close /></button>
        {!submitted ? (
          <>
            <h3>Get early access</h3>
            <p className="lead">Curtain is in closed beta. Drop your details and we'll send a private invite as new cohorts open — currently every other week.</p>
            <form className="ps-modal-form" onSubmit={submit}>
              <div className="field">
                <label htmlFor="wl-email">Work email</label>
                <input id="wl-email" type="email" required placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoFocus />
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="wl-name">Name</label>
                  <input id="wl-name" type="text" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="wl-co">Company</label>
                  <input id="wl-co" type="text" placeholder="Acme" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="wl-role">Role</label>
                  <select id="wl-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option>Engineering</option>
                    <option>Product</option>
                    <option>Operations</option>
                    <option>Trust &amp; Safety</option>
                    <option>Founder / Exec</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="wl-size">Team size</label>
                  <select id="wl-size" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                    <option>1–10</option>
                    <option>11–50</option>
                    <option>51–200</option>
                    <option>201–1k</option>
                    <option>1k+</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="wl-btn lg" disabled={submitting} style={{ marginTop: 8, width: '100%', justifyContent: 'center', opacity: submitting ? 0.75 : 1 }}>
                <span className="wl-glint" />
                <span style={{ position: 'relative' }}>{submitting ? 'Submitting…' : 'Request invite'}</span>
                <Ic.arrow className="wl-arrow" />
              </button>
              {error && (
                <p style={{ margin: '8px 0 0', color: '#b42318', fontSize: 12.5 }}>
                  {error}
                </p>
              )}
              <p style={{ fontSize: 11.5, color: 'var(--ink-4)', textAlign: 'center', margin: '6px 0 0' }}>
                We'll only email about your invite. No marketing.
              </p>
            </form>
          </>
        ) : (
          <div className="ps-modal-success">
            <div className="ck-big"><Ic.check /></div>
            <h3>You're on the list</h3>
            <p>We'll send your invite to <b>{submitted.email}</b> as new cohorts open.</p>
            <div className="ps-modal-confirm">
              <div className="r"><span>Position</span><b>#{submitted.position}</b></div>
              <div className="r"><span>Cohort target</span><b>~2 weeks</b></div>
              <div className="r"><span>Reference</span><b>WL-{Math.random().toString(36).slice(2, 8).toUpperCase()}</b></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline CTA banner (footer of every page) ──────────────────────
function CTABanner({ openWaitlist }) {
  const [email, setEmail] = useState('');
  const submit = (e) => {
    e.preventDefault();
    openWaitlist(email);
  };
  return (
    <Reveal className="ps-cta">
      <div>
        <h2>Curtain is in closed beta — get an invite</h2>
        <p>We're onboarding new teams every two weeks. Tell us where to send your invite and what you're trying to ship; we'll route you to the next cohort that fits.</p>
        <form className="ps-cta-form" onSubmit={submit}>
          <input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit"><Ic.zap /> Request invite</button>
        </form>
      </div>
      <div className="ps-cta-pic">
        <div style={{ marginBottom: 8, color: 'rgba(250,250,248,0.85)' }}>What happens next</div>
        <div className="row"><Ic.check className="ck" /> Confirm by email (within 1 minute)</div>
        <div className="row"><Ic.check className="ck" /> Receive invite in next cohort window</div>
        <div className="row"><Ic.check className="ck" /> 30-min onboarding with a founder</div>
        <div className="row"><Ic.check className="ck" /> First decisions live within a week</div>
      </div>
    </Reveal>
  );
}

// ─── Tape ──────────────────────────────────────────────────────────
function Tape() {
  const items = [
    'Closed beta · cohort 04 onboarding',
    'Spring \'26',
    '5 teams in production',
    'Over 3,000 decisions reviewed',
    'Made in India',
    'SOC 2 Type II in audit',
  ];
  const all = [...items, ...items];
  return (
    <div className="ps-tape">
      <div className="ps-tape-track">
        {all.map((t, i) => <span key={i}>{t}<span className="d" /></span>)}
      </div>
    </div>
  );
}

// ─── Top nav ───────────────────────────────────────────────────────
function TopNav({ page, setPage, openWaitlist }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { id: 'home', label: 'Product' },
    { id: 'features', label: 'Features' },
    { id: 'customers', label: 'Customers' },
    { id: 'docs', label: 'Docs' },
    { id: 'security', label: 'Security' },
    { id: 'pricing', label: 'Pricing', locked: true },
    { id: 'company', label: 'Company' },
  ];
  const handleNav = (id) => { setPage(id); setMobileOpen(false); };
  return (
    <header className="ps-nav">
      <div className="ps-nav-inner">
        {/* Brand — top left */}
        <a href="#home" className="ps-brand" onClick={(e) => { e.preventDefault(); handleNav('home'); }}>
          <BrandMark size={22} />
          Curtain <small>Beta</small>
        </a>
        {/* Dashboard button — immediately after brand */}
        <a href="/app.html" className="ps-dash-btn" title="Open the real Curtain dashboard">
          Test Dashboard <Ic.arrow style={{ width: 11, height: 11 }} />
        </a>
        <nav className="ps-nav-links">
          {links.map(l => (
            <button key={l.id}
              disabled={Boolean(l.locked)}
              title={l.locked ? 'Pricing will be announced soon' : undefined}
              className={`ps-nav-link ${page === l.id ? 'active' : ''}`}
              onClick={() => handleNav(l.id)}>
              {l.locked ? <><Ic.lock style={{ width: 11, height: 11, marginRight: 5 }} />{l.label}</> : l.label}
            </button>
          ))}
        </nav>
        <div className="ps-nav-cta">
          <WLButton size="sm" onClick={() => openWaitlist()} label="Get early access" />
        </div>
        <button className="ps-burger" onClick={() => setMobileOpen(m => !m)} aria-label="Toggle menu">
          {mobileOpen
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </div>
      {mobileOpen && (
        <nav className="ps-mobile-nav ps-container">
          {links.map(l => (
            <button key={l.id}
              disabled={Boolean(l.locked)}
              className={`ps-nav-link ${page === l.id ? 'active' : ''}`}
              onClick={() => handleNav(l.id)}>
              {l.locked ? <><Ic.lock style={{ width: 11, height: 11, marginRight: 5 }} />{l.label}</> : l.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

// ─── Footer ────────────────────────────────────────────────────────
function Footer({ setPage, openWaitlist }) {
  const link = (id, txt) => <button onClick={() => setPage(id)}>{txt}</button>;
  return (
    <footer className="ps-foot">
      <div className="ps-container">
        <div className="ps-foot-grid">
          <div>
            <div className="ps-brand" style={{ marginBottom: 14 }}>
              <BrandMark size={22} />
              <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>Curtain</span>
              <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, background: 'rgba(11,13,14,0.06)', border: '1px solid rgba(11,13,14,0.08)', padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginLeft: 4 }}>Beta</small>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 16px', maxWidth: '34ch', lineHeight: 1.55 }}>
              Decision infrastructure for teams shipping AI agents. Queryable. Reviewable. Auditable.
            </p>
            <WLButton size="sm" ghost onClick={() => openWaitlist()} label="Join waitlist" />
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li>{link('features', 'Features')}</li>
              <li>{link('home', 'How it works')}</li>
              <li><button disabled title="Pricing will be announced soon"><Ic.lock style={{ width: 11, height: 11, marginRight: 6 }} />Pricing</button></li>
              <li>{link('customers', 'Customer stories')}</li>
              <li>{link('changelog', 'Changelog')}</li>
            </ul>
          </div>
          <div>
            <h5>Resources</h5>
            <ul>
              <li>{link('docs', 'Documentation')}</li>
              <li>{link('security', 'Security')}</li>
              <li>{link('docs', 'API reference')}</li>
              <li><a href="/app.html">Dashboard</a></li>
              <li>{link('changelog', 'Release notes')}</li>
            </ul>
          </div>
          <div>
            <h5>Company</h5>
            <ul>
              <li>{link('company', 'About')}</li>
              <li>{link('company', 'Careers')}</li>
              <li>{link('company', 'Press')}</li>
              <li><button onClick={() => openWaitlist()}>Contact</button></li>
            </ul>
          </div>
        </div>
        <div className="ps-foot-bottom">
          <div>© Curtain Labs, Inc. — closed beta · v0.7</div>
          <div className="right">
            <a>Privacy</a>
            <a>Terms</a>
            <a href="/app.html">Dashboard<Ic.ext style={{ marginLeft: 4 }} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

window.PSCommon = { Ic, BrandMark, Reveal, WLButton, WaitlistModal, CTABanner, Tape, TopNav, Footer };
})();
