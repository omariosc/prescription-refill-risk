import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import LandingPage from './components/LandingPage';
import RiskAssessment from './components/RiskAssessment';
import ProcessingOverlay from './components/ProcessingOverlay';
import ResultsTable from './components/ResultsTable';
import DetailPanel from './components/DetailPanel';
import AdminPanel from './components/AdminPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SupplyChainDashboard from './components/SupplyChainDashboard';
import UnsupportedOverlay from './components/UnsupportedOverlay';
import NotificationManager, { notify } from './components/NotificationManager';
import { getInterventionLabel, getInterventionColor, INTERVENTION_MESSAGES } from './components/InterventionPanel';
import { sendNotification, pollEvents } from './utils/api';
import PatientApp from './components/PatientApp';
import PatientDesktopGate from './components/PatientDesktopGate';
import PendingApprovalPage from './components/PendingApprovalPage';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [analyticsView, setAnalyticsView] = useState(false);
  const [supplyChainView, setSupplyChainView] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [forceMobile, setForceMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const alertSinceRef = useRef('2026-01-01');

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clinician: WebSocket for instant alerts + polling fallback
  useEffect(() => {
    if (!user || user.role === 'patient') return;
    let active = true;
    let ws = null;
    let reconnectTimer = null;

    // WebSocket for instant clinician alerts
    const connectWs = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'clinician_alert' && msg.data) {
              notify(msg.data.message, '#3b82f6', 'fact_check');
            }
          } catch {}
        };
        ws.onclose = () => { reconnectTimer = setTimeout(connectWs, 2000); };
        ws.onerror = () => { ws.close(); };
      } catch {}
    };
    connectWs();

    // Polling fallback (slower, catches anything WebSocket missed)
    const poll = async () => {
      if (!active) return;
      try {
        const data = await pollEvents(alertSinceRef.current);
        if (!data || !active) return;
        if (data.server_time) alertSinceRef.current = data.server_time;
        if (data.clinician_alerts && data.clinician_alerts.length > 0) {
          for (const alert of data.clinician_alerts) {
            notify(alert.message, '#3b82f6', 'fact_check');
          }
        }
      } catch {}
    };
    const interval = setInterval(poll, 5000);

    return () => {
      active = false;
      clearInterval(interval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  const handleResults = (data) => {
    setProcessing(false);
    setResults(data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setResults(null);
    setProcessing(false);
    setProgressData(null);
  };

  const handleLogout = async () => {
    await logout();
    setShowLogin(false);
    setShowRegister(false);
    setShowPendingApproval(false);
    setResults(null);
    setProcessing(false);
    setShowAdmin(false);
    setAnalyticsView(false);
    setSupplyChainView(false);
    setShowLanding(false);
    setForceMobile(false);
  };

  const goToLanding = () => {
    setShowLogin(false);
    setShowRegister(false);
    setShowPendingApproval(false);
  };

  // Not logged in
  if (!user) {
    return (
      <>
        <UnsupportedOverlay />
        <Header
          user={null}
          onLoginClick={() => { setShowLogin(true); setShowRegister(false); }}
          onLogout={handleLogout}
          onHomeClick={goToLanding}
        />
        {(showLogin || showRegister || showPendingApproval) && (
          <div className="disc-bar">
            <strong>Synthetic Data Demo</strong> — Modelling &amp; product-thinking exercise using CMS DE-SynPUF synthetic claims data. Outputs are <strong>not clinical advice</strong>.
          </div>
        )}
        {showPendingApproval ? (
          <PendingApprovalPage
            email={pendingEmail}
            onLogin={() => { setShowPendingApproval(false); setShowLogin(true); setShowRegister(false); }}
            onStatusChange={() => { setShowPendingApproval(false); setShowLogin(true); setShowRegister(false); }}
          />
        ) : showRegister ? (
          <RegisterPage
            onCancel={goToLanding}
            onLogin={() => { setShowLogin(true); setShowRegister(false); }}
            onPendingApproval={(email) => { setPendingEmail(email); setShowRegister(false); setShowPendingApproval(true); }}
          />
        ) : showLogin ? (
          <LoginPage
            onCancel={goToLanding}
            onRegister={() => { setShowRegister(true); setShowLogin(false); }}
          />
        ) : (
          <LandingPage onGetStarted={() => { setShowLogin(true); setShowRegister(false); }} />
        )}
        <footer>
          <div className="container">
            <p><strong>Pharmacy2U</strong> Adherence Risk Intelligence — Data &amp; AI Hackathon 2026</p>
            <p style={{ marginTop: 6, fontSize: 11 }}>Model trained on CMS DE-SynPUF synthetic data. Not clinical advice. For demonstration purposes only.</p>
          </div>
        </footer>
      </>
    );
  }

  // Pending clinician — show approval waiting page
  if (user.role === 'pending_clinician') {
    return (
      <PendingApprovalPage
        email={user.email}
        onLogin={handleLogout}
        onStatusChange={() => window.location.reload()}
      />
    );
  }

  // Patient view — completely separate UI
  if (user.role === 'patient') {
    if (viewportWidth > 768 && !forceMobile) {
      return <PatientDesktopGate onContinue={() => setForceMobile(true)} onLogout={handleLogout} />;
    }
    return <PatientApp user={user} onLogout={handleLogout} />;
  }

  // Logged in (clinician/admin)
  return (
    <>
      <UnsupportedOverlay />
      <Header
        user={user}
        onLogout={handleLogout}
        onHomeClick={() => { setShowLanding(true); setAnalyticsView(false); setSupplyChainView(false); handleReset(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onToolClick={() => {
          setShowLanding(false);
          setAnalyticsView(false);
          setSupplyChainView(false);
          setTimeout(() => {
            const el = document.getElementById('input-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
        onAdminClick={() => setShowAdmin(true)}
        onAnalyticsClick={() => { setShowLanding(false); setAnalyticsView(true); setSupplyChainView(false); setResults(null); setProcessing(false); }}
        onSupplyChainClick={() => { setShowLanding(false); setSupplyChainView(true); setAnalyticsView(false); setResults(null); setProcessing(false); }}
        onLogoClick={() => { setShowLanding(true); setAnalyticsView(false); setSupplyChainView(false); handleReset(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
      {(!showLanding || analyticsView || supplyChainView) && (
        <div className="disc-bar">
          <strong>Synthetic Data Demo</strong> — Modelling &amp; product-thinking exercise using CMS DE-SynPUF synthetic claims data. Outputs are <strong>not clinical advice</strong>.
        </div>
      )}

      {showLanding && !analyticsView && !supplyChainView && (
        <LandingPage onGetStarted={() => { setShowLanding(false); }} />
      )}

      {analyticsView && (user.role === 'admin' || user.role === 'test') && (
        <AnalyticsDashboard onBack={() => setAnalyticsView(false)} />
      )}

      {supplyChainView && (user.role === 'admin' || user.role === 'test') && (
        <SupplyChainDashboard onBack={() => setSupplyChainView(false)} />
      )}

      {!showLanding && !analyticsView && !supplyChainView && !processing && !results && (
        <RiskAssessment
          onStartProcessing={(stream) => {
            setProcessing(true);
            setProgressData(stream);
          }}
        />
      )}

      {processing && (
        <ProcessingOverlay
          stream={progressData}
          onComplete={handleResults}
          onError={(err) => {
            alert('Error: ' + err);
            setProcessing(false);
          }}
        />
      )}

      {results && (
        <ResultsTable
          data={results}
          onViewDetail={setSelectedIdx}
          onReset={handleReset}
        />
      )}

      {selectedIdx !== null && results && (
        <DetailPanel
          patient={results.sorted[selectedIdx]}
          onClose={() => setSelectedIdx(null)}
          onConfirmIntervention={(interventionId, patientId, patientEmail) => {
            const patient = results.sorted[selectedIdx];
            setSelectedIdx(null);
            const msg = INTERVENTION_MESSAGES[interventionId] || `Reminder regarding your prescription. Please contact your pharmacy.`;
            if (patientEmail) {
              const extra = interventionId === 'in_app_survey' ? {
                drug_name: patient?.drug_name || 'Medication',
                drug_ndc: patient?.drug_ndc || '',
                patient_id: patientId,
              } : {};
              sendNotification(patientEmail, interventionId, msg, extra).catch(() => {});
            }
            notify(
              `Intervention scheduled: ${getInterventionLabel(interventionId)} for ${patientId}`,
              getInterventionColor(interventionId),
              'task_alt'
            );
          }}
        />
      )}

      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          currentUserEmail={user.email}
        />
      )}

      <footer>
        <div className="container">
          <p><strong>Pharmacy2U</strong> Adherence Risk Intelligence — Data &amp; AI Hackathon 2026</p>
          <p style={{ marginTop: 6, fontSize: 11 }}>Model trained on CMS DE-SynPUF synthetic data. Not clinical advice. For demonstration purposes only.</p>
        </div>
      </footer>
      <NotificationManager />
    </>
  );
}
