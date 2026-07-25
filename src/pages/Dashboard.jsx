import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import HealthBadge from '../components/HealthBadge';
import { api } from '../api';
import '../styles/dashboard.css';

function Sparkline({ id, color, points }) {
  return (
    <svg width="68" height="32" viewBox="0 0 68 32">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${points} 66,32 2,32`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function alertCls(n) { return n === 0 ? 'an-green' : n >= 6 ? 'an-red' : 'an-orange'; }
function updCls(n)   { return n === 0 ? 'upd-gray' : 'upd-orange'; }

// Maps OtpCheck.overallStatus to a badge style (reusing the existing
// hs-good/hs-warning/hs-critical/hs-unknown health-badge color classes) and
// a one-line human-readable reason, so a failure is diagnosable at a glance.
const OTP_STATUS_META = {
  pass:                       { label: 'Working',                       cls: 'hs-good',     reason: null },
  fail_plugin_inactive:       { label: 'Failed',                        cls: 'hs-critical', reason: 'OTP or WP Mail SMTP plugin is inactive' },
  fail_smtp_not_configured:   { label: 'Failed',                        cls: 'hs-critical', reason: 'WP Mail SMTP is not configured' },
  fail_checkout_trigger:      { label: 'Failed',                        cls: 'hs-critical', reason: 'Checkout did not trigger the OTP popup' },
  fail_email_not_received:    { label: 'Failed',                        cls: 'hs-critical', reason: 'Email not received (checkout works)' },
  error:                      { label: 'Error',                         cls: 'hs-warning',  reason: 'Check could not complete — see logs' },
};
function otpStatusMeta(status) {
  return OTP_STATUS_META[status] || { label: 'Not yet checked', cls: 'hs-unknown', reason: null };
}
function otpDotCls(check) {
  if (!check) return 'hs-unknown';
  return otpStatusMeta(check.overallStatus).cls;
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

export default function Dashboard() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-dashboard'); return () => setPageClass(''); }, [setPageClass]);

  const [sites, setSites]     = useState([]);
  const [alerts, setAlerts]   = useState([]);
  const [scans, setScans]     = useState([]);
  const [backups, setBackups] = useState({ summary: {}, backups: [] });
  const [loading, setLoading] = useState(true);
  const [otpCheck, setOtpCheck]     = useState(null);
  const [otpHistory, setOtpHistory] = useState([]);
  const [otpLoading, setOtpLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listSites(), api.listAlerts(), api.listScans(), api.listBackups()])
      .then(([s, a, sc, b]) => { setSites(s.sites || []); setAlerts(a.alerts || []); setScans(sc.scans || []); setBackups(b); })
      .catch(() => {})
      .finally(() => setLoading(false));

    Promise.all([api.otpCheckLatest(), api.otpCheckHistory(30)])
      .then(([latest, hist]) => { setOtpCheck(latest.check || null); setOtpHistory((hist.checks || []).slice(0, 5)); })
      .catch(() => {})
      .finally(() => setOtpLoading(false));
  }, []);

  const stats = useMemo(() => {
    const good     = sites.filter(s => s.latest?.status === 'good').length;
    const warning  = sites.filter(s => s.latest?.status === 'warning').length;
    const critical = sites.filter(s => s.latest?.status === 'critical').length;
    const needsAttention = warning + critical;
    const high = alerts.filter(a => a.severity === 'high').length;
    const med  = alerts.filter(a => a.severity === 'medium').length;
    const low  = alerts.filter(a => a.severity === 'low').length;
    const scans7d = scans.filter(s => s.date && (Date.now() - new Date(s.date).getTime() < 7 * 86400000)).length;
    return { totalSites: sites.length, good, warning, critical, needsAttention, totalAlerts: alerts.length, high, med, low, scans7d, backupsOk: backups.summary?.success || 0 };
  }, [sites, alerts, scans, backups]);

  const STAT_CARDS = [
    { iconCls: 'si-blue',    icon: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>, label: 'Total Sites', value: stats.totalSites, sub: 'All Connected Sites', sparkId: 'grad-3b82f6', color: '#3b82f6', points: '2,22 12,18 22,20 32,14 42,16 52,12 66,14' },
    { iconCls: stats.needsAttention === 0 ? 'si-green' : 'si-red', icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>, label: 'Sites Needing Attention', value: stats.needsAttention, sub: `${stats.good} Good · ${stats.warning} Warning · ${stats.critical} Critical`, subCls: stats.needsAttention === 0 ? 'green' : 'red', sparkId: 'grad-22c55e', color: stats.needsAttention === 0 ? '#22c55e' : '#ef4444', points: '2,22 12,18 22,20 32,14 42,16 52,10 66,8' },
    { iconCls: 'si-red',     icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, label: 'Total Alerts', value: stats.totalAlerts, sub: `${stats.high} high · ${stats.med} medium · ${stats.low} low`, subCls: 'red', sparkId: 'grad-ef4444', color: '#ef4444', points: '2,16 12,20 22,12 32,22 42,10 52,18 66,14' },
    { iconCls: 'si-cyan',    icon: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, label: 'Scans (Last 7 Days)', value: stats.scans7d, sub: 'Across all sites', sparkId: 'grad-06b6d4', color: '#06b6d4', points: '2,18 12,14 22,18 32,12 42,14 52,10 66,12' },
    { iconCls: 'si-emerald', icon: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>, label: 'Backups OK', value: `${stats.backupsOk} / ${stats.totalSites}`, sub: backups.summary?.totalBackupSize ? `${backups.summary.totalBackupSize} total` : '—', sparkId: 'grad-10b981', color: '#10b981', points: '2,18 12,22 22,16 32,18 42,12 52,14 66,10' },
  ];

  const lineChartConfig = useMemo(() => (ctx) => {
    const gradCrit = ctx.createLinearGradient(0, 0, 0, 185);
    gradCrit.addColorStop(0, 'rgba(239,68,68,0.3)'); gradCrit.addColorStop(1, 'rgba(239,68,68,0.0)');
    const gradRec = ctx.createLinearGradient(0, 0, 0, 185);
    gradRec.addColorStop(0, 'rgba(245,158,11,0.25)'); gradRec.addColorStop(1, 'rgba(245,158,11,0.0)');
    // Bucket scans by day → total critical + recommended issue counts across all sites that day
    const days = []; const criticalData = []; const recommendedData = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000);
      days.push(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const scansThatDay = scans.filter(s => { const d = new Date(s.date); return d.toDateString() === dt.toDateString(); });
      criticalData.push(scansThatDay.length ? scansThatDay.reduce((a, b) => a + (b.critical || 0), 0) : null);
      recommendedData.push(scansThatDay.length ? scansThatDay.reduce((a, b) => a + (b.recommended || 0), 0) : null);
    }
    return {
      type: 'line',
      data: { labels: days, datasets: [
        { label: 'Critical', data: criticalData, borderColor: '#ef4444', backgroundColor: gradCrit, tension: 0.42, fill: true, pointBackgroundColor: '#ef4444', pointRadius: 4, borderWidth: 2.2, spanGaps: true },
        { label: 'Recommended', data: recommendedData, borderColor: '#f59e0b', backgroundColor: gradRec, tension: 0.42, fill: true, pointBackgroundColor: '#f59e0b', pointRadius: 4, borderWidth: 2.2, spanGaps: true },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1 } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.8)' }, ticks: { color: '#5a6480' } }, y: { min: 0, grid: { color: 'rgba(30,37,53,0.8)' }, ticks: { color: '#5a6480', stepSize: 1 } } } },
    };
  }, [scans]);

  const donutChartConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [stats.high, stats.med, stats.low], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '70%', animation: false, plugins: { legend: { display: false } } },
  }), [stats.high, stats.med, stats.low]);

  const pct = (n) => stats.totalAlerts ? ((n / stats.totalAlerts) * 100).toFixed(1) : '0';
  const sitesTop5 = sites.slice(0, 5);

  return (
    <>
      <div className="stat-cards">
        {STAT_CARDS.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-top">
              <div className={`stat-icon ${s.iconCls}`}><svg viewBox="0 0 24 24">{s.icon}</svg></div>
              <div className="stat-text">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className={`stat-sub${s.subCls ? ' ' + s.subCls : ''}`}>{s.sub}</div>
              </div>
              <div className="stat-sparkline"><Sparkline id={s.sparkId} color={s.color} points={s.points} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="top-row">
        <div className="top-left">

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-header">
              <div className="panel-title">Sites Overview</div>
              <a className="view-link" href="/sites">View All Sites →</a>
            </div>
            <table>
              <thead>
                <tr><th>Site</th><th>Health Status</th><th>Alerts</th><th>Last Scan</th><th>Updates</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loading && (<tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#7a839e' }}>Loading…</td></tr>)}
                {!loading && sitesTop5.length === 0 && (<tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#7a839e' }}>No sites yet — add one in Sites page.</td></tr>)}
                {!loading && sitesTop5.map((s) => {
                  const status = s.latest?.status;
                  const alerts = s.latest?.alerts ?? 0;
                  const upd = s.latest?.updates ?? 0;
                  return (
                    <tr key={s._id}>
                      <td>
                        <div className="site-cell">
                          <div className="wp-logo">W</div>
                          <div><div className="site-name">{s.name}</div><div className="site-sub">{(s.url || '').replace(/^https?:\/\//, '')}</div></div>
                        </div>
                      </td>
                      <td>{status ? <HealthBadge status={status} label={s.latest?.label} /> : <span style={{ color: '#5a6480', fontSize: 12 }}>—</span>}</td>
                      <td><span className={`alert-num ${alertCls(alerts)}`}>{alerts}</span></td>
                      <td>
                        <div className="lastscan-main">{relTime(s.lastSyncedAt)}</div>
                        <div className="lastscan-sub">{fmtDate(s.lastSyncedAt)}</div>
                      </td>
                      <td><span className={`upd-num ${updCls(upd)}`}>{upd}</span></td>
                      <td><div className={s.status === 'online' ? 'status-online' : 'status-offline'}><span className={s.status === 'online' ? 'dot-online' : 'dot-offline'} />{s.status === 'online' ? 'Online' : 'Offline'}</div></td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="tbl-footer">
              <span className="tbl-footer-text">Showing {Math.min(sitesTop5.length, sites.length)} of {sites.length} sites</span>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-header">
              <div className="panel-title">OTP Email Delivery (BoloCart)</div>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {otpLoading && <div style={{ color: '#7a839e', fontSize: 13 }}>Loading…</div>}
              {!otpLoading && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`health-badge ${otpDotCls(otpCheck)}`}>
                      <span className="health-dot" />
                      {otpStatusMeta(otpCheck?.overallStatus).label}
                    </span>
                    <span style={{ color: '#7a839e', fontSize: 12 }}>
                      Last checked: {otpCheck?.checkedAt ? `${relTime(otpCheck.checkedAt)} · ${fmtDate(otpCheck.checkedAt)}` : 'Never'}
                    </span>
                  </div>

                  {otpCheck && otpStatusMeta(otpCheck.overallStatus).reason && (
                    <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 12.5 }}>
                      {otpStatusMeta(otpCheck.overallStatus).reason}
                    </div>
                  )}
                  {otpCheck?.overallStatus === 'pass' && typeof otpCheck.deliveryLatencyMs === 'number' && (
                    <div style={{ marginTop: 8, color: '#22c55e', fontSize: 12.5 }}>
                      Delivered in {(otpCheck.deliveryLatencyMs / 1000).toFixed(1)}s
                    </div>
                  )}

                  {otpHistory.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#5a6480', fontSize: 11.5 }}>Last {otpHistory.length} checks:</span>
                      {otpHistory.map((c) => (
                        <span
                          key={c._id}
                          title={`${otpStatusMeta(c.overallStatus).label} — ${fmtDate(c.checkedAt)}`}
                          style={{
                            width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                            background: c.overallStatus === 'pass' ? '#22c55e' : c.overallStatus === 'error' ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mid-row" style={{ marginBottom: 14 }}>
            <div className="panel chart-panel">
              <div className="chart-inner">
                <div className="chart-header"><div className="panel-title">Issues (Last 7 Days)</div></div>
                <div className="chart-canvas-wrap">
                  {scans.length > 0 && <ChartCanvas config={lineChartConfig} />}
                  {scans.length === 0 && <div style={{ padding: 30, color: '#7a839e', textAlign: 'center' }}>No scans yet</div>}
                </div>
                <div className="chart-legend-row">
                  <div className="chart-legend-dot" style={{ background: '#ef4444' }} />Critical
                  <div className="chart-legend-dot" style={{ background: '#f59e0b', marginLeft: 14 }} />Recommended
                </div>
              </div>
            </div>

            <div className="panel donut-panel">
              <div className="panel-header"><div className="panel-title">Alerts by Severity</div></div>
              <div className="donut-inner">
                <div className="donut-wrap">
                  {stats.totalAlerts > 0 && <ChartCanvas config={donutChartConfig} width={140} height={140} />}
                  <div className="donut-center"><div className="donut-num">{stats.totalAlerts}</div><div className="donut-lbl">Total Alerts</div></div>
                </div>
                <div className="donut-legend">
                  <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }} /><div className="dl-name">High</div><div className="dl-val">{stats.high}</div><div className="dl-pct">({pct(stats.high)}%)</div></div>
                  <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }} /><div className="dl-name">Medium</div><div className="dl-val">{stats.med}</div><div className="dl-pct">({pct(stats.med)}%)</div></div>
                  <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }} /><div className="dl-name">Low</div><div className="dl-val">{stats.low}</div><div className="dl-pct">({pct(stats.low)}%)</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="top-right right-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Recent Alerts</div>
              <a className="view-link" href="/alerts">View All Alerts →</a>
            </div>
            {loading && <div style={{ padding: 14, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
            {!loading && alerts.length === 0 && <div style={{ padding: 14, color: '#22c55e', fontSize: 13 }}>✓ No active alerts</div>}
            {!loading && alerts.slice(0, 5).map((a) => (
              <div className="alert-item" key={a.id}>
                <div className={`al-icon ${a.severity === 'high' ? 'ali-red' : a.severity === 'medium' ? 'ali-yellow' : 'ali-blue'}`}>
                  <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div className="al-body"><div className="al-title">{a.name}</div><div className="al-site">{a.site}</div></div>
                <div className="al-right"><span className={`sev ${a.sevCls}`}>{a.sevLabel}</span><span className="al-time">{relTime(a.first)}</span></div>
              </div>
            ))}
            {alerts.length > 0 && <div className="panel-foot">Showing {Math.min(5, alerts.length)} of {alerts.length} alerts</div>}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Recent Scans</div>
              <a className="view-link" href="/scans">View All Scans →</a>
            </div>
            {loading && <div style={{ padding: 14, color: '#7a839e', fontSize: 13 }}>Loading…</div>}
            {!loading && scans.length === 0 && <div style={{ padding: 14, color: '#7a839e', fontSize: 13 }}>No scans yet</div>}
            {!loading && scans.slice(0, 5).map((s) => (
              <div className="scan-item" key={s.id}>
                <div className="sc-wp">W</div>
                <div className="sc-body"><div className="sc-name">{s.site}</div><div className="sc-type">{s.type}</div></div>
                <span className="sc-time">{relTime(s.date)}</span>
                <span className="sc-badge">{s.statusLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="qa-panel">
        <div className="panel-title">Quick Actions</div>
        <div className="qa-grid">
          <a href="/sites" className="qa-card" style={{ textDecoration: 'none' }}>
            <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
            <div><div className="qa-label">Add New Site</div><div className="qa-sub">Connect WordPress Site</div></div>
          </a>
          <a href="/scans" className="qa-card" style={{ textDecoration: 'none' }}>
            <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <div><div className="qa-label">Run Scan</div><div className="qa-sub">Start scan on a site</div></div>
          </a>
          <a href="/alerts" className="qa-card" style={{ textDecoration: 'none' }}>
            <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
            <div><div className="qa-label">View Alerts</div><div className="qa-sub">{stats.totalAlerts} active</div></div>
          </a>
          <a href="/backups" className="qa-card" style={{ textDecoration: 'none' }}>
            <div className="qa-icon qi-orange"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
            <div><div className="qa-label">Manage Backups</div><div className="qa-sub">{backups.summary?.totalBackupSize || '—'}</div></div>
          </a>
          <a href="/updates" className="qa-card" style={{ textDecoration: 'none' }}>
            <div className="qa-icon qi-cyan"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div>
            <div><div className="qa-label">View Updates</div><div className="qa-sub">Plugin / Core / Theme</div></div>
          </a>
        </div>
      </div>
    </>
  );
}
