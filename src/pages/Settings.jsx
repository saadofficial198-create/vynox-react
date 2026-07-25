import { useEffect, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import CustomSelect from '../components/CustomSelect';
import Toggle from '../components/Toggle';
import { useScanner } from '../context/ScannerContext';
import '../styles/settings.css';

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
