import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import AddSiteModal from '../components/AddSiteModal';
import HealthBadge from '../components/HealthBadge';
import { healthStatusMeta } from '../healthStatus';
import { api } from '../api';
import '../styles/sites.css';

const alertCls = n => n === 0 ? 'an-zero' : n >= 6 ? 'an-red' : 'an-orange';
const updCls   = n => n === 0 ? 'upd-zero' : n >= 7 ? 'upd-red' : 'upd-orange';

function relTime(iso) {
  if (!iso) return 'Never';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
// (superseded — Health Status column now renders the actual ScoreRing
// component instead of this chip; kept only if referenced elsewhere)
function PerfScoreChip({ score }) {
  if (score == null) return null;
  const color = score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = score >= 90 ? 'rgba(34,197,94,0.12)' : score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span
      title="Home page performance score (Google PageSpeed)"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}33`, borderRadius: 20, padding: '2px 8px' }}
    >
      ⚡ {score}
    </span>
  );
}

function rowFor(site, alertCounts) {
  const l = site.latest || {};
  return {
    id: site._id, name: site.name, sub: site.url,
    status: l.status ?? null, statusLabel: l.label ?? null,
    online: site.status === 'online',
    // NOTE: Site.latest (the deriveHealthStatus payload) has never had an
    // "alerts" field — reading l.alerts always returned undefined, which is
    // why this column showed "—" for every site even when the Alerts tab
    // clearly listed active alerts. The real active-alert count only exists
    // via GET /api/alerts (one row per active alert, each carrying a
    // siteId) — see alertCounts, built once per render from that response
    // and passed in here instead of trying to read it off site.latest.
    alerts: alertCounts && Object.prototype.hasOwnProperty.call(alertCounts, site._id) ? alertCounts[site._id] : null,
    // NOTE: the health-status payload's field is "updatesAvailable", not
    // "updates" — this used to read l.updates (always undefined), which is
    // why the Updates column showed "—" for every site even when the
    // backend had a real count.
    upd: l.updatesAvailable ?? null,
    php: l.phpVersion ?? '—',
    wp: l.wpVersion ?? site.wpVersion ?? '—',
    lastSyncedAt: site.lastSyncedAt,
    raw: site,
  };
}

/* ============ TABS — driven by selected site + snapshot ============ */

function OverviewTab({ site, snap }) {
  const [period, setPeriod] = useState('Last 7 Days');
  const [history, setHistory] = useState([]);
  const d = snap?.data || {};

  const periodDays = period === 'Last 30 Days' ? 30 : period === 'Last 90 Days' ? 90 : 7;

  // "Agregga" is VYNOX's own connector-adjacent plugin (the payment plugin
  // installed alongside vynox-connector.php on every client site) — the
  // full plugin list with per-plugin active/inactive status already comes
  // through in d.plugins.plugins (see vynox-connector.php's
  // vynox_get_plugins_info()), so no backend/plugin change is needed here,
  // just picking it out of the existing list for its own status row.
  const agreggaPlugin = (d.plugins?.plugins || []).find(p => (p.name || '').trim().toLowerCase() === 'agregga');

  useEffect(() => {
    if (!site?._id) return;
    api.siteHistory(site._id, periodDays)
      .then(r => setHistory(r.points || []))
      .catch(() => setHistory([]));
  }, [site?._id, periodDays]);

  return (
    <div className="sdp-tab-content active">
      <div className="info-grid">
        <InfoItem cls="ii-blue"  label="Site IP Address" val={d.site?.server_ip || '—'} icon={<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"/></>} />
        <InfoItem cls="ii-orange" label="Root Directory" val={d.site?.abspath || '—'} icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>} />
        <InfoItem cls="ii-cyan"   label="PHP Version" val={d.site?.php_version || '—'} icon={<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>} />
        <InfoItem cls="ii-blue"   label="WordPress Version" val={d.site?.wp_version || '—'} icon={<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10z"/></>} />
        <InfoItem cls="ii-green"  label="Web Server" val={d.site?.server_software || '—'} icon={<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>} />
        <InfoItem cls="ii-red"    label="Database Size" val={d.database?.db_size || '—'} icon={<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>} />
        <InfoItem cls="ii-purple" label="Active Theme" val={d.theme ? `${d.theme.name} ${d.theme.version || ''}`.trim() : '—'} icon={<><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>} />
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <div className="info-icon ii-cyan"><svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>
          <div><div className="info-label">Active Plugins</div><div className="info-val">{d.plugins?.active ?? '—'} of {d.plugins?.total ?? '—'}</div></div>
        </div>
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <div className={`info-icon ${agreggaPlugin?.status === 'active' ? 'ii-green' : 'ii-red'}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg></div>
          <div>
            <div className="info-label">Agregga Plugin</div>
            <div className="info-val">
              {!agreggaPlugin
                ? 'Not installed'
                : agreggaPlugin.status === 'active'
                  ? <span style={{ color: '#22c55e' }}>Active {agreggaPlugin.version ? `(v${agreggaPlugin.version})` : ''}</span>
                  : <span style={{ color: '#ef4444' }}>Inactive {agreggaPlugin.version ? `(v${agreggaPlugin.version})` : ''}</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="sdp-chart-header">
          <div className="sdp-section-title">Issues History</div>
          <CustomSelect sm value={period} onChange={setPeriod} options={['Last 7 Days', 'Last 30 Days', 'Last 90 Days']} />
        </div>
        <div className="sdp-chart-wrap">
          <ChartCanvas config={(ctx) => {
            const pts = history.length > 0 ? history : [];
            const labels = pts.map(p => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const criticalData    = pts.map(p => p.critical);
            const recommendedData = pts.map(p => p.recommended);
            return {
              type: 'line',
              data: { labels, datasets: [
                { label: 'Critical', data: criticalData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)', tension: 0.42, fill: true, pointRadius: 3.5, borderWidth: 2, pointBackgroundColor: '#ef4444' },
                { label: 'Recommended', data: recommendedData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', tension: 0.42, fill: true, pointRadius: 3.5, borderWidth: 2, pointBackgroundColor: '#f59e0b' },
              ] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', maxTicksLimit: 7 } }, y: { min: 0, grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', stepSize: 1 } } } },
            };
          }} deps={[history]} />
        </div>
        {history.length <= 1 && <div style={{ fontSize: 11, color: '#5a6480', textAlign: 'center', marginTop: 4 }}>History requires multiple snapshots — check back after the next daily scan</div>}
      </div>
    </div>
  );
}

function InfoItem({ cls, label, val, icon }) {
  return (
    <div className="info-item">
      <div className={`info-icon ${cls}`}><svg viewBox="0 0 24 24">{icon}</svg></div>
      <div style={{ minWidth: 0 }}><div className="info-label">{label}</div><div className="info-val" style={{ wordBreak: 'break-word' }}>{val}</div></div>
    </div>
  );
}

function DetailsTab({ site, snap, onSaved }) {
  const d = snap?.data?.site || {};
  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-title">Site Information</div>
      <div className="detail-list">
        <div className="detail-row">
          <span className="detail-key">Site URL</span>
          <a className="detail-link" href={site.url} target="_blank" rel="noopener noreferrer">{site.url}
            <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        <Row k="Website Title" v={d.site_name || site.name} />
        <Row k="WordPress Version" v={d.wp_version} />
        <Row k="PHP Version" v={d.php_version} />
        <Row k="MySQL Version" v={d.mysql_version} />
        <Row k="WordPress Multisite" v={d.multisite === 'yes' ? 'Yes' : 'No'} />
        <Row k="Language" v={d.language} />
        <Row k="Time Zone" v={d.timezone} />
        <Row k="SSL Enabled" v={d.is_ssl === 'yes' ? 'Yes' : 'No'} />
        <Row k="Connected On" v={fmtDate(site.createdAt)} />
        <Row k="Last Synced" v={fmtDate(site.lastSyncedAt)} />
      </div>

      <div style={{ marginTop: 22 }}>
        <MonitoredPagesEditor site={site} onSaved={onSaved} />
      </div>
    </div>
  );
}

// Lets the user pick which pages (from the live sitemap) get screenshots +
// PageSpeed checks. A site's captures are PAUSED (see
// Site.pagesConfigured in models/Site.js) until this has been saved at
// least once — this is deliberate: the WordPress plugin auto-registers new
// sites with no human review, and running checks against hardcoded
// guessed slugs is what produced misleading "Failed"/404 screenshots
// before this existed. Supports selecting any number of pages (including
// none of the suggested ones, or more than one page of a similar "kind").
function MonitoredPagesEditor({ site, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]); // [{ label, path }] from the live sitemap
  const [selected, setSelected] = useState({}); // { [path]: { label, enabled } }
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  const load = useCallback(() => {
    if (!site?._id) return;
    setLoading(true); setError(null); setSavedMsg(null);
    api.pageCandidates(site._id)
      .then((r) => {
        setCandidates(r.candidates || []);
        const initial = {};
        (r.monitoredPages || []).forEach((p) => { initial[p.path] = { label: p.label, enabled: p.enabled !== false, matchStatus: p.matchStatus }; });
        setSelected(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [site?._id]);

  useEffect(() => { load(); }, [load]);

  function toggle(candidate) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[candidate.path]) {
        delete next[candidate.path];
      } else {
        next[candidate.path] = { label: candidate.label, enabled: true };
      }
      return next;
    });
  }

  async function save() {
    const pages = Object.entries(selected).map(([path, v]) => ({ label: v.label, path, enabled: v.enabled !== false }));
    if (!pages.length) {
      setError('Select at least one page before saving.');
      return;
    }
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      await api.saveMonitoredPages(site._id, pages);
      setSavedMsg('Saved — screenshots and PageSpeed checks will use this selection from the next scheduled run.');
      load();
      // Refresh the parent Sites page's `sites` list too — otherwise the
      // `site` object passed into Screenshots/Performance tabs still has
      // the OLD monitoredPages until a full page reload, since this editor
      // only updates its own local candidates/selected state above.
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div style={{ background: '#0a1120', border: '1px solid #1a2333', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e6e9f0' }}>Monitored Pages</div>
          <div style={{ fontSize: 11.5, color: '#7a839e', marginTop: 2 }}>
            Choose which pages get screenshots and PageSpeed checks. Nothing runs for this site until you save a selection here.
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          style={{ background: saving ? '#2a2f45' : '#5b46f5', color: saving ? '#a5b4fc' : '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: saving || loading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {saving ? 'Saving…' : `Save Selection${selectedCount ? ` (${selectedCount})` : ''}`}
        </button>
      </div>

      {loading && <div style={{ padding: '12px 0', color: '#7a839e', fontSize: 13 }}>Loading pages from sitemap…</div>}
      {!loading && error && <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
      {!loading && savedMsg && <div style={{ marginTop: 8, fontSize: 12, color: '#86efac', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '8px 12px' }}>{savedMsg}</div>}

      {!loading && !site.pagesConfigured && !savedMsg && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#fcd34d', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px' }}>
          No pages selected yet — screenshots and PageSpeed checks are paused for this site until you save a selection.
        </div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="mpe-list" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
          {candidates.map((c) => {
            const isSel = !!selected[c.path];
            const info = selected[c.path];
            return (
              <label
                key={c.path}
                className={`mpe-row ${isSel ? 'mpe-row-selected' : 'mpe-row-unselected'}`}
              >
                <input type="checkbox" checked={isSel} onChange={() => toggle(c)} style={{ accentColor: '#5b46f5', width: 15, height: 15, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mpe-label">{c.label}</div>
                  <div className="mpe-path">{c.path}</div>
                </div>
                {info?.matchStatus === 'mismatch' && (
                  <span style={{ fontSize: 10, color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    Slug mismatch
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
      {!loading && candidates.length === 0 && !error && (
        <div style={{ padding: '12px 0', color: '#7a839e', fontSize: 13 }}>No pages found in this site's sitemap.</div>
      )}
    </div>
  );
}
function Row({ k, v }) {
  return <div className="detail-row"><span className="detail-key">{k}</span><span className="detail-val">{v || '—'}</span></div>;
}

function AlertsTab({ snap }) {
  const d = snap?.data || {};
  const alerts = useMemo(() => {
    const list = [];
    const sec = d.security || {};
    const malware = d.malware || {};
    const updates = d.updates || {};
    const health = d.health?.tests || {};
    if (malware.suspicious_count > 0) list.push({ title: 'Malware Detected', sub: `${malware.suspicious_count} suspicious file(s) in uploads`, sev: 'high' });
    if (updates.core_update_available === 'yes') list.push({ title: 'WordPress Core Update', sub: `New version ${updates.core_new_version || ''}`, sev: 'med' });
    if (updates.plugins_to_update > 0) list.push({ title: 'Plugin Updates Available', sub: `${updates.plugins_to_update} plugin(s)`, sev: 'med' });
    if (updates.themes_to_update > 0)  list.push({ title: 'Theme Updates Available', sub: `${updates.themes_to_update} theme(s)`, sev: 'med' });
    if (typeof sec.file_editor_enabled === 'string' && /yes/i.test(sec.file_editor_enabled)) list.push({ title: 'File Editor Enabled', sub: 'Disable DISALLOW_FILE_EDIT in wp-config.php', sev: 'med' });
    if (typeof sec.admin_path_default === 'string' && /yes/i.test(sec.admin_path_default)) list.push({ title: 'Default Login Path', sub: 'Move wp-login.php to a custom path', sev: 'low' });
    Object.entries(health).forEach(([k, t]) => {
      if (t?.status === 'critical') list.push({ title: t.label || k, sub: `Site Health (${t.badge})`, sev: 'high' });
    });
    return list;
  }, [d]);

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">Active Alerts</div>
        <a className="view-link" href="/alerts">View All Alerts</a>
      </div>
      {alerts.length === 0 && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No active alerts — site looks clean.</div>}
      {alerts.slice(0, 10).map((a, i) => (
        <div className="sdp-alert" key={i}>
          <div className={`sdp-alert-icon ${a.sev === 'high' ? 'sai-red' : 'sai-orange'}`}>
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="sdp-alert-body"><div className="sdp-alert-title">{a.title}</div><div className="sdp-alert-sub">{a.sub}</div></div>
          <div className="sdp-alert-right"><span className={`sev sev-${a.sev}`}>{a.sev === 'high' ? 'High' : a.sev === 'med' ? 'Medium' : 'Low'}</span></div>
        </div>
      ))}
    </div>
  );
}

function ScansTab({ snap }) {
  const m = snap?.data?.malware || {};
  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head"><div className="sdp-block-title">Last Malware Scan</div></div>
      <div className="sdp-list">
        <div className="sdp-list-row"><div className="scan-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg></div><div className="sdp-list-name">Uploads scan</div><span className="sdp-list-time">{m.files_scanned ?? 0} files scanned</span><span className="done-badge">{m.suspicious_count > 0 ? `${m.suspicious_count} suspicious` : 'Clean'}</span></div>
        <div className="sdp-list-row"><div className="scan-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></div><div className="sdp-list-name">PHP files in uploads</div><span className="sdp-list-time">{m.php_files_count ?? 0}</span><span className="done-badge">{m.php_files_count > 0 ? 'Suspicious' : 'OK'}</span></div>
      </div>
      <div style={{ fontSize: 12, color: '#7a839e', padding: '8px 0' }}>{m.verdict}</div>
    </div>
  );
}

function BackupsTab({ snap }) {
  const b = snap?.data?.backups || {};
  const list = b.all_backups || [];
  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head"><div className="sdp-block-title">Recent Backups</div></div>
      {list.length === 0 && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No backups found{b.wpvivid_active === false ? ' — WPvivid plugin not active' : ''}</div>}
      <div className="sdp-list">
        {list.map((bk, i) => (
          <div className="sdp-list-row" key={i}>
            <div className="backup-ico"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>
            <div className="bk-body" style={{ minWidth: 0 }}><div className="bk-date">{bk.modified}</div><div className="bk-type" style={{ wordBreak: 'break-all' }}>{bk.name}</div></div>
            <span className="bk-size">{bk.size}</span>
            <span className="done-badge">Success</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatesTab({ snap }) {
  const u = snap?.data?.updates || {};
  const plugins = u.plugin_list || [];
  const themes  = u.theme_list  || [];
  const all = [
    ...(u.core_update_available === 'yes' ? [{ kind: 'WordPress Core', curr: '', next: u.core_new_version, cls: 'ui-blue' }] : []),
    ...plugins.map(p => ({ kind: `Plugin: ${p.name}`, curr: p.current, next: p.latest, cls: 'ui-orange' })),
    ...themes.map(t  => ({ kind: `Theme: ${t.name}`,  curr: t.current, next: t.latest, cls: 'ui-pink' })),
  ];
  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head"><div className="sdp-block-title">Available Updates</div></div>
      {all.length === 0 && <div style={{ padding: 16, color: '#22c55e', fontSize: 13 }}>✓ All up to date</div>}
      <div className="sdp-list">
        {all.map((u, i) => (
          <div className="sdp-list-row" key={i}>
            <div className={`upd-ico ${u.cls}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div>
            <div className="upd-body"><div className="upd-name">{u.kind}</div></div>
            <span className="upd-meta">{u.curr && `${u.curr} → `}{u.next}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ PERFORMANCE TAB — real Google PageSpeed score per page ============ */

function metricColor(val, [good, ok]) {
  // Lower-is-better metrics (ms / CLS points) — good <= threshold1, ok <= threshold2, else poor
  if (val == null) return '#5a6480';
  if (val <= good) return '#22c55e';
  if (val <= ok) return '#f59e0b';
  return '#ef4444';
}
function fmtMs(ms) {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}
function fmtCls(v) {
  if (v == null) return '—';
  return v.toFixed(3);
}

function ScoreRing({ label, val }) {
  const color = val == null ? '#3a4356' : val >= 90 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444';
  const pct = val == null ? 0 : val;
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 76 }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r={r} fill="none" stroke="#1a2233" strokeWidth="5" />
          {val != null && (
            <circle
              cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: val == null ? '#5a6480' : color }}>
          {val ?? '—'}
        </div>
      </div>
      {label && <div style={{ fontSize: 10.5, color: '#8892a8', textAlign: 'center', lineHeight: 1.2 }}>{label}</div>}
    </div>
  );
}
function VitalPill({ label, val, color, title }) {
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 74, padding: '8px 4px', background: '#0d1520', borderRadius: 8, border: '1px solid #182031' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 9.5, color: '#68718a', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}
function PageSpeedCard({ pageLabel, pagePath, latest }) {
  const ok = latest?.ok;
  const scores = latest?.scores || {};
  const vitals = latest?.vitals || {};
  return (
    <div style={{
      background: '#0a1120', border: '1px solid #1a2333', borderRadius: 12,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e6e9f0' }}>{pageLabel}</div>
          <div style={{ fontSize: 11, color: '#5a6480', marginTop: 2 }}>{pagePath}</div>
        </div>
        {!latest && <span style={{ fontSize: 11, color: '#5a6480', padding: '3px 9px', background: '#131b2a', borderRadius: 20 }}>Not checked yet</span>}
        {latest && ok && (
          <div style={{ fontSize: 10.5, color: '#5a6480', textAlign: 'right', whiteSpace: 'nowrap' }}>
            Checked {relTime(latest.checkedAt)}
          </div>
        )}
      </div>

      {latest && !ok && (
        <div style={{ fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
          Failed: {latest.error || 'unknown error'}
        </div>
      )}

      {latest && ok && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <ScoreRing label="Performance" val={scores.performance} />
            <ScoreRing label="SEO" val={scores.seo} />
            <ScoreRing label="Accessibility" val={scores.accessibility} />
            <ScoreRing label="Best Practices" val={scores.bestPractices} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #141d2e', paddingTop: 12 }}>
            <VitalPill label="LCP" val={fmtMs(vitals.lcpMs)} color={metricColor(vitals.lcpMs, [2500, 4000])} title="Largest Contentful Paint" />
            <VitalPill label="CLS" val={fmtCls(vitals.clsScore)} color={metricColor(vitals.clsScore, [0.1, 0.25])} title="Cumulative Layout Shift" />
            <VitalPill label="FCP" val={fmtMs(vitals.fcpMs)} color={metricColor(vitals.fcpMs, [1800, 3000])} title="First Contentful Paint" />
            <VitalPill label="TTFB" val={fmtMs(vitals.ttfbMs)} color={metricColor(vitals.ttfbMs, [800, 1800])} title="Time to First Byte" />
          </div>
        </>
      )}
    </div>
  );
}

// checking/pages state for the Performance tab is owned by the Sites page
// itself (keyed per-site) rather than by this component, because the
// sdp-body only mounts PerformanceTab while tab === 'performance' — switching
// tabs (or selecting another site) unmounts it, which used to silently drop
// an in-flight "Check Now" run: the button would just reset to normal even
// though the 5-attempt PageSpeed check was still running server-side, and
// its result would land on nothing when it finished. Lifting the state up
// means it survives tab switches and site re-selection, so the button still
// shows "Checking…" (and the previous scores stay visible instead of being
// wiped) no matter what the user clicks around to in the meantime.
function PerformanceTab({ site, checkingSites, setCheckingSites, pagesBySite, setPagesBySite }) {
  const siteId = site?._id;
  const pages = pagesBySite[siteId] ?? null;
  const checking = !!checkingSites[siteId];
  const [loading, setLoading] = useState(!pages);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!siteId) return;
    setLoading(true);
    api.pageSpeedLatest(siteId)
      .then(r => setPagesBySite(prev => ({ ...prev, [siteId]: r.pages || [] })))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, setPagesBySite]);

  useEffect(() => { load(); }, [load]);

  // On mount (including after a page reload, which wipes all React state),
  // ask the server whether a check is already running for this site — the
  // "checking" flag above only lives in memory, so a reload would otherwise
  // show "Check Now" as idle even while a background run is still in
  // progress. If one is running, start polling immediately.
  useEffect(() => {
    if (!siteId || checkingSites[siteId]) return;
    api.pageSpeedStatus(siteId)
      .then(r => { if (r.checking) setCheckingSites(prev => ({ ...prev, [siteId]: true })); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // While checkingSites[siteId] is true, poll the server every 5s to find out
  // when the background PageSpeed run finishes, then refresh the results.
  useEffect(() => {
    if (!siteId || !checkingSites[siteId]) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await api.pageSpeedStatus(siteId);
        if (cancelled) return;
        if (!r.checking) {
          setCheckingSites(prev => ({ ...prev, [siteId]: false }));
          load();
        }
      } catch { /* transient network hiccup — just try again next tick */ }
    };
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId, checkingSites[siteId], load, setCheckingSites]);

  async function runCheck() {
    setError(null);
    try {
      await api.pageSpeedCheck(siteId); // returns as soon as the run is queued (202) — does not wait for it to finish
      setCheckingSites(prev => ({ ...prev, [siteId]: true })); // the poll effect above takes it from here
    } catch (e) {
      // 409 means one was already running (e.g. from another tab/device) —
      // treat it the same as "now checking" instead of surfacing an error.
      if (e.status === 409) setCheckingSites(prev => ({ ...prev, [siteId]: true }));
      else setError(e.message);
    }
  }

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">Real Performance Score (Google PageSpeed)</div>
        <button onClick={runCheck} disabled={checking} style={{
          background: checking ? '#2a2f45' : '#5b46f5', color: checking ? '#a5b4fc' : '#fff', border: 'none',
          padding: '6px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
          cursor: checking ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          {checking && (
            <span style={{
              width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(165,180,252,0.35)',
              borderTopColor: '#a5b4fc', display: 'inline-block', animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {checking ? 'Checking…' : 'Check Now'}
        </button>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      {checking && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 12, background: 'rgba(91,70,245,0.08)', border: '1px solid rgba(91,70,245,0.22)', borderRadius: 8, color: '#a5b4fc', fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ fontSize: 14 }}>⏳</span>
          <span>
            Re-checking all pages with Google PageSpeed — this can take a couple of minutes per page if the site responds slowly.
            The scores below are from the last successful check and will update in place as soon as the new run finishes, even if you switch tabs or sites in the meantime.
          </span>
        </div>
      )}
      {loading && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
      {!loading && error && <div style={{ padding: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {!loading && !error && (!pages || pages.length === 0) && (
        <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No pages configured. Add monitored pages first.</div>
      )}
      {!loading && pages && pages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pages.map(p => (
            <PageSpeedCard key={p.pageLabel} pageLabel={p.pageLabel} pagePath={p.pagePath} latest={p.latest} />
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#5a6480', marginTop: 10 }}>
        Scores refresh automatically every 6 hours. Mobile strategy, powered by Google PageSpeed Insights.
      </div>
    </div>
  );
}

/* ============ SCREENSHOTS TAB — 3x/day visual capture per page ============ */

function ScreenshotCard({ pageLabel, pagePath, latest }) {
  const [showHistory, setShowHistory] = useState(false);
  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e2535', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #1e2535' }}>
        <div>
          <div className="sdp-list-name">{pageLabel}</div>
          <div style={{ fontSize: 10, color: '#5a6480' }}>{pagePath}</div>
        </div>
        {latest?.diffFlagged && <span className="sev sev-high">Possible UI change</span>}
        {latest?.ok === false && <span className="sev sev-high">Capture failed</span>}
      </div>
      {latest?.ok && latest?.publicUrl && (
        <a href={latest.publicUrl} target="_blank" rel="noopener noreferrer">
          <img src={latest.publicUrl} alt={pageLabel} style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover', objectPosition: 'top' }} />
        </a>
      )}
      {(!latest || (!latest.ok)) && (
        <div style={{ padding: 24, textAlign: 'center', color: '#5a6480', fontSize: 12 }}>
          {latest?.error || 'No screenshot yet'}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: 10, color: '#5a6480' }}>
        <span>{latest ? `Captured ${relTime(latest.capturedAt)}` : ''}</span>
        {latest?.diffPct != null && <span>Diff: {latest.diffPct.toFixed(1)}%</span>}
      </div>
    </div>
  );
}

function ScreenshotsTab({ site }) {
  const [pages, setPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // IMPORTANT: this must re-fetch whenever the site's saved page selection
  // changes, not just when a different site is picked. It previously
  // depended only on site._id, so after saving a new Monitored Pages
  // selection in the same session (site._id unchanged) this tab kept
  // showing the stale list — e.g. selecting 2 pages still showed the old
  // 4 boxes until a full page reload. Depending on the actual
  // monitoredPages content (stringified, since it's an array/object and a
  // shallow useCallback dep would still not detect in-place mutation)
  // forces a fresh GET /screenshots/:id/latest any time the selection
  // itself changes, in addition to switching sites.
  const monitoredPagesKey = JSON.stringify(
    (site?.monitoredPages || []).map(p => [p.label, p.path, p.enabled])
  );

  const load = useCallback(() => {
    if (!site?._id) return;
    setLoading(true);
    api.screenshotsLatest(site._id)
      .then(r => setPages(r.pages || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?._id, monitoredPagesKey]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">Page Screenshots</div>
      </div>
      {loading && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
      {!loading && error && <div style={{ padding: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {!loading && !error && (!pages || pages.length === 0) && (
        <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No pages configured. Add monitored pages first.</div>
      )}
      {!loading && pages && pages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {pages.map(p => (
            <ScreenshotCard key={p.pageLabel} pageLabel={p.pageLabel} pagePath={p.pagePath} latest={p.latest} />
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#5a6480', marginTop: 10 }}>
        Automatic captures run 3x/day. A flagged "Possible UI change" means this capture differs significantly from the previous one — check for glitches.
      </div>
    </div>
  );
}

const TAB_BODIES = { overview: OverviewTab, details: DetailsTab, alerts: AlertsTab, scans: ScansTab, backups: BackupsTab, updates: UpdatesTab, performance: PerformanceTab, screenshots: ScreenshotsTab };

export default function Sites() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-sites'); return () => setPageClass(''); }, [setPageClass]);



  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [tags, setTags] = useState('All Tags');
  const [tab, setTab] = useState('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [snap, setSnap] = useState(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }

  // PerformanceTab's "Check Now" state, lifted up here (keyed by site id) so
  // an in-flight PageSpeed check survives switching tabs or selecting a
  // different site — see the comment on PerformanceTab for why this matters.
  const [checkingSites, setCheckingSites] = useState({}); // { [siteId]: boolean }
  const [pagesBySite, setPagesBySite] = useState({}); // { [siteId]: pages[] }

  const anyChecking = Object.values(checkingSites).some(Boolean);
  useEffect(() => {
    if (!anyChecking) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyChecking]);

  // Active-alert count per site, for the "Alerts" column in the All Sites
  // table. GET /api/alerts returns one row per currently-active alert
  // (across every site, each carrying a siteId) — not a per-site count — so
  // we fetch it once and tally it into { [siteId]: count } ourselves. This
  // used to be read off site.latest.alerts, a field that never existed,
  // which is why the column always showed "—".
  const [alertCounts, setAlertCounts] = useState(null); // null = not loaded yet
  const loadAlertCounts = useCallback(() => {
    api.listAlerts()
      .then((r) => {
        const counts = {};
        (r.alerts || []).forEach((a) => { counts[a.siteId] = (counts[a.siteId] || 0) + 1; });
        setAlertCounts(counts);
      })
      .catch(() => {}); // leave alertCounts as-is (or null) — column falls back to "—"
  }, []);
  useEffect(() => {
    loadAlertCounts();
    // Refresh periodically too, same reasoning as homePerfScores below —
    // alerts can change (new one detected, one resolved) without the user
    // reloading the page.
    const interval = setInterval(loadAlertCounts, 30000);
    return () => clearInterval(interval);
  }, [loadAlertCounts]);

  const loadSites = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.listSites();
      setSites(r.sites || []);
      if ((r.sites || []).length && !selectedId) setSelectedId(r.sites[0]._id);
    } catch (e) { setLoadError(e.message); } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { loadSites(); }, [loadSites]);

  // Home-page PageSpeed performance score for the "All Sites" list, shown
  // next to the Health Status badge. Fetched separately (one lightweight
  // GET per site, not one big backend change) since PageSpeedResult isn't
  // part of the Site.latest payload the list already gets.
  const [homePerfScores, setHomePerfScores] = useState({}); // { [siteId]: number|null }
  useEffect(() => {
    let cancelled = false;

    // IMPORTANT: this used to skip any site whose score was already fetched
    // ONCE, even if that first fetch came back null (e.g. because the
    // PageSpeed check hadn't finished yet, or hadn't run at all when the
    // page first loaded) — so a site's Health Status column could get
    // permanently stuck showing "—" even after a real score existed in the
    // database moments later, until a full page reload. Now it re-fetches
    // every site on an interval too, not just once per site per page load,
    // so a score that lands *after* this page was opened still shows up
    // without needing a manual refresh.
    function fetchAll() {
      sites.forEach((s) => {
        api.pageSpeedLatest(s._id)
          .then(r => {
            if (cancelled) return;
            const home = (r.pages || []).find(p => p.pageLabel === 'Home');
            const score = home?.latest?.ok ? home.latest.scores?.performance ?? null : null;
            setHomePerfScores(prev => ({ ...prev, [s._id]: score }));
          })
          .catch(() => { if (!cancelled) setHomePerfScores(prev => ({ ...prev, [s._id]: prev[s._id] ?? null })); });
      });
    }

    fetchAll();
    // Re-check every 30s — cheap (one lightweight GET per site) and means a
    // score that finishes computing after this page was opened appears on
    // its own, matching the "dashboard should just work without me manually
    // re-checking" expectation.
    const interval = setInterval(fetchAll, 30000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  useEffect(() => {
    if (!selectedId) { setSnap(null); return; }
    setSnapLoading(true); setSnap(null);
    api.latestSnap(selectedId)
      .then(r => setSnap(r.snapshot))
      .catch(() => setSnap(null))
      .finally(() => setSnapLoading(false));
  }, [selectedId, sites]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menu]);

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This removes the site and all its snapshots.`)) return;
    setMenu(null);
    try {
      await api.deleteSite(id);
      if (selectedId === id) setSelectedId(null);
      await loadSites();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  const rows = sites.map((s) => rowFor(s, alertCounts));
  const filteredRows = rows.filter(r => {
    if (status === 'Online'  && !r.online) return false;
    if (status === 'Offline' && r.online)  return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.name} ${r.sub}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const selected = sites.find(s => s._id === selectedId) || null;
  const selectedRow = selected ? rowFor(selected, alertCounts) : null;
  const TabBody = TAB_BODIES[tab];

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Sites</div><div className="stat-value">{sites.length}</div><div className="stat-sub">All Connected Sites</div></div>
          <div className="stat-sparkline"><Sparkline id="s-g1" color="#3b82f6" points="2,22 12,18 22,20 32,14 42,16 52,12 66,14" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
          <div className="stat-text"><div className="stat-label">Online</div><div className="stat-value">{sites.filter(s => s.status === 'online').length}</div><div className="stat-sub green">{sites.length ? `${Math.round(sites.filter(s => s.status === 'online').length / sites.length * 100)}% of total` : '—'}</div></div>
          <div className="stat-sparkline"><Sparkline id="s-g2" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 66,8" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          {/* NOTE: site.latest has no "alerts" field (same bug as the table's
              Alerts column) — the real per-site count comes from
              alertCounts, tallied from GET /api/alerts (see the effect
              near loadAlertCounts above). */}
          <div className="stat-text"><div className="stat-label">Sites with Alerts</div><div className="stat-value">{sites.filter(s => ((alertCounts && alertCounts[s._id]) || 0) > 0).length}</div><div className="stat-sub red">Have active alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="s-g3" color="#ef4444" points="2,14 12,18 22,12 32,20 42,10 52,16 66,13" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-cyan"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div className="stat-text"><div className="stat-label">Synced (24h)</div><div className="stat-value">{sites.filter(s => s.lastSyncedAt && (Date.now() - new Date(s.lastSyncedAt).getTime() < 86400000)).length}</div><div className="stat-sub">Synced last 24 hours</div></div>
          <div className="stat-sparkline"><Sparkline id="s-g4" color="#06b6d4" points="2,18 12,14 22,18 32,12 42,14 52,10 66,12" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-emerald"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>
          <div className="stat-text"><div className="stat-label">Backups OK</div><div className="stat-value">{sites.filter(s => (s.latest?.backupCount || 0) > 0).length}/{sites.length}</div><div className="stat-sub green">Have ≥1 backup</div></div>
          <div className="stat-sparkline"><Sparkline id="s-g5" color="#10b981" points="2,20 12,16 22,12 32,15 42,10 52,8 66,6" /></div>
        </div></div>
      </div>

      <div className="split-row">
        <div className="split-left">
          <div className="panel">
            <div className="sites-panel-header"><div className="sites-panel-title">All Sites</div></div>

            <div className="sites-toolbar">
              <div className="search-box">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search sites..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <CustomSelect value={status} onChange={setStatus} options={['All Status', 'Online', 'Offline']} />
              <CustomSelect value={tags} onChange={setTags} options={['All Tags', 'Main Site', 'E-commerce']} />
              <button className="add-btn" onClick={() => setAddOpen(true)}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add New Site
              </button>
            </div>

            <div className="sites-table-wrap" style={{ overflow: 'visible' }}>
              <table>
                <thead>
                  <tr>
                    <th>Site</th><th>Health Status</th><th>Status</th><th>Alerts</th><th>Last Scan</th><th>Updates</th><th>PHP</th><th>WP</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (<tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#7a839e' }}>Loading sites…</td></tr>)}
                  {!loading && loadError && (<tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#fca5a5' }}>Failed to load: {loadError}. <button onClick={loadSites} style={{ marginLeft: 8, background: 'transparent', color: '#5b46f5', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></td></tr>)}
                  {!loading && !loadError && filteredRows.length === 0 && (<tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#7a839e' }}>No sites yet. Click <strong>Add New Site</strong> to connect your first WordPress site.</td></tr>)}
                  {!loading && filteredRows.map((s) => {
                    const isSel = s.id === selectedId;
                    return (
                      <tr key={s.id} onClick={() => setSelectedId(s.id)} style={isSel ? { background: 'rgba(91,70,245,0.10)', boxShadow: 'inset 3px 0 0 #5b46f5', cursor: 'pointer' } : { cursor: 'pointer' }}>
                        <td>
                          <div className="site-cell">
                            <div className="wp-logo">W</div>
                            <div><div className="site-name">{s.name}</div><div className="site-sub">{s.sub}</div></div>
                          </div>
                        </td>
                        <td>
                          {/* Shows the Home page's real PageSpeed Performance score
                              (ring, same style as the Performance tab). Per explicit
                              user request, this column must NEVER fall back to the
                              health-check "Needs Attention" style badge — if no
                              PageSpeed score exists yet for Home (never checked,
                              still checking, or check failed), ScoreRing itself
                              already renders a dash ("—") in a neutral grey ring
                              instead of a number, which is exactly the "just tell
                              me there's no score" behavior asked for. */}
                          <ScoreRing val={homePerfScores[s.id] ?? null} />
                        </td>
                        <td>
                          <div className={`status-cell ${s.online ? 's-online' : 's-offline'}`}>
                            <span className={`status-dot ${s.online ? 'dot-on' : 'dot-off'}`} />
                            {s.online ? 'Online' : 'Offline'}
                          </div>
                        </td>
                        <td>{s.alerts == null ? <span style={{ color: '#5a6480' }}>—</span> : <span className={`alerts-num ${alertCls(s.alerts)}`}>{s.alerts}</span>}</td>
                        <td>{s.lastSyncedAt ? <><div className="scan-time">{relTime(s.lastSyncedAt)}</div><div className="scan-date">{fmtDate(s.lastSyncedAt)}</div></> : <span style={{ color: '#5a6480' }}>Never synced</span>}</td>
                        <td>{s.upd == null ? <span style={{ color: '#5a6480' }}>—</span> : <span className={`upd-num ${updCls(s.upd)}`}>{s.upd}</span>}</td>
                        <td><span className="ver-text">{s.php}</span></td>
                        <td><span className="ver-text">{s.wp}</span></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <button title="Preview" onClick={() => setSelectedId(s.id)} style={{ background: isSel ? '#5b46f5' : 'rgba(91,70,245,0.15)', border: 'none', color: isSel ? '#fff' : '#5b46f5', width: 28, height: 28, borderRadius: 5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button className="action-dot-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ id: s.id, x: r.right - 140, y: r.bottom + 4 }); }}>
                              <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sites.length > 8 && (
              <div className="table-foot">
                <span className="foot-text">Showing 1 to {Math.min(8, filteredRows.length)} of {filteredRows.length} sites</span>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="sdp">
            {!selected && (
              <div style={{ padding: 40, color: '#7a839e', textAlign: 'center' }}>
                Click the <strong style={{ color: '#5b46f5' }}>👁 Preview</strong> button on any site to view its details here.
              </div>
            )}
            {selected && (
              <>
                <div className="sdp-header">
                  <div className="sdp-site-info">
                    <div className="sdp-wp-logo">W</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span className="sdp-name">{selected.name}</span>
                        <span className={selected.status === 'online' ? 'sdp-online' : 'sdp-offline'}><span className="sdp-online-dot" />{selected.status === 'online' ? 'Online' : 'Offline'}</span>
                      </div>
                      <div className="sdp-sub">{(selected.url || '').replace(/^https?:\/\//, '')}</div>
                      <a className="sdp-link" href={selected.url} target="_blank" rel="noopener noreferrer">
                        {selected.url}
                        <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  </div>
                  <div className="sdp-score-wrap">
                    {selectedRow?.status ? <HealthBadge status={selectedRow.status} label={selectedRow.statusLabel} /> : <span style={{ color: '#5a6480', fontSize: 12 }}>—</span>}
                    <div className="sdp-score-lbl">Health Status</div>
                  </div>
                </div>

                <div className="sdp-tabs">
                  {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'details',  label: 'Details' },
                    { key: 'alerts',   label: <>Alerts {selectedRow?.alerts > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>({selectedRow.alerts})</span>}</> },
                    { key: 'scans',    label: 'Scans' },
                    { key: 'backups',  label: 'Backups' },
                    { key: 'updates',  label: <>Updates {selectedRow?.upd > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>({selectedRow.upd})</span>}</> },
                    { key: 'performance', label: 'Performance' },
                    { key: 'screenshots', label: 'Screenshots' },
                  ].map(t => (
                    <div key={t.key} className={`sdp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                  ))}
                </div>

                <div className="sdp-body">
                  {/* Performance + Screenshots fetch their own data independent of the
                      connector snapshot, so they render even before a sync has run. */}
                  {tab === 'performance' && (
                    <PerformanceTab
                      site={selected}
                      checkingSites={checkingSites}
                      setCheckingSites={setCheckingSites}
                      pagesBySite={pagesBySite}
                      setPagesBySite={setPagesBySite}
                    />
                  )}
                  {tab === 'screenshots' && <TabBody site={selected} snap={snap} />}
                  {tab !== 'performance' && tab !== 'screenshots' && (
                    <>
                      {snapLoading && <div style={{ padding: 24, color: '#7a839e', textAlign: 'center' }}>Loading data…</div>}
                      {!snapLoading && !snap && (
                        <div style={{ padding: 24, color: '#7a839e', textAlign: 'center' }}>
                          No snapshot yet for this site. Data populates automatically after the next daily health check.
                        </div>
                      )}
                      {/* onSaved: only DetailsTab (via MonitoredPagesEditor) actually
                          uses this — after saving a page selection, the `sites` list
                          in THIS parent component still holds the old monitoredPages
                          (MonitoredPagesEditor only refreshed its own local state), so
                          Screenshots/Performance tabs kept showing stale page counts
                          until a full reload. Re-running loadSites() here refreshes
                          `selected`/`site` for every tab immediately after a save. */}
                      {!snapLoading && snap && <TabBody site={selected} snap={snap} onSaved={loadSites} />}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fixed-position dropdown menu (escapes table overflow) */}
      {menu && (() => {
        const s = sites.find(x => x._id === menu.id);
        if (!s) return null;
        return (
          <>
            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
            <div style={{ position: 'fixed', top: menu.y, left: menu.x, background: '#0f1729', border: '1px solid #2a3448', borderRadius: 6, padding: 4, minWidth: 160, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setMenu(null); window.open(s.url, '_blank'); }} style={menuItem}>Open Site ↗</button>
              <button onClick={() => handleDelete(s._id, s.name)} style={{ ...menuItem, color: '#fca5a5' }}>Delete</button>
            </div>
          </>
        );
      })()}

      <AddSiteModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => loadSites()} />
    </>
  );
}

const menuItem = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', color: '#e2e8f0', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer' };

function StatCard({ color, label, val, sub }) {
  return (
    <div className="stat-card"><div className="stat-card-top">
      <div className={`stat-icon ${color}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div>
      <div className="stat-text"><div className="stat-label">{label}</div><div className="stat-value">{val}</div><div className="stat-sub">{sub}</div></div>
      <div className="stat-sparkline"><Sparkline id={`s-${label.replace(/\s/g,'')}`} color="#5b46f5" points="2,18 12,14 22,16 32,10 42,12 52,8 66,10" /></div>
    </div></div>
  );
}
