import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import AddSiteModal from '../components/AddSiteModal';
import ScoreRing from '../components/ScoreRing';
import Pagination from '../components/Pagination';
import { healthStatusMeta } from '../healthStatus';
import { otpStatusMeta } from '../otpStatus';
import { api } from '../api';
import { resolveHomePerfScore } from '../perfScore';
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
// Mirrors routes/scans.js's own hostFromUrl() exactly, so navigating from
// here to /scans?site=<this> matches the same `site` string the Scans page
// filters by (both are derived from the identical Site.url value).
function hostFromUrl(url) {
  try { const u = new URL(url); return u.hostname + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : ''); }
  catch { return url; }
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
    // alertCounts only has entries for "high" severity alerts (see
    // loadAlertCounts) — once it's loaded (not null), a missing key means
    // the site genuinely has zero high-severity alerts, so show 0, not "—".
    // "—" is reserved for the not-loaded-yet state (alertCounts === null).
    alerts: alertCounts ? (alertCounts[site._id] || 0) : null,
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

// Downsamples a site's history to one point per calendar day — the LAST
// (most recent) successful scan of that day. The automated scan runs
// hourly (see .github/workflows/daily-scan.yml), so without this a "7
// Days" view would plot up to 24 points per day, all squashed under the
// same date label — this is what made the chart look "wrong"/too dense.
function bucketHistoryPerDay(points) {
  const byDay = new Map();
  for (const p of points) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const existing = byDay.get(key);
    if (!existing || new Date(p.date) > new Date(existing.date)) byDay.set(key, p);
  }
  return [...byDay.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Downsamples the last 24 hours to 12 evenly-spaced points (one per
// 2-hour window) instead of all 24 hourly scans. Each slot picks whichever
// successful scan falls inside its window — since the history endpoint
// already only returns ok:true snapshots, a slot whose top-of-hour scan
// failed naturally just uses the next successful one within that same
// window instead (no separate fail-handling needed). A slot with no
// successful scan at all (site was down that whole window) is skipped
// rather than faked, so the line just has a gap there.
function bucketHistoryLast24h(points, slots = 12) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const stepMs = windowMs / slots;
  const start = now - windowMs;
  const result = [];
  for (let i = 0; i < slots; i++) {
    const slotStart = start + i * stepMs;
    const slotEnd = slotStart + stepMs;
    const hit = points.find(p => {
      const t = new Date(p.date).getTime();
      return t >= slotStart && t < slotEnd;
    });
    if (hit) result.push(hit);
  }
  return result;
}

const qaBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' };

function OverviewTab({ site, snap, setTab, syncing, onSyncNow }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('7 Days');
  // Raw (un-bucketed) snapshot history, fetched ONCE per site over a fixed
  // 7-day window — that single window covers both the "7 Days" and "1 Day"
  // views, so switching the dropdown below never re-fetches; it only
  // re-buckets this same array client-side (see `history` below), making
  // the toggle instant instead of showing a loading flicker.
  const [rawHistory, setRawHistory] = useState([]);
  const d = snap?.data || {};

  // "Agregga" is VYNOX's own connector-adjacent plugin (the payment plugin
  // installed alongside vynox-connector.php on every client site) — the
  // full plugin list with per-plugin active/inactive status already comes
  // through in d.plugins.plugins (see vynox-connector.php's
  // vynox_get_plugins_info()), so no backend/plugin change is needed here,
  // just picking it out of the existing list for its own status row.
  const agreggaPlugin = (d.plugins?.plugins || []).find(p => (p.name || '').trim().toLowerCase() === 'agregga');

  useEffect(() => {
    if (!site?._id) return;
    api.siteHistory(site._id, 7)
      .then(r => setRawHistory(r.points || []))
      .catch(() => setRawHistory([]));
  }, [site?._id]);

  const history = useMemo(
    () => (period === '1 Day' ? bucketHistoryLast24h(rawHistory) : bucketHistoryPerDay(rawHistory)),
    [rawHistory, period]
  );

  // Memoized so this function reference only changes when the chart's
  // actual data does — see the comment where it's passed to ChartCanvas
  // below for why that matters with updateInPlace.
  const chartConfig = useMemo(() => () => {
    const pts = history;
    const labels = pts.map(p => period === '1 Day'
      ? new Date(p.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const criticalData    = pts.map(p => p.critical);
    const recommendedData = pts.map(p => p.recommended);
    return {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Critical', data: criticalData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)', tension: 0.42, fill: true, pointRadius: 3.5, borderWidth: 2, pointBackgroundColor: '#ef4444' },
        { label: 'Recommended', data: recommendedData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', tension: 0.42, fill: true, pointRadius: 3.5, borderWidth: 2, pointBackgroundColor: '#f59e0b' },
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', maxTicksLimit: 12 } }, y: { min: 0, grid: { color: 'rgba(30,37,53,0.7)' }, ticks: { color: '#5a6480', stepSize: 1 } } } },
    };
  }, [history, period]);

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
        <div className="info-item">
          <div className="info-icon ii-cyan"><svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>
          <div><div className="info-label">Active Plugins</div><div className="info-val">{d.plugins?.active ?? '—'} of {d.plugins?.total ?? '—'}</div></div>
        </div>
        <div className="info-item">
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
          <CustomSelect sm value={period} onChange={setPeriod} options={['7 Days', '1 Day']} />
        </div>
        <div className="sdp-chart-wrap">
          {/* updateInPlace: switching the dropdown only re-buckets already-
              fetched data (see `history` above) — this makes ChartCanvas
              animate the transition (Chart.js's own update animation)
              instead of hard-cutting to a freshly recreated chart.
              `config` is memoized on [history, period] — without that, a
              fresh (ctx) => {...} closure gets created on EVERY render,
              which ChartCanvas's effect treats as "config changed", so any
              unrelated re-render of this page (e.g. the 30s alert-count/
              PageSpeed polls up in Sites()) kept calling chart.update()
              and restarting the animation — the chart never looked like it
              settled down. */}
          <ChartCanvas
            updateInPlace
            config={chartConfig}
            deps={[history, period]}
          />
        </div>
        {history.length <= 1 && <div style={{ fontSize: 11, color: '#5a6480', textAlign: 'center', marginTop: 4 }}>History requires multiple snapshots — check back after the next scan</div>}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', background: '#0a1120', border: '1px solid #1a2333', borderRadius: 12, padding: '16px 18px' }}>
          <div className="sdp-block-title" style={{ marginBottom: 6 }}>Latest Scan Summary</div>
          <div className="detail-list">
            <Row k="Scan Status" v={!snap ? '—' : <span style={{ color: snap.ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{snap.ok ? 'Completed' : 'Failed'}</span>} />
            <Row k="Scan Type" v={snap ? 'Full Scan' : '—'} />
            <Row k="Scan Started" v={snap?.fetchedAt ? fmtDate(snap.fetchedAt) : '—'} />
            {/* Not tracked yet — Snapshot only records fetchedAt (a single
                timestamp), not a start/end pair, so there's nothing real to
                compute here. Shown as "—" rather than a fabricated number,
                same convention this app already uses everywhere else for
                data that hasn't been collected yet. */}
            <Row k="Scan Duration" v="—" />
            <Row k="Files Scanned" v={snap?.ok ? (d.malware?.files_scanned ?? 0).toLocaleString() : '—'} />
          </div>
          <button
            onClick={() => navigate(`/scans?site=${encodeURIComponent(hostFromUrl(site.url))}`)}
            style={{ marginTop: 12, width: '100%', background: 'transparent', border: '1px solid #2a3448', color: '#c8d0e0', borderRadius: 8, padding: '9px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            View All Scans
          </button>
        </div>

        <div style={{ flex: '1 1 280px', background: '#0a1120', border: '1px solid #1a2333', borderRadius: 12, padding: '16px 18px' }}>
          <div className="sdp-block-title" style={{ marginBottom: 10 }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Exact same action as the "Sync Now" row item in the Sites
                list's 3-dot menu (see handleSyncNow in Sites()) — sharing
                the same syncingIds state means triggering it from either
                place shows "processing" in BOTH the list's preview/eye icon
                AND this button at once. */}
            <button
              onClick={() => onSyncNow?.(site._id)}
              disabled={syncing}
              style={{ ...qaBtnStyle, gap: 8, background: syncing ? '#2a2f45' : '#5b46f5', color: '#fff', cursor: syncing ? 'default' : 'pointer' }}
            >
              {syncing && <span className="sync-spinner" />}
              {syncing ? 'Scanning…' : 'Run New Scan'}
            </button>
            <button onClick={() => setTab?.('alerts')} style={{ ...qaBtnStyle, background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>View Site Alerts</button>
            <button onClick={() => setTab?.('backups')} style={{ ...qaBtnStyle, background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>View Backups</button>
            <button onClick={() => setTab?.('screenshots')} style={{ ...qaBtnStyle, background: 'rgba(122,131,158,0.14)', color: '#c8d0e0' }}>View Screenshots</button>
          </div>
        </div>
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

      <div style={{ marginTop: 22 }}>
        <Imunify360StatusCard site={site} onSaved={onSaved} />
      </div>
    </div>
  );
}

// Tracks whether THIS site's own hosting server has allowlisted our
// X-Vynox-Bot header in Imunify360 (or similar bot-protection). This is a
// per-SERVER setting — see models/Site.js's comment on imunify360Status —
// so every site needs this checked/fixed independently, even if another
// site's server is already allowlisted. scripts/runOtpCheck.js auto-detects
// "blocked" from a real failed request; the user manually confirms
// "allowlisted" here after fixing it in that site's cPanel (see
// Imunify360_Allowlist_Guide.md for the exact steps).
function Imunify360StatusCard({ site, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const status = site.imunify360Status || 'unknown';

  const META = {
    unknown:     { label: 'Not checked yet', color: '#7a839e', bg: 'rgba(122,131,158,0.08)', border: 'rgba(122,131,158,0.25)' },
    blocked:     { label: 'Blocked by Imunify360', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
    allowlisted: { label: 'Allowlisted', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' },
  };
  const meta = META[status] || META.unknown;

  async function markAllowlisted() {
    setSaving(true); setError(null);
    try {
      await api.setImunify360Status(site._id, 'allowlisted');
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: '#0a1120', border: '1px solid #1a2333', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e6e9f0' }}>Imunify360 Allowlist Status</div>
          <div style={{ fontSize: 11.5, color: '#7a839e', marginTop: 2 }}>
            Whether THIS site's own hosting server allows our automated OTP delivery check through its firewall. This is per-server — fixing it for one site does not fix another site on a different server.
          </div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap' }}>
          {meta.label}
        </span>
      </div>

      {status === 'blocked' && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
          Our last OTP check on this site was rejected by its Imunify360 firewall as bot traffic. Log into <b>this site's own cPanel</b> → Imunify360 → WAF → Additional Rules/Allowlist, and add a rule allowing requests carrying the <code>X-Vynox-Bot</code> header (see <code>Imunify360_Allowlist_Guide.md</code> for the exact secret value and steps). Once done, click the button below.
        </div>
      )}

      {error && <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>{error}</div>}

      {status !== 'allowlisted' && (
        <button
          onClick={markAllowlisted}
          disabled={saving}
          style={{ marginTop: 10, background: saving ? '#2a2f45' : '#5b46f5', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
        >
          {saving ? 'Saving…' : "I've added the allowlist rule — mark resolved"}
        </button>
      )}
      {status === 'allowlisted' && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#7a839e' }}>
          Marked as allowlisted on {site.imunify360CheckedAt ? new Date(site.imunify360CheckedAt).toLocaleString() : 'unknown date'}. If OTP checks still fail with an Imunify360 error, the rule may need re-checking.
        </div>
      )}
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
        // Home ('/') is a permanent, locked-in selection — every site gets
        // screenshots/PageSpeed on its homepage no matter what, whether this
        // is a brand-new site (no saved selection yet) or one being edited.
        // Force it into `selected` here (not just visually) so a save right
        // after load — without touching anything — still includes it.
        if (!initial['/']) initial['/'] = { label: 'Home', enabled: true };
        setSelected(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [site?._id]);

  useEffect(() => { load(); }, [load]);

  function toggle(candidate) {
    // Home can never be unchecked — it's a permanent monitored page.
    if (candidate.path === '/') return;
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
    // Belt-and-suspenders: guarantee Home is in the payload even if
    // `selected` somehow lost it, so it's genuinely impossible to save a
    // selection without the homepage included.
    const withHome = selected['/'] ? selected : { ...selected, '/': { label: 'Home', enabled: true } };
    const pages = Object.entries(withHome).map(([path, v]) => ({ label: v.label, path, enabled: v.enabled !== false }));
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
            const isHome = c.path === '/';
            const isSel = isHome || !!selected[c.path];
            const info = selected[c.path];
            return (
              <label
                key={c.path}
                className={`mpe-row ${isSel ? 'mpe-row-selected' : 'mpe-row-unselected'}`}
                title={isHome ? 'Home is always monitored and cannot be unselected' : undefined}
                style={isHome ? { cursor: 'default' } : undefined}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  disabled={isHome}
                  onChange={() => toggle(c)}
                  style={{ accentColor: '#5b46f5', width: 15, height: 15, flexShrink: 0, opacity: isHome ? 0.75 : 1 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mpe-label">{c.label}</div>
                  <div className="mpe-path">{c.path}</div>
                </div>
                {isHome && (
                  <span style={{ fontSize: 10, color: '#a5b4fc', background: 'rgba(91,70,245,0.12)', border: '1px solid rgba(91,70,245,0.3)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    Always monitored
                  </span>
                )}
                {!isHome && info?.matchStatus === 'mismatch' && (
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

// `alerts` comes straight from the backend's persisted Alert collection
// (GET /api/alerts, pre-filtered to this site by the caller) — the exact
// same data source the "Alerts" column and this tab's header count
// (selectedRow.alerts) are built from. This used to recompute its own,
// much smaller alert list straight from the snapshot (only 6 checks vs.
// the backend's ~15+), which is why the count in the tab header never
// matched what was actually listed below it.
function AlertsTab({ alerts }) {
  const list = alerts || [];
  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">Active Alerts</div>
        <a className="view-link" href="/alerts">View All Alerts</a>
      </div>
      {list.length === 0 && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No active alerts — site looks clean.</div>}
      {list.map((a) => (
        <div className="sdp-alert" key={a.id}>
          <div className={`sdp-alert-icon ${a.severity === 'high' ? 'sai-red' : 'sai-orange'}`}>
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="sdp-alert-body"><div className="sdp-alert-title">{a.name}</div><div className="sdp-alert-sub">{a.desc}</div></div>
          <div className="sdp-alert-right"><span className={`sev ${a.sevCls}`}>{a.sevLabel}</span></div>
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
  // Mobile and Desktop are independent PageSpeedResult documents server-side
  // (see models/PageSpeedResult.js's strategy field), so the frontend keeps
  // BOTH the results cache AND the "is a check currently running" flag keyed
  // by siteId+strategy, not just siteId — this way "Check Now" always acts
  // on whichever strategy is toggled, and a Mobile check running in the
  // background doesn't block (or get confused with) a Desktop one for the
  // same site.
  const [strategy, setStrategy] = useState('mobile');
  const cacheKey = `${siteId}:${strategy}`;
  const pages = pagesBySite[cacheKey] ?? null;
  const checking = !!checkingSites[cacheKey];
  const [loading, setLoading] = useState(!pages);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!siteId) return;
    setLoading(true);
    api.pageSpeedLatest(siteId, strategy)
      .then(r => setPagesBySite(prev => ({ ...prev, [cacheKey]: r.pages || [] })))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId, strategy, cacheKey, setPagesBySite]);

  useEffect(() => { load(); }, [load]);

  // On mount (including after a page reload, which wipes all React state) or
  // when the toggle switches to a strategy we haven't checked yet in this
  // session, ask the server whether a check is already running for this
  // site+strategy — the "checking" flag above only lives in memory, so a
  // reload would otherwise show "Check Now" as idle even while a background
  // run is still in progress. If one is running, start polling immediately.
  useEffect(() => {
    if (!siteId || checkingSites[cacheKey]) return;
    api.pageSpeedStatus(siteId, strategy)
      .then(r => { if (r.checking) setCheckingSites(prev => ({ ...prev, [cacheKey]: true })); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, strategy, cacheKey]);

  // While checkingSites[cacheKey] is true, poll the server every 5s to find
  // out when the background PageSpeed run finishes, then refresh the results.
  useEffect(() => {
    if (!siteId || !checkingSites[cacheKey]) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await api.pageSpeedStatus(siteId, strategy);
        if (cancelled) return;
        if (!r.checking) {
          setCheckingSites(prev => ({ ...prev, [cacheKey]: false }));
          load();
        }
      } catch { /* transient network hiccup — just try again next tick */ }
    };
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId, strategy, cacheKey, checkingSites[cacheKey], load, setCheckingSites]);

  // At least one monitored page must be selected AND actually checkable
  // (not disabled, not currently mismatched against the live sitemap) before
  // "Check Now" is allowed to run — this mirrors the exact same filter the
  // backend applies in services/pagespeed.js's checkSitePageSpeed
  // (p.enabled !== false && p.matchStatus !== 'mismatch'). Without this, a
  // freshly-added site where nobody has opened Settings > Monitored Pages
  // yet would let the user click "Check Now" immediately, which the backend
  // would just reject with a 409 ("pages not configured yet") anyway — this
  // catches that earlier, in the UI, with a clearer message and a disabled
  // button instead of a confusing error after the click.
  const hasCheckablePage = !!pages && pages.some(p => p.enabled !== false && p.matchStatus !== 'mismatch');

  async function runCheck() {
    if (!hasCheckablePage) {
      setError('No monitored pages are selected for this site yet. Go to the Details tab and save at least one page (e.g. Home) before running a check.');
      return;
    }
    setError(null);
    try {
      await api.pageSpeedCheck(siteId, strategy); // returns as soon as the run is queued (202) — does not wait for it to finish
      setCheckingSites(prev => ({ ...prev, [cacheKey]: true })); // the poll effect above takes it from here
    } catch (e) {
      // 409 means one was already running (e.g. from another tab/device) —
      // treat it the same as "now checking" instead of surfacing an error.
      if (e.status === 409) setCheckingSites(prev => ({ ...prev, [cacheKey]: true }));
      else setError(e.message);
    }
  }

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">Real Performance Score (Google PageSpeed)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: '#0d1520', border: '1px solid #1a2333', borderRadius: 7, padding: 2 }}>
            {['mobile', 'desktop'].map(s => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                style={{
                  background: strategy === s ? '#5b46f5' : 'transparent',
                  color: strategy === s ? '#fff' : '#7a839e',
                  border: 'none', borderRadius: 5, padding: '5px 12px', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={runCheck}
            disabled={checking || (!loading && !hasCheckablePage)}
            title={!loading && !hasCheckablePage ? 'Select and save at least one monitored page in the Details tab first' : undefined}
            style={{
              background: checking ? '#2a2f45' : (!loading && !hasCheckablePage) ? '#1a2233' : '#5b46f5',
              color: checking ? '#a5b4fc' : (!loading && !hasCheckablePage) ? '#5a6480' : '#fff',
              border: 'none',
              padding: '6px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
              cursor: (checking || (!loading && !hasCheckablePage)) ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
            {checking && (
              <span style={{
                width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(165,180,252,0.35)',
                borderTopColor: '#a5b4fc', display: 'inline-block', animation: 'spin 0.8s linear infinite',
              }} />
            )}
            {checking ? 'Checking…' : `Check Now (${strategy === 'desktop' ? 'Desktop' : 'Mobile'})`}
          </button>
        </div>
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
      {!loading && !checking && !hasCheckablePage && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#fbbf7a', fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>
            No monitored pages are selected for this site yet, so "Check Now" is disabled. Go to the Details tab, select at least one page (e.g. Home), and save before running a check.
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
        Desktop scores also refresh automatically twice a day. Click "Check Now" anytime to re-check whichever strategy is selected above. Powered by Google PageSpeed Insights.
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

// Per-site OTP delivery-check history — a running list of every check that
// has run for THIS site (2x/day, see .github/workflows/otp-check.yml),
// showing when it ran and whether it passed, failed, or was blocked by the
// site's own Imunify360 firewall. Fetches independently of the connector
// snapshot (like Performance/Screenshots tabs), since OTP checks don't
// depend on the daily security scan having run.
function OtpCheckerTab({ site }) {
  const [checks, setChecks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!site?._id) return;
    setLoading(true); setError(null);
    api.otpCheckHistory(90, site._id)
      .then(r => setChecks(r.checks || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [site?._id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">OTP Email Delivery Checks</div>
      </div>
      <div style={{ fontSize: 11.5, color: '#7a839e', margin: '0 0 12px' }}>
        Runs automatically 2x/day (~12:00 AM and ~12:00 PM PKT) — verifies this site's checkout OTP email actually gets delivered, end to end. A "Blocked (Imunify360)" result means the site's own hosting firewall rejected the check as bot traffic, not that OTP delivery itself is broken — see the Imunify360 Allowlist Status card in the Details tab to resolve it.
      </div>

      {loading && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
      {!loading && error && <div style={{ padding: 16, color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {!loading && !error && (!checks || checks.length === 0) && (
        <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No OTP checks recorded yet for this site.</div>
      )}

      {!loading && checks && checks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map((c) => {
            const meta = otpStatusMeta(c);
            const badgeColor = meta.cls === 'hs-good' ? '#22c55e' : meta.cls === 'hs-critical' ? '#ef4444' : meta.cls === 'hs-warning' ? '#f59e0b' : '#7a839e';
            const badgeBg = meta.cls === 'hs-good' ? 'rgba(34,197,94,0.1)' : meta.cls === 'hs-critical' ? 'rgba(239,68,68,0.1)' : meta.cls === 'hs-warning' ? 'rgba(245,158,11,0.1)' : 'rgba(122,131,158,0.1)';
            return (
              <div key={c._id} style={{ padding: '10px 12px', borderRadius: 8, background: '#0d1520', border: '1px solid #182031' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: '#e6e9f0', minWidth: 150 }}>
                    {c.checkedAt ? new Date(c.checkedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown time'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}33`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>
                  {c.overallStatus === 'pass' && typeof c.deliveryLatencyMs === 'number' && (
                    <span style={{ fontSize: 11.5, color: '#22c55e' }}>Delivered in {(c.deliveryLatencyMs / 1000).toFixed(1)}s</span>
                  )}
                  {c.otpProvider && (
                    <span style={{ fontSize: 11, color: '#7a839e' }}>via {c.otpProvider === 'vynox' ? 'Vynox Commerce' : 'WooCommerce Email OTP Verification'}</span>
                  )}
                </div>
                {meta.reason && (
                  <div style={{ marginTop: 5, fontSize: 11.5, color: '#8892a8' }}>{meta.reason}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Finds every leftover reference to an old domain (e.g. after migrating
// vizkart.com -> vizkart.pk) across every live page of this site — home,
// contact, about, categories, single products, everywhere — via
// GET/POST /api/url-check/:siteId (services/urlReferenceCheck.js). Doesn't
// depend on `snap` (this crawls the LIVE site directly, not the connector
// snapshot), so — like OtpCheckerTab — it's rendered in its own branch
// below instead of through the shared snap-gated TabBody path.
function UrlCheckerTab({ site }) {
  const [oldDomain, setOldDomain] = useState('');
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!site?._id) return;
    api.urlCheckLatest(site._id)
      .then(r => setCheck(r.check))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [site?._id]);

  useEffect(() => { load(); }, [load]);

  // A scan can take minutes on a large catalog — poll while it's running so
  // progress (scannedPages/totalPages) updates without a manual refresh.
  useEffect(() => {
    if (check?.status !== 'running') return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [check?.status, load]);

  async function startCheck() {
    const domain = oldDomain.trim();
    if (!domain || !site?._id) return;
    setStarting(true); setError(null);
    try {
      await api.urlCheckRun(site._id, domain);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  const running = check?.status === 'running';
  const hasMatches = (check?.matches?.length || 0) > 0;

  return (
    <div className="sdp-tab-content active">
      <div className="sdp-block-head">
        <div className="sdp-block-title">URL Reference Checker</div>
      </div>
      <div style={{ fontSize: 11.5, color: '#7a839e', margin: '0 0 12px' }}>
        Scans every live page this site has — home, contact, about, categories, single products — for leftover mentions of an old domain (e.g. after migrating vizkart.com → vizkart.pk). Pages are discovered from three sources combined (the sitemap, WordPress's own REST API, and a same-site link crawl starting from the homepage), since a sitemap alone doesn't work reliably on every site.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Old domain, e.g. vizkart.com"
          value={oldDomain}
          onChange={(e) => setOldDomain(e.target.value)}
          disabled={running}
          style={{ flex: '1 1 240px', padding: '8px 12px', borderRadius: 6, border: '1px solid #232b3d', background: '#0d1520', color: '#e6e9f0', fontSize: 13 }}
        />
        <button
          onClick={startCheck}
          disabled={running || starting || !oldDomain.trim()}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: (running || starting) ? '#3a3f55' : '#5b46f5', color: '#fff', fontSize: 13, cursor: (running || starting) ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {running ? 'Scanning…' : starting ? 'Starting…' : 'Scan Now'}
        </button>
      </div>

      {loading && <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: '8px 0', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {!loading && !check && !error && (
        <div style={{ padding: 16, color: '#7a839e', fontSize: 13 }}>No check run yet for this site — enter the old domain above and click Scan Now.</div>
      )}

      {check && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0d1520', border: '1px solid #182031', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span style={{ color: '#e6e9f0' }}>Searching for: <strong>{check.oldDomain}</strong></span>
            <span style={{
              fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px',
              color: running ? '#f59e0b' : check.status === 'failed' ? '#ef4444' : (hasMatches ? '#ef4444' : '#22c55e'),
              background: running ? 'rgba(245,158,11,0.1)' : check.status === 'failed' ? 'rgba(239,68,68,0.1)' : (hasMatches ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'),
            }}>
              {running ? 'Running' : check.status === 'failed' ? 'Failed' : hasMatches ? `${check.matches.length} page(s) with matches` : 'Clean'}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: '#8892a8' }}>
            {check.phase === 'discovering'
              ? `Finding pages to check — ${check.phaseLabel || 'starting…'} (${check.totalPages || 0} found so far)`
              : <>Scanned {check.scannedPages || 0} of {check.totalPages || (running ? '…' : 0)} pages found</>}
            {check.truncated ? ' — site has more pages than this run could check (truncated)' : ''}
            {check.unreachablePages > 0 ? ` — ${check.unreachablePages} page(s) didn't respond` : ''}
          </div>
          {check.status === 'failed' && check.error && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: '#fca5a5' }}>{check.error}</div>
          )}
        </div>
      )}

      {hasMatches && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {check.matches.map((m) => (
            <div key={m.pageUrl} style={{ padding: '10px 12px', borderRadius: 8, background: '#1a0f10', border: '1px solid #3a1f22' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <a href={m.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', fontSize: 12.5, wordBreak: 'break-all' }}>{m.pageUrl}</a>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.matchCount} match{m.matchCount === 1 ? '' : 'es'}</span>
              </div>
              {m.snippets.map((s, i) => (
                <div key={i} style={{ marginTop: 5, fontSize: 11, color: '#d4a5a5', fontFamily: 'monospace', background: '#0d0808', padding: '4px 6px', borderRadius: 4, wordBreak: 'break-all' }}>{s}</div>
              ))}
              {m.matchCount > m.snippets.length && (
                <div style={{ marginTop: 4, fontSize: 10.5, color: '#8892a8' }}>+ {m.matchCount - m.snippets.length} more not shown</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 'alerts' and 'urlcheck' are deliberately absent here — both are rendered
// directly (see the dedicated `tab === 'alerts'`/`tab === 'urlcheck'`
// branches below) rather than through the shared snap-gated TabBody path.
const TAB_BODIES = { overview: OverviewTab, details: DetailsTab, scans: ScansTab, backups: BackupsTab, updates: UpdatesTab, performance: PerformanceTab, screenshots: ScreenshotsTab, otp: OtpCheckerTab };

export default function Sites() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-sites'); return () => setPageClass(''); }, [setPageClass]);



  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [tags, setTags] = useState('All Tags');
  const [sitesPage, setSitesPage] = useState(1);
  // Status/search filters reshuffle which rows match, so jump back to page
  // 1 — otherwise the user can be left on a page that no longer exists for
  // the new filtered set.
  useEffect(() => { setSitesPage(1); }, [status, search]);
  const [tab, setTab] = useState('overview');
  const [addOpen, setAddOpen] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [snap, setSnap] = useState(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }
  const [syncingIds, setSyncingIds] = useState({}); // { [siteId]: boolean } — "Sync Now" row action in progress

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
  // Raw active-alert rows from the backend (GET /api/alerts), kept as-is so
  // the site detail page's Alerts tab (below) can list the exact same
  // alerts the "Alerts" column/tab-header count is based on — it used to
  // recompute its own (smaller, out-of-sync) list from the snapshot instead.
  const [allAlerts, setAllAlerts] = useState([]);
  const loadAlertCounts = useCallback(() => {
    api.listAlerts()
      .then((r) => {
        setAllAlerts(r.alerts || []);
        const counts = {};
        // Only count "high" severity alerts here — medium/low items (plugin
        // updates, site-health "recommended" notices, etc.) already have
        // their own signal (the Updates column, or the Alerts page itself),
        // so folding them into this column made it look like every site had
        // a pile of real problems when most of the count was routine noise.
        (r.alerts || []).forEach((a) => {
          if (a.severity !== 'high') return;
          counts[a.siteId] = (counts[a.siteId] || 0) + 1;
        });
        setAlertCounts(counts);
      })
      .catch(() => {}); // leave alertCounts/allAlerts as-is — column falls back to "—"
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
        // Prefer 'desktop' (kept fresh automatically — 6-hourly internal job
        // + daily pagespeed-desktop.yml workflow); fall back to 'mobile' if
        // desktop has no successful result; show a real 0 (not '—') only if
        // both strategies were attempted and neither succeeded — see
        // src/perfScore.js for the full reasoning.
        resolveHomePerfScore((strategy) => api.pageSpeedLatest(s._id, strategy))
          .then(score => { if (!cancelled) setHomePerfScores(prev => ({ ...prev, [s._id]: score })); })
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

  async function handleSyncNow(id) {
    setMenu(null);
    if (syncingIds[id]) return;
    setSyncingIds(prev => ({ ...prev, [id]: true }));
    try {
      await api.syncSite(id);
      // Refreshes lastSyncedAt/status/latest/PHP/WP for this row.
      await loadSites();
      // Also kick off an immediate alert-count refresh (fire-and-forget —
      // loadAlertCounts doesn't return its promise) instead of waiting up
      // to 30s for its own poll interval — the sync just changed the exact
      // data alerts are derived from.
      loadAlertCounts();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    } finally {
      setSyncingIds(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  }

  const rows = sites.map((s) => rowFor(s, alertCounts));
  const filteredRows = rows.filter(r => {
    if (status === 'Online'  && !r.online) return false;
    if (status === 'Offline' && r.online)  return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.name} ${r.sub}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const SITES_PAGE_SIZE = 8;
  const sitesTotalPages = Math.max(1, Math.ceil(filteredRows.length / SITES_PAGE_SIZE));
  const sitesPageSafe = Math.min(sitesPage, sitesTotalPages);
  const sitesPageStart = (sitesPageSafe - 1) * SITES_PAGE_SIZE;
  const pagedRows = filteredRows.slice(sitesPageStart, sitesPageStart + SITES_PAGE_SIZE);

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
                  {!loading && pagedRows.map((s) => {
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
                            <button
                              title={syncingIds[s.id] ? 'Syncing…' : 'Preview'}
                              onClick={() => !syncingIds[s.id] && setSelectedId(s.id)}
                              disabled={!!syncingIds[s.id]}
                              style={{ background: isSel ? '#5b46f5' : 'rgba(91,70,245,0.15)', border: 'none', color: isSel ? '#fff' : '#5b46f5', width: 28, height: 28, borderRadius: 5, cursor: syncingIds[s.id] ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {syncingIds[s.id]
                                ? <span className="sync-spinner" />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
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

            {filteredRows.length > 0 && (
              <div className="table-foot">
                <span className="foot-text">Showing {sitesPageStart + 1} to {Math.min(sitesPageStart + SITES_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} sites</span>
                <Pagination page={sitesPageSafe} totalPages={sitesTotalPages} onChange={setSitesPage} />
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
                    {/* Same ScoreRing (PageSpeed Performance score, colored
                        ring) the "Health Status" column already uses in the
                        All Sites table — this used to show HealthBadge's
                        text-based WP Site Health badge instead, which looked
                        inconsistent with the list right next to it. */}
                    <ScoreRing val={homePerfScores[selected._id] ?? null} label="Health Status" />
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
                    { key: 'otp', label: 'OTP Checker' },
                    { key: 'urlcheck', label: 'URL Checker' },
                  ].map(t => (
                    <div key={t.key} className={`sdp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                  ))}
                </div>

                <div className="sdp-body">
                  {/* Performance + Screenshots + OTP Checker all fetch their own data
                      independent of the connector snapshot, so they render even
                      before a daily security scan has run. */}
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
                  {tab === 'otp' && <OtpCheckerTab site={selected} />}
                  {tab === 'urlcheck' && <UrlCheckerTab site={selected} />}
                  {/* Alerts come from the backend's Alert collection (already
                      fetched for the "Alerts" column above), not from this
                      site's snapshot — so, unlike the other tabs below, this
                      one doesn't need to wait on snap/snapLoading. */}
                  {tab === 'alerts' && (
                    <AlertsTab alerts={allAlerts.filter(a => a.siteId === selected._id)} />
                  )}
                  {tab !== 'performance' && tab !== 'screenshots' && tab !== 'otp' && tab !== 'alerts' && tab !== 'urlcheck' && (
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
                      {/* setTab/syncing/onSyncNow are only used by OverviewTab's
                          Quick Actions box — harmless extra props for the
                          other tabs sharing this render path (Details/
                          Scans/Backups/Updates), which simply ignore them. */}
                      {!snapLoading && snap && (
                        <TabBody
                          site={selected}
                          snap={snap}
                          onSaved={loadSites}
                          setTab={setTab}
                          syncing={!!syncingIds[selected._id]}
                          onSyncNow={handleSyncNow}
                        />
                      )}
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
              <button onClick={() => handleSyncNow(s._id)} disabled={!!syncingIds[s._id]} style={{ ...menuItem, opacity: syncingIds[s._id] ? 0.5 : 1 }}>
                {syncingIds[s._id] ? 'Syncing…' : 'Sync Now'}
              </button>
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
