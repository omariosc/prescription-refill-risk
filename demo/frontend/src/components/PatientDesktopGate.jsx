import { useEffect, useRef } from 'react';

function P2ULogoLarge() {
  return (
    <svg style={{ height: 48, width: 'auto' }} viewBox="0 0 480 80" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#00e0bc" y="38" width="33" height="33" rx="2"/>
      <path fill="#00e0bc" d="M15.8,0h15.4c1,0,1.8.8,1.8,1.8v29.4c0,1-0.8,1.8-1.8,1.8H1.8c-1,0-1.8-0.8-1.8-1.8v-15.4C0,7.1,7.1,0,15.8,0Z"/>
      <rect fill="#00e0bc" x="38" width="33" height="33" rx="2"/>
      <path fill="#00e0bc" d="M39.8,38h29.4c1,0,1.8.8,1.8,1.8v15.4c0,8.7-7.1,15.8-15.8,15.8h-15.4c-1,0-1.8-0.8-1.8-1.8v-29.4c0-1,.8-1.8,1.8-1.8Z"/>
      <text x="82" y="54" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="40" fill="#005c8f">Pharmacy2U</text>
    </svg>
  );
}

export default function PatientDesktopGate({ onContinue, onLogout }) {
  const qrRef = useRef(null);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (qrRef.current && typeof window !== 'undefined' && window.QrCreator) {
      // Clear any previous QR code children safely
      while (qrRef.current.firstChild) {
        qrRef.current.removeChild(qrRef.current.firstChild);
      }
      window.QrCreator.render({
        text: currentUrl,
        radius: 0.4,
        ecLevel: 'M',
        fill: '#003052',
        background: '#ffffff',
        size: 200,
      }, qrRef.current);
    }
  }, [currentUrl]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        padding: '48px 40px',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: 32 }}>
          <P2ULogoLarge />
        </div>

        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#e0f7fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#00838f' }}>smartphone</span>
        </div>

        <h2 style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 800,
          fontSize: 24,
          color: '#003052',
          margin: '0 0 12px',
        }}>
          Open on your mobile
        </h2>

        <p style={{
          fontSize: 14,
          color: '#6b7280',
          lineHeight: 1.6,
          margin: '0 0 28px',
        }}>
          The Pharmacy2U patient app is designed for mobile devices. Please scan the QR code or visit this page on your phone.
        </p>

        <div style={{
          background: '#f9fafb',
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          display: 'inline-block',
        }}>
          <div ref={qrRef} style={{ width: 200, height: 200, margin: '0 auto' }} />
        </div>

        <div style={{
          background: '#f3f4f6',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 12,
          color: '#6b7280',
          wordBreak: 'break-all',
          marginBottom: 28,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}>
          {currentUrl}
        </div>

        <button
          onClick={onContinue}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: "'Inter', sans-serif",
            padding: '8px 16px',
          }}
        >
          Or continue anyway
        </button>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
