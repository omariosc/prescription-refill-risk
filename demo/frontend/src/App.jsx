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
import UnsupportedOverlay from './components/UnsupportedOverlay';

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
        <div className="disc-bar">
          <strong>Synthetic Data Demo</strong> — Modelling &amp; product-thinking exercise using CMS DE-SynPUF synthetic claims data. Outputs are <strong>not clinical advice</strong>.
        </div>
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
        onHomeClick={() => { setAnalyticsView(false); handleReset(); }}
        onToolClick={() => {
          const el = document.getElementById('input-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onAdminClick={() => setShowAdmin(true)}
        onAnalyticsClick={() => { setAnalyticsView(true); setResults(null); setProcessing(false); }}
      />
      <div className="disc-bar">
        <strong>Synthetic Data Demo</strong> — Modelling &amp; product-thinking exercise using CMS DE-SynPUF synthetic claims data. Outputs are <strong>not clinical advice</strong>.
      </div>

      {analyticsView && (
        <AnalyticsDashboard onBack={() => setAnalyticsView(false)} />
      )}

      {!analyticsView && !processing && !results && (
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
    </>
  );
}
