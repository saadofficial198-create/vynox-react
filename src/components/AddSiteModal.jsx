import { useState } from 'react';
import { api } from '../api';

export default function AddSiteModal({ open, onClose, onAdded }) {
  const [name, setName]       = useState('');
  const [url, setUrl]         = useState('');
  const [apiKey, setApiKey]   = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message, ping? }
  const [error, setError]     = useState(null);

  if (!open) return null;

  function reset() {
    setName(''); setUrl(''); setApiKey('');
    setTestResult(null); setError(null);
    setTesting(false); setSaving(false);
  }

  async function handleTest() {
    setError(null); setTestResult(null); setTesting(true);
    try {
      const r = await api.testConnect({ url, apiKey });
      setTestResult({ ok: true, ping: r.ping });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      const r = await api.addSite({ name: name || undefined, url, apiKey });
      onAdded?.(r.site);
      reset();
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={ovStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Add New Site</div>
            <div style={{ fontSize: 12, color: '#7a839e', marginTop: 4 }}>
              Get the Site URL & API Key from your WordPress site's Vynox plugin page
            </div>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Site Name (optional)" hint="If empty, we'll use the WordPress site name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Store" style={inp} />
          </Field>
          <Field label="Site URL *" hint="Where WordPress is installed">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" style={inp} />
          </Field>
          <Field label="API Key *" hint="From the Vynox plugin page in WP Admin">
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="vnx_..." style={{ ...inp, fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }} />
          </Field>

          {testResult && (
            <div style={testResult.ok ? testOk : testErr}>
              {testResult.ok ? (
                <>
                  <strong>✓ Connected.</strong> {testResult.ping?.site_name} · WP {testResult.ping?.wp_version} · connector v{testResult.ping?.connector_version}
                </>
              ) : (
                <><strong>✗ Failed.</strong> {testResult.message}</>
              )}
            </div>
          )}

          {error && <div style={testErr}><strong>Error:</strong> {error}</div>}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={btnGhost} disabled={testing || saving}>Cancel</button>
          <button onClick={handleTest} style={btnSecondary} disabled={!url || !apiKey || testing || saving}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={handleSave} style={btnPrimary} disabled={!url || !apiKey || saving || testing}>
            {saving ? 'Saving…' : 'Add Site'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#a7b0c8', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#5a6480', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const ovStyle = {
  position: 'fixed', inset: 0, background: 'rgba(7, 11, 22, 0.72)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle = {
  width: 'min(560px, 92vw)', background: '#0f1729', border: '1px solid #2a3448',
  borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden',
};
const headerStyle = { padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 };
const closeBtn = { background: 'transparent', border: 'none', color: '#7a839e', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 };
const footerStyle = { padding: '16px 24px', borderTop: '1px solid #1e2840', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const inp = {
  width: '100%', padding: '10px 12px', background: '#0a1020', color: '#e2e8f0',
  border: '1px solid #2a3448', borderRadius: 6, fontSize: 13, fontFamily: 'Inter',
  outline: 'none', boxSizing: 'border-box',
};
const btnPrimary   = { padding: '9px 18px', background: '#5b46f5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const btnSecondary = { padding: '9px 18px', background: '#1e2840', color: '#e2e8f0', border: '1px solid #2a3448', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const btnGhost     = { padding: '9px 18px', background: 'transparent', color: '#7a839e', border: '1px solid #2a3448', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const testOk  = { padding: '10px 12px', background: 'rgba(34,197,94,0.10)',  border: '1px solid rgba(34,197,94,0.35)',  color: '#86efac', borderRadius: 6, fontSize: 12 };
const testErr = { padding: '10px 12px', background: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.35)',  color: '#fca5a5', borderRadius: 6, fontSize: 12 };
