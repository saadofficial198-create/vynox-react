import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import '../styles/notifications.css';

const INITIAL = [
  { id: 1, name: 'Critical security alert on example.com', desc: 'Malicious file detected: wp-content/themes/evil.php', searchKey: 'critical security alert example.com malicious file', iconCls: 'ni-red', d: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, type: 'critical', typeLabel: 'Critical', typeCls: 'tb-critical', site: 'example.com', siteLabel: 'Main Site', time: ['2 minutes ago', 'May 22, 2024 10:28 AM'], status: 'unread' },
  { id: 2, name: '3 plugin updates available', desc: 'Wordfence, WooCommerce and Yoast SEO have updates', searchKey: '3 plugin updates wordfence woocommerce yoast seo myshop.com', iconCls: 'ni-orange', d: <><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></>, type: 'update', typeLabel: 'Update', typeCls: 'tb-update', site: 'myshop.com', siteLabel: 'My Store', time: ['15 minutes ago', 'May 22, 2024 10:15 AM'], status: 'unread' },
  { id: 3, name: 'Backup completed on mysite.com', desc: 'Daily scheduled backup completed successfully', searchKey: 'backup completed mysite.com daily scheduled', iconCls: 'ni-green', d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, type: 'backup', typeLabel: 'Backup', typeCls: 'tb-backup', site: 'mysite.com', siteLabel: 'Blog Site', time: ['1 hour ago', 'May 22, 2024 09:30 AM'], status: 'read' },
  { id: 4, name: 'WordPress core update available', desc: 'WordPress 6.5.3 is now available (current: 6.4.2)', searchKey: 'wordpress core update available clientsite.com', iconCls: 'ni-blue', d: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>, type: 'update', typeLabel: 'Update', typeCls: 'tb-update', site: 'clientsite.com', siteLabel: 'Client Site', time: ['2 hours ago', 'May 22, 2024 08:45 AM'], status: 'read' },
  { id: 5, name: 'Login attempt blocked on blogsite.com', desc: 'Blocked login attempt from IP 185.198.10.23', searchKey: 'login attempt blocked blogsite.com ip', iconCls: 'ni-purple', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, type: 'security', typeLabel: 'Security', typeCls: 'tb-security', site: 'blogsite.com', siteLabel: 'Blog Site', time: ['3 hours ago', 'May 22, 2024 07:40 AM'], status: 'read' },
  { id: 6, name: 'System scan completed', desc: 'Scan completed on 10 sites. 2 issues found.', searchKey: 'system scan completed 10 sites 2 issues', iconCls: 'ni-cyan', d: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>, type: 'system', typeLabel: 'System', typeCls: 'tb-system', site: 'All Sites', siteLabel: '', time: ['4 hours ago', 'May 22, 2024 06:20 AM'], status: 'read' },
  { id: 7, name: 'High resource usage detected on shopnow.com', desc: 'Server CPU usage is above 85%', searchKey: 'high resource usage shopnow.com cpu', iconCls: 'ni-amber', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, type: 'warning', typeLabel: 'Warning', typeCls: 'tb-warning', site: 'shopnow.com', siteLabel: 'Shop Now', time: ['5 hours ago', 'May 22, 2024 05:15 AM'], status: 'read' },
  { id: 8, name: 'Update process completed', desc: 'All pending updates have been installed successfully', searchKey: 'update process completed all pending', iconCls: 'ni-green', d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, type: 'system', typeLabel: 'System', typeCls: 'tb-system', site: 'All Sites', siteLabel: '', time: ['Yesterday, 11:30 PM', 'May 21, 2024 11:30 PM'], status: 'read' },
  { id: 9, name: 'Manual backup created on example.com', desc: 'Backup size: 245.6 MB', searchKey: 'manual backup example.com 245.6 mb', iconCls: 'ni-purple', d: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, type: 'backup', typeLabel: 'Backup', typeCls: 'tb-backup', site: 'example.com', siteLabel: 'Main Site', time: ['Yesterday, 10:25 PM', 'May 21, 2024 10:25 PM'], status: 'read' },
  { id: 10, name: 'New API key generated', desc: "API key 'Production Key' has been generated.", searchKey: 'new api key generated production vynox account', iconCls: 'ni-cyan', d: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>, type: 'system', typeLabel: 'System', typeCls: 'tb-system', site: 'VYNOX Account', siteLabel: '', time: ['Yesterday, 09:10 PM', 'May 21, 2024 09:10 PM'], status: 'read' },
];

const TABS = [
  { key: 'all', label: 'All (128)' },
  { key: 'unread', label: 'Unread (12)' },
  { key: 'critical', label: 'Critical (6)' },
  { key: 'warnings', label: 'Warnings (18)' },
  { key: 'informational', label: 'Informational (104)' },
];

const donutConfig = {
  type: 'doughnut',
  data: { datasets: [{ data: [32, 28, 20, 18, 18, 12], backgroundColor: ['#8b5cf6','#3b82f6','#22c55e','#06b6d4','#f59e0b','#6b7280'], borderWidth: 0, hoverOffset: 4 }] },
  options: { responsive: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (c) => ` ${['Security','Updates','Backups','System','Warnings','Others'][c.dataIndex]}: ${c.raw}` } } } },
};

export default function Notifications() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-notifications'); return () => setPageClass(''); }, [setPageClass]);

  const [rows, setRows] = useState(INITIAL);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchTab =
        tab === 'all' ? true :
        tab === 'unread' ? r.status === 'unread' :
        tab === 'critical' ? r.type === 'critical' :
        tab === 'warnings' ? r.type === 'warning' :
        tab === 'informational' ? (r.type !== 'critical' && r.type !== 'warning') :
        true;
      const matchSearch = !term || r.searchKey.includes(term);
      return matchTab && matchSearch;
    });
  }, [rows, tab, search]);

  const markAllRead = () => setRows(rows.map(r => ({ ...r, status: 'read' })));

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-purple"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div className="stat-info"><div className="stat-label">Total Notifications</div><div className="stat-value">128</div><div className="stat-trend trend-up">↑ 18% vs last 7 days</div></div>
          <div className="stat-sparkline"><Sparkline id="n-g1" color="#8b5cf6" points="2,20 14,16 26,18 38,12 50,14 60,10" width={60} height={28} viewBox="0 0 60 28" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-blue"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
          <div className="stat-info"><div className="stat-label">Unread Notifications</div><div className="stat-value">12</div><div className="stat-trend trend-up">↑ 20% vs last 7 days</div></div>
          <div className="stat-sparkline"><Sparkline id="n-g2" color="#3b82f6" points="2,22 14,18 26,20 38,14 50,16 60,12" width={60} height={28} viewBox="0 0 60 28" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-red"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-info"><div className="stat-label">Critical</div><div className="stat-value">6</div><div className="stat-trend trend-down">↓ 14% vs last 7 days</div></div>
          <div className="stat-sparkline"><Sparkline id="n-g3" color="#ef4444" points="2,14 14,18 26,10 38,20 50,8 60,14" width={60} height={28} viewBox="0 0 60 28" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-info"><div className="stat-label">Warnings</div><div className="stat-value">18</div><div className="stat-trend trend-down">↓ 5% vs last 7 days</div></div>
          <div className="stat-sparkline"><Sparkline id="n-g4" color="#f97316" points="2,18 14,14 26,20 38,12 50,16 60,10" width={60} height={28} viewBox="0 0 60 28" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-row">
          <div className="stat-circle sc-green"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
          <div className="stat-info"><div className="stat-label">Informational</div><div className="stat-value">104</div><div className="stat-trend trend-up">↑ 12% vs last 7 days</div></div>
          <div className="stat-sparkline"><Sparkline id="n-g5" color="#22c55e" points="2,22 14,18 26,20 38,14 50,16 60,8" width={60} height={28} viewBox="0 0 60 28" /></div>
        </div></div>
      </div>

      <div className="notif-layout">
        <div className="notif-main">
          <div className="panel">
            <div className="notif-tabbar">
              <div className="notif-tabs">
                {TABS.map(t => (
                  <div key={t.key} className={`tab-item${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                ))}
              </div>
              <div className="tab-actions">
                <div className="mark-read-btn" onClick={markAllRead}>
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Mark all as read
                </div>
                <div className="more-btn">⋯</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" className="tbl-check" /></th>
                  <th style={{ minWidth: 280 }}>Notification</th>
                  <th>Type</th>
                  <th style={{ minWidth: 120 }}>Related To</th>
                  <th style={{ minWidth: 140 }}>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr className="no-results-row"><td colSpan={7}>No notifications match your filters.</td></tr>
                ) : visible.map(r => (
                  <tr key={r.id} className={r.status === 'unread' ? 'unread-row' : undefined}>
                    <td><input type="checkbox" className="tbl-check" /></td>
                    <td>
                      <div className="notif-cell">
                        <div className={`notif-icon ${r.iconCls}`}><svg viewBox="0 0 24 24">{r.d}</svg></div>
                        <div><div className="notif-title">{r.name}</div><div className="notif-desc">{r.desc}</div></div>
                      </div>
                    </td>
                    <td><span className={`type-badge ${r.typeCls}`}>{r.typeLabel}</span></td>
                    <td><div className="related-site">{r.site}</div>{r.siteLabel && <div className="related-label">{r.siteLabel}</div>}</td>
                    <td><div className="time-ago">{r.time[0]}</div><div className="time-full">{r.time[1]}</div></td>
                    <td><div className="status-cell"><span className={`status-dot sd-${r.status}`} /><span className={`st-${r.status}`}>{r.status === 'unread' ? 'Unread' : 'Read'}</span></div></td>
                    <td>
                      <div className="action-cell">
                        <div className="eye-btn"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
                        <div className="dots-btn">⋮</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tbl-footer">
              <span className="tbl-footer-text">Showing {visible.length} of 128 notifications</span>
              <div className="footer-right">
                <div className="pagination">
                  <div className="pg-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>
                  <div className="pg-btn active">1</div><div className="pg-btn">2</div><div className="pg-btn">3</div>
                  <div className="pg-dots">...</div><div className="pg-btn">13</div>
                  <div className="pg-btn"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
                </div>
                <CustomSelect sm up value="10 / page" onChange={() => {}} options={['10 / page', '25 / page', '50 / page']} />
              </div>
            </div>
          </div>
        </div>

        <div className="notif-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Notifications by Type</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                <ChartCanvas config={donutConfig} width={120} height={120} />
                <div className="donut-center"><div className="donut-num">128</div><div className="donut-lbl">Total</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#8b5cf6' }} /><div className="dl-name">Security</div><div className="dl-val">32</div><div className="dl-pct">(25%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }} /><div className="dl-name">Updates</div><div className="dl-val">28</div><div className="dl-pct">(21%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#22c55e' }} /><div className="dl-name">Backups</div><div className="dl-val">20</div><div className="dl-pct">(16%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#06b6d4' }} /><div className="dl-name">System</div><div className="dl-val">18</div><div className="dl-pct">(14%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }} /><div className="dl-name">Warnings</div><div className="dl-val">18</div><div className="dl-pct">(14%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#6b7280' }} /><div className="dl-name">Others</div><div className="dl-val">12</div><div className="dl-pct">(10%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Recent Notification Activity</div><span className="view-link">View All</span></div>
            {[
              { cls: 'ni-red', d: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/></>, title: 'Critical alert on example.com', time: '2 minutes ago', dot: '#ef4444' },
              { cls: 'ni-orange', d: <><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></>, title: '3 plugin updates available', time: '15 minutes ago', dot: '#f97316' },
              { cls: 'ni-green', d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, title: 'Backup completed on mysite.com', time: '1 hour ago', dot: '#22c55e' },
              { cls: 'ni-blue', d: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>, title: 'WordPress update available', time: '2 hours ago', dot: '#3b82f6' },
              { cls: 'ni-purple', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, title: 'Login attempt blocked', time: '3 hours ago', dot: '#8b5cf6' },
            ].map((r, i) => (
              <div className="rna-item" key={i}>
                <div className={`rna-icon ${r.cls}`}><svg viewBox="0 0 24 24">{r.d}</svg></div>
                <div className="rna-body"><div className="rna-title">{r.title}</div></div>
                <div className="rna-time">{r.time}</div>
                <div className="rna-dot" style={{ background: r.dot }} />
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Notification Channels</div></div>
            <div className="channels-subtitle">Manage how you receive notifications</div>
            {[
              { cls: 'ci-blue', d: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>, name: 'Email Notifications', sub: 'ali@vynox.com' },
              { cls: 'ci-pink', d: <path d="M22.08 9c-.85-4.46-4.84-7.86-9.65-8-.2 0-.39.01-.58.02C6.27 1.28 2 6.05 2 11.83c0 2.29.77 4.35 1.97 5.97L2.89 22l4.71-1.37c1.14.46 2.41.72 3.73.72h.01c5.88 0 10.72-4.78 10.72-10.67 0-.59-.04-1.17-.11-1.74l-.07.06z"/>, name: 'Slack Notifications', sub: '#vynox-alerts' },
              { cls: 'ci-red', d: <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>, name: 'Webhook Notifications', sub: '2 Endpoints' },
              { cls: 'ci-cyan', d: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>, name: 'In-App Notifications', sub: 'Browser / Dashboard' },
            ].map((c, i) => (
              <div className="channel-item" key={i}>
                <div className={`channel-icon ${c.cls}`}><svg viewBox="0 0 24 24">{c.d}</svg></div>
                <div className="channel-body"><div className="channel-name">{c.name}</div><div className="channel-desc">{c.sub}</div></div>
                <div className="channel-active"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Active</div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
            <div className="qa-grid">
              <div className="qa-card" onClick={markAllRead}>
                <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div className="qa-label">Mark all as read</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
                <div className="qa-label">Notification Settings</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <div className="qa-label">Export Notifications</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></div>
                <div className="qa-label">Clear All</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
