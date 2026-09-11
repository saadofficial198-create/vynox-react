import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useCachedData } from '../context/DataCache';
import CustomSelect from './CustomSelect';

const NO_BADGE = 'No Badge';

// Sibling of AddSiteModal — edits an EXISTING site's own name and badge
// (see models/Badge.js, routes/sites.js's PUT /:id). URL/API key aren't
// editable here on purpose: changing them is really "reconnect to a
// different site", which already has its own flow (Add New Site + Test
// Connection) rather than silently repointing an existing site's history.
export default function EditSiteModal({ open, site, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [badge, setBadge] = useState(NO_BADGE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The badge list is already held app-wide (context/DataCache.jsx) — the
  // Sites page behind this modal reads the very same list for its Tags
  // filter, so opening this used to re-fetch data that was already on
  // screen, and the dropdown couldn't be populated until it came back.
  const { data: badgeData } = useCachedData('badges');
  const badgeOptions = useMemo(
    () => [NO_BADGE, ...(badgeData || []).map(b => b.name)],
    [badgeData]
  );

  useEffect(() => {
    if (!open || !site) return;
    setName(site.name || '');
    setBadge(site.tags?.[0] || NO_BADGE);
    setError(null);
  }, [open, site]);

  if (!open || !site) return null;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Site name cannot be empty'); return; }
    setSaving(true); setError(null);
    try {
      const r = await api.updateSite(site._id, { name: trimmed, badge: badge === NO_BADGE ? null : badge });
      onSaved?.(r.site);
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
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Edit Site</div>
            <div style={{ fontSize: 12, color: '#7a839e', marginTop: 4 }}>{site.url}</div>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Site Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Store" style={inp} />
          </Field>
          <Field label="Badge" hint="Manage the badge list in Settings → Site Badges">
            <CustomSelect value={badge} onChange={setBadge} options={badgeOptions} />
          </Field>

          {error && <div style={testErr}><strong>Error:</strong> {error}</div>}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save Changes'}
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
  width: 'min(480px, 92vw)', background: '#0f1729', border: '1px solid #2a3448',
  borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'visible',
};
const headerStyle = { padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 };
const closeBtn = { background: 'transparent', border: 'none', color: '#7a839e', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 };
const footerStyle = { padding: '16px 24px', borderTop: '1px solid #1e2840', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const inp = {
  width: '100%', padding: '10px 12px', background: '#0a1020', color: '#e2e8f0',
  border: '1px solid #2a3448', borderRadius: 6, fontSize: 13, fontFamily: 'Inter',
  outline: 'none', boxSizing: 'border-box',
};
const btnPrimary = { padding: '9px 18px', background: '#5b46f5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const btnGhost   = { padding: '9px 18px', background: 'transparent', color: '#7a839e', border: '1px solid #2a3448', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const testErr    = { padding: '10px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: 6, fontSize: 12 };
