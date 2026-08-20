import { useEffect, useState } from 'react';
import { api } from '../api';

// Gates the entire dashboard behind a password, verified server-side (see
// routes/auth.js) — this component only decides whether to render
// `children` at all; it never itself holds the real password. The actual
// proof of "logged in" is an HttpOnly session cookie the browser manages
// on its own (see api.js's comment on why a cookie rather than
// sessionStorage/localStorage) — JavaScript can't read that cookie's value
// at all, so the only way to know if it's still valid is to ask the
// backend (GET /api/auth/me).
export default function AuthGate({ children }) {
  // null = still checking on load, true/false = known. Starting at null
  // (rather than assuming false) avoids flashing the login form for a
  // split second on every page load even when already logged in.
  const [authed, setAuthed] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authMe().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  // api.js dispatches this the moment ANY API call comes back 401 (session
  // expired, revoked, or the backend never had it to begin with) — from
  // wherever in the app that happened to fire, not just from here.
  useEffect(() => {
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener('vynox:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vynox:unauthorized', onUnauthorized);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(password);
      setAuthed(true);
      setPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (authed) return children;
  if (authed === null) return null; // brief initial /api/auth/me check

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080d17',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', zIndex: 1000,
    }}>
      <form
        onSubmit={submit}
        style={{
          width: 340, background: '#0d1520', border: '1px solid #1a2333', borderRadius: 14,
          padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'rgba(91,70,245,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b7cf6',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>VYNOX Security Monitor</div>
          <div style={{ color: '#7a839e', fontSize: 12.5, textAlign: 'center' }}>Enter the dashboard password to continue</div>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          disabled={loading}
          style={{
            padding: '10px 12px', borderRadius: 8, border: '1px solid #232b3d',
            background: '#0a1120', color: '#e6e9f0', fontSize: 14,
          }}
        />

        {error && <div style={{ color: '#fca5a5', fontSize: 12.5 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            padding: '10px 0', borderRadius: 8, border: 'none',
            background: loading || !password.trim() ? '#2a2f45' : '#5b46f5',
            color: '#fff', fontSize: 13.5, fontWeight: 600,
            cursor: loading || !password.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

// Small helper other components (e.g. the "Logout" button in Settings) can
// reuse without re-implementing the clear-cookie + notify-AuthGate dance.
export async function logout() {
  try { await api.logout(); } catch { /* session may already be dead — fine either way */ }
  window.dispatchEvent(new Event('vynox:unauthorized'));
}
