import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage({ onCancel, onRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        doLogin(email, fullCode);
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
      doLogin(email, pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }, [code, email]);

  async function doLogin(emailVal, codeVal) {
    if (!emailVal.trim()) {
      setError('Please enter your email address');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(emailVal.trim(), codeVal);
    } catch (err) {
      setError(err.message || 'Login failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    doLogin(email, fullCode);
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

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to access the Refill Risk Tool</p>

        {error && (
          <div className="login-error">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="fg" style={{ marginBottom: 20 }}>
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@pharmacy2u.co.uk"
              autoFocus
              required
            />
          </div>

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
                Signing in...
              </>
            ) : (
              'Log in'
            )}
          </button>
        </form>

        <div className="login-links">
          <a href="#" onClick={(e) => { e.preventDefault(); onRegister && onRegister(); }}>
            Don&apos;t have an account? Register
          </a>
          <a href="#" onClick={(e) => e.preventDefault()}>Need help?</a>
        </div>
      </div>
    </div>
  );
}
