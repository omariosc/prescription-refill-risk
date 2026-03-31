import { createContext, useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const data = await api.fetchAuth();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get('magic');
    if (magicToken) {
      // Remove the token from the URL immediately so it isn't bookmarked or shared
      window.history.replaceState(null, '', window.location.pathname);
      // Redeem the magic link (sets session cookie), then check auth
      fetch(`/api/auth/magic-link/redeem?magic=${encodeURIComponent(magicToken)}`, { credentials: 'include' })
        .then(r => {
          if (!r.ok) {
            // Token expired or invalid — surface a visible hint via sessionStorage
            // so the login page can show it without needing extra props
            sessionStorage.setItem('magic_link_error', 'Your QR code link has expired. Please scan a new one or log in manually.');
          }
        })
        .catch(() => {})
        .finally(() => checkAuth());
    } else {
      checkAuth();
    }
  }, [checkAuth]);

  const login = useCallback(async (email, code) => {
    await api.login(email, code);
    await checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
