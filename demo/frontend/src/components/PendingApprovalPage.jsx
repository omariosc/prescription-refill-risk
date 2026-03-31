import { useState, useEffect, useCallback } from 'react';

export default function PendingApprovalPage({ email, onLogin, onStatusChange }) {
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!email) return;
    setChecking(true);
    try {
      const res = await fetch('/api/auth/approval-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.status === 'approved') {
        setApproved(true);
        setTimeout(() => {
          if (onStatusChange) onStatusChange();
          else if (onLogin) onLogin();
        }, 2000);
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [email, onLogin, onStatusChange]);

  // Auto-poll every 3 seconds
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <div className="login-backdrop">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-logo">
          <svg viewBox="0 0 239 239" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#00e0bc" y="139" width="100" height="100" rx="5"/>
            <path fill="#00e0bc" d="M48,0h46c3,0,6,2,6,5v89c0,3-2,5-6,5H5c-3,0-5-2-5-5V48C0,21,21,0,48,0Z"/>
            <rect fill="#00e0bc" x="139" width="100" height="100" rx="5"/>
            <path fill="#00e0bc" d="M145,139h89c3,0,5,2,5,5v47c0,26-21,48-48,48h-46c-3,0-6-2-6-6V145c0-3,3-6,6-6Z"/>
          </svg>
        </div>

        {approved ? (
          <>
            <div style={{ margin: '24px 0 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#10b981' }}>check_circle</span>
            </div>
            <h2 className="login-title" style={{ color: '#059669' }}>Account Approved!</h2>
            <p className="login-subtitle" style={{ marginBottom: 24 }}>
              Your clinician account has been approved. Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <div style={{ margin: '24px 0 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#f59e0b', display: 'inline-block', animation: 'hourglassSpin 3s ease-in-out infinite' }}>
                hourglass_top
              </span>
            </div>

            <h2 className="login-title">Account Pending Approval</h2>
            <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6, marginBottom: 8, padding: '0 4px' }}>
              Your clinician account has been created and is awaiting approval from a Pharmacy2U administrator.
            </p>
            {email && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                Checking status for <strong>{email}</strong>
              </p>
            )}
            <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 24 }}>
              This usually takes less than 24 hours.
            </p>

            <button
              type="button"
              className="btn btn-p"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
              onClick={checkStatus}
              disabled={checking}
            >
              {checking ? (
                <><div className="spinner" style={{ width: 18, height: 18 }} /> Checking...</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Check Status</>
              )}
            </button>

            <div className="login-links">
              <a href="#" onClick={(e) => { e.preventDefault(); onLogin && onLogin(); }}>Back to Login</a>
            </div>
          </>
        )}

        <style>{`
          @keyframes hourglassSpin {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(180deg); }
            50% { transform: rotate(180deg); }
            75% { transform: rotate(360deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
