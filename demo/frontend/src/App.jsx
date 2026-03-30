import { useState } from 'react';
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
import { getInterventionLabel, getInterventionColor } from './components/InterventionPanel';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [analyticsView, setAnalyticsView] = useState(false);
  const [supplyChainView, setSupplyChainView] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

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
    setResults(null);
    setProcessing(false);
    setShowAdmin(false);
    setAnalyticsView(false);
    setSupplyChainView(false);
    setShowLanding(false);
  };

  const goToLanding = () => {
    setShowLogin(false);
    setShowRegister(false);
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
        {(showLogin || showRegister) && (
          <div className="disc-bar">
            <strong>Synthetic Data Demo</strong> — Modelling &amp; product-thinking exercise using CMS DE-SynPUF synthetic claims data. Outputs are <strong>not clinical advice</strong>.
          </div>
        )}
        {showRegister ? (
          <RegisterPage
            onCancel={goToLanding}
            onLogin={() => { setShowLogin(true); setShowRegister(false); }}
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

  // Logged in
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
          onConfirmIntervention={(interventionId, patientId) => {
            setSelectedIdx(null);
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
