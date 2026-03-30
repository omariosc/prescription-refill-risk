import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { register, verifyRegistration } from '../utils/api';

export default function RegisterPage({ onCancel, onLogin }) {
  const { checkAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [regResult, setRegResult] = useState(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const qrRef = useRef(null);

  // Render QR code when step 2 is reached
  useEffect(() => {
    if (step === 2 && regResult && qrRef.current && window.QrCreator) {
      while (qrRef.current.firstChild) {
        qrRef.current.removeChild(qrRef.current.firstChild);
      }
      window.QrCreator.render({
        text: regResult.totp_uri,
        radius: 0.4,
        ecLevel: 'M',
        fill: '#003052',
        background: '#fff',
        size: 200,
      }, qrRef.current);
    }
  }, [step, regResult]);

  // Validation helpers
  const validateName = (v) => {
    if (!v.trim()) return 'Name is required';
    if (v.trim().length < 2) return 'Name must be at least 2 characters';
    if (v.trim().length > 100) return 'Name must be under 100 characters';
    if (/[<>]/.test(v)) return 'Name contains invalid characters';
    return null;
  };

  const validateEmail = (v) => {
    if (!v.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Please enter a valid email address';
    return null;
  };

  const validateOrg = (v) => {
    if (v.length > 200) return 'Organization must be under 200 characters';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const nameErr = validateName(name);
    if (nameErr) { setError(nameErr); return; }
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const orgErr = validateOrg(organization);
    if (orgErr) { setError(orgErr); return; }

    setSubmitting(true);
    try {
      const result = await register(name.trim(), email.trim(), organization.trim() || undefined);
      setRegResult(result);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        doVerify(fullCode);
      }
    }
  }, [code, email]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    if (pasted.length === 6) {
      doVerify(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }, [code, email]);

  async function doVerify(codeVal) {
    setSubmitting(true);
    setError('');
    try {
      await verifyRegistration(email.trim(), codeVal);
      await checkAuth();
    } catch (err) {
      setError(err.message || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    doVerify(fullCode);
  };

  const copySecret = () => {
    if (regResult?.totp_secret) {
      navigator.clipboard.writeText(regResult.totp_secret);
    }
  };

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <button className="login-close" onClick={onCancel}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="login-logo">
          <svg viewBox="0 0 239 239" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#00e0bc" y="139" width="100" height="100" rx="5"/>
            <path fill="#00e0bc" d="M48,0h46c3,0,6,2,6,5v89c0,3-2,5-6,5H5c-3,0-5-2-5-5V48C0,21,21,0,48,0Z"/>
            <rect fill="#00e0bc" x="139" width="100" height="100" rx="5"/>
            <path fill="#00e0bc" d="M145,139h89c3,0,5,2,5,5v47c0,26-21,48-48,48h-46c-3,0-6-2-6-6V145c0-3,3-6,6-6Z"/>
          </svg>
        </div>

        {step === 1 && (
          <>
            <h2 className="login-title">Create an account</h2>
            <p className="login-subtitle">Set up your Refill Risk Tool access</p>

            {error && (
              <div className="login-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="fg" style={{ marginBottom: 16 }}>
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoFocus
                  required
                />
              </div>

              <div className="fg" style={{ marginBottom: 16 }}>
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@pharmacy2u.co.uk"
                  required
                />
              </div>

              <div className="fg" style={{ marginBottom: 24 }}>
                <label>Organization <span className="opt">(optional)</span></label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Pharmacy2U"
                />
              </div>

              <button
                type="submit"
                className="btn btn-p"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="login-links">
              <a href="#" onClick={(e) => { e.preventDefault(); onLogin && onLogin(); }}>
                Already have an account? Log in
              </a>
            </div>
          </>
        )}

        {step === 2 && regResult && (
          <>
            <h2 className="login-title">Set up your authenticator</h2>
            <p className="login-subtitle">Scan this QR code with your authenticator app</p>

            {error && (
              <div className="login-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {error}
              </div>
            )}

            <div ref={qrRef} style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }} />

            <div style={{
              background: 'var(--grey, #f3f4f6)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--sm)',
              padding: '10px 14px',
              fontSize: 12,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ flex: 1 }}>{regResult.totp_secret}</span>
              <button
                onClick={copySecret}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#6b7280',
                }}
                title="Copy secret"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              <p style={{ marginBottom: 4 }}><strong>1.</strong> Open Google Authenticator, Authy, or any TOTP app.</p>
              <p style={{ marginBottom: 4 }}><strong>2.</strong> Scan the QR code or enter the secret manually.</p>
              <p><strong>3.</strong> Enter the 6-digit code below to verify.</p>
            </div>

            <form onSubmit={handleVerifySubmit}>
              <div className="fg" style={{ marginBottom: 24 }}>
                <label>Authenticator code</label>
                <div className="totp-inputs" onPaste={handlePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="totp-digit"
                      autoComplete="off"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-p"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                    Verifying...
                  </>
                ) : (
                  'Verify & Log In'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
