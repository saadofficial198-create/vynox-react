import { useEffect, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import CustomSelect from '../components/CustomSelect';
import Toggle from '../components/Toggle';
import { useScanner } from '../context/ScannerContext';
import { api } from '../api';
import { logout } from '../components/AuthGate';
import '../styles/settings.css';

// Turns a raw User-Agent string into something a human can actually read at
// a glance ("Chrome on Windows") for the Login Activity table below —
// deliberately simple regex matching (covers the handful of
// browsers/OSes anyone signing into this dashboard is realistically using),
// not a full UA-parsing library.
function describeUserAgent(ua) {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}
function fmtLoginTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const SETTINGS_NAV = [
  { group: 'General', items: [
    { active: true, label: 'General Settings', d: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></> },
    { label: 'Email Notifications', d: <><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></> },
    { label: 'Slack Notifications', d: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
    { label: 'Admin Accounts', d: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
    { label: 'Team Management', d: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
  ]},
  { group: 'Security', items: [
    { label: 'Security Settings', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> },
    { label: 'Two-Factor Auth', d: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
    { label: 'API Access', d: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/> },
  ]},
  { group: 'Automation', items: [
    { label: 'Scan Settings', d: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></> },
    { label: 'Backup Settings', d: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> },
    { label: 'Update Settings', d: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></> },
    { label: 'Alert Settings', d: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
  ]},
];

const completionConfig = {
  type: 'doughnut',
  data: { datasets: [{ data: [32, 6, 2], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] },
  options: { responsive: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (c) => ` ${['Configured','Pending','Not Configured'][c.dataIndex]}: ${c.raw}` } } } },
};

export default function Settings() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-settings'); return () => setPageClass(''); }, [setPageClass]);

  const { intervalKey, changeInterval } = useScanner();

  const [platformName, setPlatformName] = useState('VYNOX Security Monitor');
  const [timezone, setTimezone] = useState('(UTC +05:00) Asia/Karachi');
  const [dateFormat, setDateFormat] = useState('May 22, 2024 (MMM DD, YYYY)');
  const [timeFormat, setTimeFormat] = useState('12 Hour (09:30 AM)');
  const [itemsPerPage, setItemsPerPage] = useState('10 Items');
  const [defaultDash, setDefaultDash] = useState('Overview Dashboard');
  const [language, setLanguage] = useState('English');
  const [maintMode, setMaintMode] = useState(false);
  const [betaFeatures, setBetaFeatures] = useState(true);

  // Real data — everything else on this page is a static mock, but this
  // table is the actual audit log requested for the dashboard's
  // password gate (see routes/auth.js's GET /logins).
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loginAttemptsError, setLoginAttemptsError] = useState(null);
  useEffect(() => {
    api.loginHistory()
      .then(r => setLoginAttempts(r.attempts || []))
      .catch(e => setLoginAttemptsError(e.message));
  }, []);

  // Real data — site badges/categories, assignable to a site from its Edit
  // modal in the Sites list (see AddSiteModal's sibling, EditSiteModal).
  const [badges, setBadges] = useState([]);
  const [newBadgeName, setNewBadgeName] = useState('');
  const [addingBadge, setAddingBadge] = useState(false);
  const [badgeError, setBadgeError] = useState(null);
  const loadBadges = () => api.listBadges().then(r => setBadges(r.badges || [])).catch(() => {});
  useEffect(() => { loadBadges(); }, []);

  async function handleAddBadge(e) {
    e.preventDefault();
    const name = newBadgeName.trim();
    if (!name || addingBadge) return;
    setAddingBadge(true); setBadgeError(null);
    try {
      await api.createBadge(name);
      setNewBadgeName('');
      await loadBadges();
    } catch (err) {
      setBadgeError(err.message);
    } finally {
      setAddingBadge(false);
    }
  }

  async function handleDeleteBadge(id) {
    try {
      await api.deleteBadge(id);
      await loadBadges();
    } catch (err) {
      setBadgeError(err.message);
    }
  }

  // On-demand run of the 31-day screenshot retention cleanup (see
  // services/screenshotRetention.js) — shows exactly what it found/deleted
  // right here instead of needing to dig through cPanel's Node app logs.
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupError, setCleanupError] = useState(null);
  async function handleRunCleanup() {
    setCleanupRunning(true); setCleanupError(null); setCleanupResult(null);
    try {
      const r = await api.screenshotsCleanupNow();
      setCleanupResult(r);
    } catch (err) {
      setCleanupError(err.message);
    } finally {
      setCleanupRunning(false);
    }
  }

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-purple"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
          <div className="stat-info">
            <div className="stat-label">Settings Configured</div>
            <div className="stat-value">32 / 40</div>
            <div className="stat-foot">80% Completed</div>
            <div className="stat-progress"><div className="stat-progress-fill" style={{ width: '80%' }} /></div>
          </div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
          <div className="stat-info"><div className="stat-label">Security Score</div><div className="stat-value">92 / 100</div><div className="stat-foot green">Excellent</div></div>
          <div className="stat-sparkline"><svg width="58" height="30" viewBox="0 0 58 30"><polyline points="2,22 12,18 20,20 28,12 36,16 46,8 56,6" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div className="stat-info"><div className="stat-label">Last Changed</div><div className="stat-value">2h ago</div><div className="stat-foot">May 22, 2024 08:30 AM</div></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-orange"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div className="stat-info"><div className="stat-label">Active Admins</div><div className="stat-value">3</div><div className="stat-foot">Manage team members</div></div>
        </div></div>
        <div className="stat-card">
          <span className="status-dot-tr" />
          <div className="stat-card-row">
            <div className="stat-circle sc-purple"><svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            <div className="stat-info"><div className="stat-label">System Status</div><div className="stat-value">Healthy</div><div className="stat-foot green">All systems operational</div></div>
          </div>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          {SETTINGS_NAV.map(g => (
            <div key={g.group}>
              <div className="sn-group-label">{g.group}</div>
              {g.items.map((it, i) => (
                <div key={i} className={`sn-item${it.active ? ' active' : ''}`}>
                  <svg viewBox="0 0 24 24">{it.d}</svg>
                  {it.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="settings-center">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <div className="sch-title">General Settings</div>
                <div className="sch-sub">Manage your VYNOX Security Monitor general preferences and configurations.</div>
              </div>
              <button className="save-btn">
                <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Changes
              </button>
            </div>

            <div className="set-row">
              <div className="set-ico seti-purple"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
              <div className="set-body"><div className="set-label">Platform Name</div><div className="set-desc">This name will be used across the entire platform.</div></div>
              <div className="set-control"><input className="set-input" type="text" value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
              <div className="set-body"><div className="set-label">Platform Timezone</div><div className="set-desc">Set the default timezone for all dates and times.</div></div>
              <div className="set-control">
                <CustomSelect value={timezone} onChange={setTimezone} options={['(UTC +05:00) Asia/Karachi', '(UTC +04:00) Asia/Dubai', '(UTC +00:00) UTC', '(UTC -05:00) America/New_York']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-green"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
              <div className="set-body"><div className="set-label">Date Format</div><div className="set-desc">Choose the date format for displaying dates.</div></div>
              <div className="set-control">
                <CustomSelect value={dateFormat} onChange={setDateFormat} options={['May 22, 2024 (MMM DD, YYYY)', '22/05/2024 (DD/MM/YYYY)', '2024-05-22 (YYYY-MM-DD)']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-orange"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              <div className="set-body"><div className="set-label">Time Format</div><div className="set-desc">Choose the time format for displaying time.</div></div>
              <div className="set-control">
                <CustomSelect value={timeFormat} onChange={setTimeFormat} options={['12 Hour (09:30 AM)', '24 Hour (09:30)']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-cyan"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>
              <div className="set-body"><div className="set-label">Items Per Page</div><div className="set-desc">Set the number of items to display per page in tables.</div></div>
              <div className="set-control">
                <CustomSelect value={itemsPerPage} onChange={setItemsPerPage} options={['10 Items', '25 Items', '50 Items', '100 Items']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-pink"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></div>
              <div className="set-body"><div className="set-label">Default Dashboard</div><div className="set-desc">Choose the default dashboard to show after login.</div></div>
              <div className="set-control">
                <CustomSelect value={defaultDash} onChange={setDefaultDash} options={['Overview Dashboard', 'Sites Dashboard', 'Alerts Dashboard']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-amber"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
              <div className="set-body"><div className="set-label">Language</div><div className="set-desc">Select your preferred language.</div></div>
              <div className="set-control">
                <CustomSelect value={language} onChange={setLanguage} options={['English', 'Urdu', 'Arabic', 'Spanish']} />
              </div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-red"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
              <div className="set-body"><div className="set-label">Maintenance Mode</div><div className="set-desc">Put the system into maintenance mode.</div></div>
              <div className="set-control"><Toggle checked={maintMode} onChange={setMaintMode} /></div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-purple"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              <div className="set-body"><div className="set-label">Show Beta Features</div><div className="set-desc">Enable access to beta features.</div></div>
              <div className="set-control"><Toggle checked={betaFeatures} onChange={setBetaFeatures} /></div>
            </div>

            <div className="set-row">
              <div className="set-ico seti-green"><svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></div>
              <div className="set-body"><div className="set-label">Automatic Data Refresh</div><div className="set-desc">Automatically refresh data on dashboard.</div></div>
              <div className="set-control">
                <CustomSelect value={intervalKey} onChange={changeInterval} options={['Every 1 Hour', 'Every 5 Minutes', 'Every 1 Minute', 'Every 15 Minutes', 'Off']} />
              </div>
            </div>
          </div>
        </div>

        <div className="settings-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Settings Completion</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                <ChartCanvas config={completionConfig} width={110} height={110} />
                <div className="donut-center"><div className="donut-num">80%</div><div className="donut-lbl">Completed</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#22c55e' }} /><div className="dl-name">Configured</div><div className="dl-val">32</div><div className="dl-pct">(80%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }} /><div className="dl-name">Pending</div><div className="dl-val">6</div><div className="dl-pct">(15%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }} /><div className="dl-name">Not Configured</div><div className="dl-val">2</div><div className="dl-pct">(5%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Security Settings</div></div>
            {[
              { name: 'Two-Factor Authentication', d: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, enabled: true },
              { name: 'Strong Password Policy', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, enabled: true },
              { name: 'Login Activity Monitoring', d: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>, enabled: true },
              { name: 'Session Timeout (30 min)', d: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, enabled: true },
              { name: 'IP Whitelist', d: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>, enabled: false },
            ].map((s, i) => (
              <div className="sec-item" key={i}>
                <div className="sec-ico"><svg viewBox="0 0 24 24">{s.d}</svg></div>
                <div className="sec-name">{s.name}</div>
                <div className={`sec-status ${s.enabled ? 'sec-enabled' : 'sec-disabled'}`}>
                  {s.enabled ? 'Enabled' : 'Disabled'}
                  <svg viewBox="0 0 24 24">{s.enabled ? <polyline points="20 6 9 17 4 12"/> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}</svg>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Login Activity</div></div>
            <div style={{ padding: '4px 0 8px' }}>
              {loginAttemptsError && <div style={{ padding: '10px 16px', color: '#fca5a5', fontSize: 12.5 }}>{loginAttemptsError}</div>}
              {!loginAttemptsError && loginAttempts.length === 0 && (
                <div style={{ padding: '10px 16px', color: '#7a839e', fontSize: 12.5 }}>No login attempts recorded yet.</div>
              )}
              {loginAttempts.slice(0, 8).map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: i < loginAttempts.length - 1 ? '1px solid rgba(90,100,128,0.12)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.success ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: '#e2e8f0' }}>{a.ip || 'Unknown IP'} <span style={{ color: '#5a6480' }}>· {describeUserAgent(a.userAgent)}</span></div>
                    <div style={{ fontSize: 11, color: '#5a6480' }}>{fmtLoginTime(a.attemptedAt)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: a.success ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                    {a.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Site Badges</div></div>
            <div style={{ padding: '10px 16px 14px' }}>
              <div style={{ fontSize: 11.5, color: '#7a839e', marginBottom: 10 }}>
                Categories you can assign to a site from its Edit option in the Sites list (e.g. "E Commerce", "Chair", "Home & Lifestyle").
              </div>
              <form onSubmit={handleAddBadge} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={newBadgeName}
                  onChange={(e) => setNewBadgeName(e.target.value)}
                  placeholder="New badge name"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #232b3d', background: '#0a1120', color: '#e6e9f0', fontSize: 12.5 }}
                />
                <button
                  type="submit"
                  disabled={!newBadgeName.trim() || addingBadge}
                  style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: !newBadgeName.trim() || addingBadge ? '#2a2f45' : '#5b46f5', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: !newBadgeName.trim() || addingBadge ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {addingBadge ? 'Adding…' : 'Add Badge'}
                </button>
              </form>
              {badgeError && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>{badgeError}</div>}
              {badges.length === 0
                ? <div style={{ color: '#5a6480', fontSize: 12.5 }}>No badges created yet.</div>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {badges.map((b) => (
                      <span key={b._id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: b.color, background: `${b.color}1a`, border: `1px solid ${b.color}40` }}>
                        {b.name}
                        <button
                          onClick={() => handleDeleteBadge(b._id)}
                          title={`Delete "${b.name}"`}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: b.color, fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Screenshot Cleanup</div></div>
            <div style={{ padding: '10px 16px 14px' }}>
              <div style={{ fontSize: 11.5, color: '#7a839e', marginBottom: 10 }}>
                Screenshots older than 31 days are deleted automatically once a day. Run it now to see exactly what it finds/deletes, instead of waiting for the daily run.
              </div>
              <button
                onClick={handleRunCleanup}
                disabled={cleanupRunning}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: cleanupRunning ? '#2a2f45' : '#5b46f5', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: cleanupRunning ? 'default' : 'pointer' }}
              >
                {cleanupRunning ? 'Running…' : 'Run Cleanup Now'}
              </button>
              {cleanupError && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 10 }}>{cleanupError}</div>}
              {cleanupResult && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#c8d0e0', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: 4 }}>Pass 1 — DB-tracked screenshots</div>
                  Found {cleanupResult.dbPass.found} older than {cleanupResult.retentionDays} days.<br/>
                  Database: {cleanupResult.dbPass.dbDeleted} record(s) deleted.<br/>
                  cPanel files: {cleanupResult.dbPass.ftpDeleted} deleted
                  {cleanupResult.dbPass.ftpFailed?.length > 0 && <span style={{ color: '#fca5a5' }}> · {cleanupResult.dbPass.ftpFailed.length} failed</span>}
                  {cleanupResult.dbPass.noRelativePath > 0 && <span style={{ color: '#f59e0b' }}> · {cleanupResult.dbPass.noRelativePath} had no stored file path</span>}
                  .
                  {cleanupResult.dbPass.ftpFailed?.length > 0 && (
                    <FailedList items={cleanupResult.dbPass.ftpFailed} />
                  )}

                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: 10 }}>Pass 2 — orphan files (no DB record)</div>
                  Scanned {cleanupResult.orphanPass.totalFiles} file(s) on cPanel — {cleanupResult.orphanPass.found} were older than {cleanupResult.retentionDays} days with no matching database record.<br/>
                  Deleted {cleanupResult.orphanPass.deleted}
                  {cleanupResult.orphanPass.failed?.length > 0 && <span style={{ color: '#fca5a5' }}> · {cleanupResult.orphanPass.failed.length} failed</span>}
                  {cleanupResult.orphanPass.unparseable > 0 && <span style={{ color: '#f59e0b' }}> · {cleanupResult.orphanPass.unparseable} file(s) had an unrecognized name and were left alone</span>}
                  .
                  {cleanupResult.orphanPass.failed?.length > 0 && (
                    <FailedList items={cleanupResult.orphanPass.failed} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Notification Channels</div></div>
            {[
              { cls: 'nci-blue', d: <><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></>, name: 'Email Notifications', sub: 'ali@vynox.com' },
              { cls: 'nci-pink', d: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, name: 'Slack Notifications', sub: '#vynox-alerts' },
              { cls: 'nci-red', d: <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>, name: 'Webhook Notifications', sub: '2 Endpoints' },
            ].map((c, i) => (
              <div className="nch-item" key={i}>
                <div className={`nch-ico ${c.cls}`}><svg viewBox="0 0 24 24">{c.d}</svg></div>
                <div className="nch-body"><div className="nch-name">{c.name}</div><div className="nch-desc">{c.sub}</div></div>
                <div className="nch-active"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Active</div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
            <div className="qa-grid">
              {/* Only real action in this grid — everything else here is
                  decorative. Clears the session both server-side (DELETE
                  the Session doc) and client-side (sessionStorage), then
                  the login screen reappears immediately. */}
              <div className="qa-card" onClick={logout} style={{ cursor: 'pointer' }}>
                <div className="qa-icon qi-red"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
                <div className="qa-label">Logout</div>
                <div className="qa-sub">End this dashboard session</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></div>
                <div className="qa-label">Clear Cache</div>
                <div className="qa-sub">Free up system cache</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <div className="qa-label">Export Settings</div>
                <div className="qa-sub">Download config</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                <div className="qa-label">Import Settings</div>
                <div className="qa-sub">Upload config file</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-cyan"><svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></div>
                <div className="qa-label">Reset Settings</div>
                <div className="qa-sub">Restore defaults</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FailedList({ items }) {
  return (
    <div style={{ marginTop: 6, padding: 8, background: '#1a0f10', border: '1px solid #3a1f22', borderRadius: 6, maxHeight: 140, overflowY: 'auto' }}>
      {items.slice(0, 20).map((f, i) => (
        <div key={i} style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace', wordBreak: 'break-all' }}>{f.relativePath} — {f.error}</div>
      ))}
    </div>
  );
}
