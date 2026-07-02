import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import AddSiteModal from '../components/AddSiteModal';
import { api } from '../api';
import '../styles/sites.css';

const alertCls = n => n === 0 ? 'an-zero' : n >= 6 ? 'an-red' : 'an-orange';
const updCls   = n => n === 0 ? 'upd-zero' : n >= 7 ? 'upd-red' : 'upd-orange';

function scoreColor(s) {
  if (s == null) return '#5a6480';
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#f59e0b';
  return '#ef4444';
}
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
function rowFor(site) {
  const l = site.latest || {};
  return {
    id: site._id, name: site.name, sub: site.url,
    score: l.score ?? null, color: scoreColor(l.score),
    online: site.status === 'online',
    alerts: l.alerts ?? null, upd: l.updates ?? null,
    php: l.phpVersion ?? '—',
    wp: l.wpVersion ?? site.wpVersion ?? '—',
    lastSyncedAt: site.lastSyncedAt,
    raw: site,
  };
}

function drawRing(canvas, score, color, lineWidth) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const s = canvas.width, cx = s/2, cy = s/2, r = s/2 - 3;
  const lw = lineWidth || 3.5;
  ctx.clearRect(0, 0, s, s);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = lw; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + (score/100)*Math.PI*2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}
function ScoreRing({ score, color, size = 36, lineWidth }) {
  const ref = useRef(null);
  useEffect(() => { drawRing(ref.current, score, color, lineWidth); }, [score, color, lineWidth]);
  return (
    <div className="score-ring-wrap">
      <canvas ref={ref} width={size} height={size} />
      <span className="score-ring-label">{score}%</span>
    </div>
  );
}
function DetailRing({ score, color }) {
  const ref = useRef(null);
  useEffect(() => { drawRing(ref.current, score ?? 0, color || '#5a6480', 6); }, [score, color]);
  return (
    <div className="sdp-ring-container">
      <canvas ref={ref} width={72} height={72} />
      <span className="sdp-ring-val">{score == null ? '—' : `${score}%`}</span>
    </div>
  );
}

/* ============ TABS — driven by selected site + snapshot ============ */

function OverviewTab({ site, snap }) {
  const [period, setPeriod] = useState('Last 7 Days');
  const [history, setHistory] = useState([]);
  const d = snap?.data || {};

  const periodDays = period === 'Last 30 Days' ? 30 : period === 'Last 90 Days' ? 90 : 7;

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
      </div>

      <div>
        <div className="sdp-chart-header">
          <div className="sdp-section-title">Security Score History</div>
          <CustomSelect sm value={period} onChange={setPeriod} options={['Last 7 Days', 'Last 30 Days', 'Last 90 Days']} />
        </div>
        <div className="sdp-chart-wrap">
          <ChartCanvas config={(ctx) => {
            const c = scoreColor(site?.latest?.score);
            const pts = history.length > 0 ? history : (site?.latest?.score != null ? [{ date: new Date().toISOString(), score: site.latest.score }] : []);
            const labels = pts.map(p => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const data   = pts.map(p => p.score);
            return {
              type: 'line',
              data: { labels, datasets: [{ data, borderColor: c, backgroundColor: 'rgba(91,70,245,0.10)', tension: 0.42, fill: true, pointRadius: 3.5, borderWidth: 2, pointBackgroundColor: c }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', maxTicksLimit: 7 } }, y: { min: 0, max: 100, grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', callback: v => v + '%', stepSize: 25 } } } },
            };
          }} deps={[history]} />
        </div>
        {history.length <= 1 && <div style={{ fontSize: 11, color: '#5a6480', textAlign: 'center', marginTop: 4 }}>History requires multiple snapshots — sync again to build history</div>}
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

function DetailsTab({ site, snap }) {
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

const TAB_BODIES = { overview: OverviewTab, details: DetailsTab, alerts: AlertsTab, scans: ScansTab, backups: BackupsTab, updates: UpdatesTab };

export default function Sites() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-sites'); return () => setPageClass(''); }, [setPageClass]);



  const [status, setStatus] = useState('All Status');
  const [tags, setTags] = useState('All Tags');
  const [tab, setTab] = useState('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [snap, setSnap] = useState(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }

  const loadSites = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.listSites();
      setSites(r.sites || []);
      if ((r.sites || []).length && !selectedId) setSelectedId(r.sites[0]._id);
    } catch (e) { setLoadError(e.message); } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { loadSites(); }, [loadSites]);

  /* Auto-refresh when Scan All completes — no re-render every second */
  useEffect(() => {
    const handler = () => loadSites();
    window.addEventListener('vynox:scan-complete', handler);
    return () => window.removeEventListener('vynox:scan-complete', handler);
  }, [loadSites]);

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

  async function handleSync(id) {
    setSyncingId(id);
    try {
      await api.syncSite(id); // returns immediately — sync runs in background
      // Poll until the backend reports done or error
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const s = await api.syncStatus(id);
        if (s.status === 'done' || s.status === 'error') break;
      }
      await loadSites();
    } catch (e) { alert('Sync failed: ' + e.message); }
    finally { setSyncingId(null); }
  }
  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This removes the site and all its snapshots.`)) return;
    setMenu(null);
    try {
      await api.deleteSite(id);
      if (selectedId === id) setSelectedId(null);
      await loadSites();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  const rows = sites.map(rowFor);
  const filteredRows = rows.filter(r => {
    if (status === 'Online'  && !r.online) return false;
    if (status === 'Offline' && r.online)  return false;
    return true;
  });

  const selected = sites.find(s => s._id === selectedId) || null;
  const selectedRow = selected ? rowFor(selected) : null;
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
          <div className="stat-text"><div className="stat-label">Sites with Alerts</div><div className="stat-value">{sites.filter(s => (s.latest?.alerts || 0) > 0).length}</div><div className="stat-sub red">Have active alerts</div></div>
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
                <input type="text" placeholder="Search sites..." />
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
                    <th>Site</th><th>Security Score</th><th>Status</th><th>Alerts</th><th>Last Scan</th><th>Updates</th><th>PHP</th><th>WP</th><th>Actions</th>
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
                        <td>{s.score == null ? <span style={{ color: '#5a6480', fontSize: 12 }}>—</span> : <ScoreRing score={s.score} color={s.color} />}</td>
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
                            <button className="scan-btn" onClick={() => handleSync(s.id)} disabled={syncingId === s.id}>{syncingId === s.id ? '…' : 'Sync'}</button>
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
                    <DetailRing score={selectedRow?.score} color={selectedRow?.color} />
                    <div className="sdp-score-lbl">Security Score</div>
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
                  ].map(t => (
                    <div key={t.key} className={`sdp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                  ))}
                </div>

                <div className="sdp-body">
                  {snapLoading && <div style={{ padding: 24, color: '#7a839e', textAlign: 'center' }}>Loading data…</div>}
                  {!snapLoading && !snap && (
                    <div style={{ padding: 24, color: '#7a839e', textAlign: 'center' }}>
                      No snapshot yet for this site. <button onClick={() => handleSync(selectedId)} style={{ marginLeft: 6, background: '#5b46f5', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer' }}>Sync Now</button>
                    </div>
                  )}
                  {!snapLoading && snap && <TabBody site={selected} snap={snap} />}
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
              <button onClick={() => { setMenu(null); handleSync(s._id); }} style={menuItem}>Sync Now</button>
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
