/* global React, ReactDOM, PSCommon, PSPages1, PSPages2 */
(function() {
var { useState, useEffect } = React;

const App = () => {
  const { Tape, TopNav, Footer, WaitlistModal } = PSCommon;
  const { HomePage, FeaturesPage } = PSPages1;
  const { PricingPage, DocsPage, CustomersPage, SecurityPage, CompanyPage, ChangelogPage } = PSPages2;

  const validPages = ['home','features','docs','customers','security','company','changelog'];

  const [page, setPageRaw] = useState(() => {
    const h = (window.location.hash || '#home').replace('#', '');
    return h && validPages.includes(h) ? h : 'home';
  });

  const setPage = (p) => {
    setPageRaw(p);
    window.history.replaceState(null, '', '#' + p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const [modal, setModal] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [initialEmail, setInitialEmail] = useState('');
  const openWaitlist = (email = '') => {
    setInitialEmail(typeof email === 'string' ? email.trim() : '');
    setSubmitted(null);
    setModal(true);
  };
  const closeWaitlist = () => setModal(false);

  useEffect(() => {
    const onPop = () => {
      const h = (window.location.hash || '#home').replace('#', '');
      if (h && validPages.includes(h)) setPageRaw(h);
    };
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
  }, []);

  useEffect(() => {
    const titles = {
      home:      'Curtain — AI Agent Decision Management & Governance Platform',
      features:  'Features — AI Agent Policy Enforcement & Audit Trail | Curtain',
      docs:      'API Documentation — AI Agent Decision Infrastructure | Curtain',
      customers: 'Customer Stories — AI Agent Governance in Production | Curtain',
      security:  'Security & Compliance — SOC 2, GDPR, HIPAA | Curtain',
      company:   'About Curtain — Decision Infrastructure for AI Agents',
      changelog: 'Changelog — Curtain AI Agent Governance Platform',
    };
    document.title = titles[page] || titles.home;
  }, [page]);

  return (
    <div className="ps">
      <TopNav page={page} setPage={setPage} openWaitlist={openWaitlist} />
      {page === 'home'      && <HomePage      openWaitlist={openWaitlist} setPage={setPage} />}
      {page === 'features'  && <FeaturesPage  openWaitlist={openWaitlist} setPage={setPage} />}
      {page === 'docs'      && <DocsPage      openWaitlist={openWaitlist} />}
      {page === 'customers' && <CustomersPage openWaitlist={openWaitlist} />}
      {page === 'security'  && <SecurityPage  openWaitlist={openWaitlist} />}
      {page === 'company'   && <CompanyPage   openWaitlist={openWaitlist} />}
      {page === 'changelog' && <ChangelogPage openWaitlist={openWaitlist} />}
      <Footer setPage={setPage} openWaitlist={openWaitlist} />
      <WaitlistModal
        open={modal}
        initialEmail={initialEmail}
        onClose={closeWaitlist}
        onSubmit={(d) => setSubmitted(d)}
        submitted={submitted}
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
