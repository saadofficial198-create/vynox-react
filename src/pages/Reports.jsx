import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import CustomSelect from '../components/CustomSelect';
import '../styles/reports.css';

const REPORTS = [
  { id: 1, name: 'Weekly Security Summary', desc: 'Comprehensive security overview', iconCls: 'ri-purple', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, site: 'example.com', siteLabel: 'Main Site', main: true, woo: false, type: 'Security', typeCls: 'tb-security', genDate: ['May 22, 2024', '10:30 AM'], range: ['May 16 – May 22, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '2.45 MB' },
  { id: 2, name: 'Full Scan Report', desc: 'Complete scan results and findings', iconCls: 'ri-teal', d: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, site: 'mystore.com', siteLabel: 'My Store', main: false, woo: true, type: 'Scan', typeCls: 'tb-scan', genDate: ['May 22, 2024', '07:15 AM'], range: ['May 22, 2024', 'One Time'], status: 'completed', statusLabel: 'Completed', size: '3.12 MB' },
  { id: 3, name: 'Backup Activity Report', desc: 'Backup overview and status', iconCls: 'ri-orange', d: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, site: 'blogsite.com', siteLabel: 'Blog Site', main: false, woo: false, type: 'Backup', typeCls: 'tb-backup', genDate: ['May 21, 2024', '09:20 PM'], range: ['May 14 – May 21, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '1.08 MB' },
  { id: 4, name: 'Updates Summary', desc: 'WordPress, plugins & themes updates', iconCls: 'ri-blue', d: <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></>, site: 'shopnow.com', siteLabel: 'Shop Now', main: false, woo: false, type: 'Update', typeCls: 'tb-update', genDate: ['May 21, 2024', '03:30 PM'], range: ['May 14 – May 21, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '1.67 MB' },
  { id: 5, name: 'Uptime Report', desc: 'Website uptime and performance', iconCls: 'ri-pink', d: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>, site: 'clientsite.com', siteLabel: 'Client Site', main: false, woo: false, type: 'Uptime', typeCls: 'tb-uptime', genDate: ['May 21, 2024', '01:10 PM'], range: ['May 14 – May 21, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '890 KB' },
  { id: 6, name: 'Critical Alerts Report', desc: 'All critical alerts and issues', iconCls: 'ri-red', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, site: 'newsportal.com', siteLabel: 'News Portal', main: false, woo: false, type: 'Security', typeCls: 'tb-security', genDate: ['May 20, 2024', '06:45 PM'], range: ['May 13 – May 20, 2024', '7 days'], status: 'failed', statusLabel: 'Failed', size: null },
  { id: 7, name: 'Database Health Report', desc: 'Database optimization and health', iconCls: 'ri-cyan', d: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>, site: 'portfolio.com', siteLabel: 'Portfolio Site', main: false, woo: false, type: 'Database', typeCls: 'tb-database', genDate: ['May 20, 2024', '11:20 AM'], range: ['May 13 – May 20, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '1.23 MB' },
  { id: 8, name: 'Monthly Security Report', desc: 'Monthly security overview', iconCls: 'ri-purple', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, site: 'magazine.com', siteLabel: 'Magazine', main: false, woo: false, type: 'Security', typeCls: 'tb-security', genDate: ['May 19, 2024', '08:30 PM'], range: ['Apr 19 – May 19, 2024', '30 days'], status: 'completed', statusLabel: 'Completed', size: '3.78 MB' },
  { id: 9, name: 'Compliance Report', desc: 'Security compliance and checks', iconCls: 'ri-green', d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, site: 'example.com', siteLabel: 'Main Site', main: true, woo: false, type: 'Compliance', typeCls: 'tb-compliance', genDate: ['May 19, 2024', '04:15 PM'], range: ['May 12 – May 19, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '2.11 MB' },
  { id: 10, name: 'Plugin Vulnerability Report', desc: 'Vulnerable plugins analysis', iconCls: 'ri-amber', d: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, site: 'mystore.com', siteLabel: 'My Store', main: false, woo: true, type: 'Security', typeCls: 'tb-security', genDate: ['May 18, 2024', '10:05 AM'], range: ['May 11 – May 18, 2024', '7 days'], status: 'completed', statusLabel: 'Completed', size: '1.34 MB' },
];

const TABS = [
  { key: 'all', label: 'All Reports' },
  { key: 'Security', label: 'Security Reports' },
  { key: 'Scan', label: 'Scan Reports' },
  { key: 'Backup', label: 'Backup Reports' },
  { key: 'Update', label: 'Update Reports' },
  { key: 'Uptime', label: 'Uptime Reports' },
];

const donutConfig = {
  type: 'doughnut',
  data: { labels: ['Security','Scan','Backup','Update','Uptime'], datasets: [{ data: [18, 12, 6, 6, 6], backgroundColor: ['#8b5cf6','#3b82f6','#f97316','#eab308','#a78bfa'], borderWidth: 0, hoverOffset: 4 }] },
  options: { responsive: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${(ctx.raw/48*100).toFixed(1)}%)` } } } },
};
const lineConfig = (ctx) => {
  const grad = ctx.createLinearGradient(0, 0, 0, 110);
  grad.addColorStop(0, 'rgba(91,70,245,0.28)');
  grad.addColorStop(1, 'rgba(91,70,245,0)');
  return {
    type: 'line',
    data: { labels: ['May 16','May 17','May 18','May 19','May 20','May 21','May 22'], datasets: [{ data: [4,6,8,12,9,16,10], borderColor: '#5b46f5', backgroundColor: grad, borderWidth: 2, pointBackgroundColor: '#5b46f5', pointBorderColor: '#010B19', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0d1829', borderColor: '#1e2535', borderWidth: 1, titleColor: '#c8d0e0', bodyColor: '#7a839e', padding: 8, callbacks: { label: (c) => ` ${c.raw} reports` } } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.6)', drawBorder: false }, ticks: { color: '#5a6480', font: { size: 9, family: 'Inter' } } }, y: { min: 0, max: 20, grid: { color: 'rgba(30,37,53,0.6)', drawBorder: false }, ticks: { stepSize: 5, color: '#5a6480', font: { size: 9, family: 'Inter' } } } } },
  };
};

const STAT_CARDS = [
  { iconCls: 'si-purple', d: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, label: 'Total Reports Generated', value: '48', trend: '↑ 20% vs last 7 days', trendCls: 'trend-up', color: '#8b5cf6', points: '0,22 10,18 20,20 30,12 40,14 50,8 60,10' },
  { iconCls: 'si-green', d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, label: 'Successful Reports', value: '38', trend: '↑ 26% vs last 7 days', trendCls: 'trend-up', color: '#22c55e', points: '0,24 10,20 20,22 30,14 40,10 50,6 60,8' },
  { iconCls: 'si-red', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, label: 'Failed Reports', value: '4', trend: '↓ 33% vs last 7 days', trendCls: 'trend-down', color: '#ef4444', points: '0,10 10,14 20,8 30,16 40,12 50,18 60,14' },
  { iconCls: 'si-blue', d: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, label: 'Avg. Generation Time', value: '1m 42s', valueStyle: { fontSize: 20 }, trend: '↓ 15% vs last 7 days', trendCls: 'trend-down', color: '#3b82f6', points: '0,12 10,16 20,14 30,18 40,16 50,20 60,18' },
  { iconCls: 'si-indigo', d: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, label: 'Reports Downloaded', value: '126', trend: '↑ 18% vs last 7 days', trendCls: 'trend-up', color: '#818cf8', points: '0,20 10,16 20,18 30,10 40,12 50,6 60,8' },
];

export default function Reports() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-reports'); return () => setPageClass(''); }, [setPageClass]);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('All Sites');
  const [type, setType] = useState('All Report Types');
  const [status, setStatus] = useState('All Status');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return REPORTS.filter(r => {
      const matchTab = tab === 'all' || r.type === tab;
      const matchSearch = !term || `${r.name} ${r.desc} ${r.site}`.toLowerCase().includes(term);
      const matchSite = site === 'All Sites' || r.site === site;
      const matchType = type === 'All Report Types' || r.type === type;
      const matchStatus = status === 'All Status' || r.status === status.toLowerCase();
      return matchTab && matchSearch && matchSite && matchType && matchStatus;
    });
  }, [tab, search, site, type, status]);

  return (
    <>
      <div className="stat-cards">
        {STAT_CARDS.map((s) => (
          <div className="stat-card" key={s.label}><div className="stat-card-row">
            <div className={`stat-icon ${s.iconCls}`}><svg viewBox="0 0 24 24">{s.d}</svg></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={s.valueStyle}>{s.value}</div>
              <div className={`stat-trend ${s.trendCls}`}>{s.trend}</div>
            </div>
            <div className="stat-sparkline">
              <svg width="60" height="30" viewBox="0 0 60 30">
                <polyline points={s.points} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              </svg>
            </div>
          </div></div>
        ))}
      </div>

      <div className="reports-layout">
        <div className="reports-main">
          <div className="panel">
            <div className="reports-tabbar">
              <div className="reports-tabs">
                {TABS.map(t => (
                  <div key={t.key} className={`tab-item${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-search">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <CustomSelect value={site} onChange={setSite} options={['All Sites','example.com','mystore.com','blogsite.com','shopnow.com','clientsite.com','newsportal.com','portfolio.com','magazine.com']} />
              <CustomSelect value={type} onChange={setType} options={['All Report Types','Security','Scan','Backup','Update','Uptime','Database','Compliance']} />
              <CustomSelect value={status} onChange={setStatus} options={['All Status','Completed','Failed','Pending']} />
              <div className="gen-report-btn">
                <div className="grb-main">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Generate Report
                </div>
                <div className="grb-sep" />
                <div className="grb-arrow"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Report Name</th><th>Site</th><th>Type</th><th>Generated On</th><th>Date Range</th><th>Status</th><th>Size</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr className="no-results-row"><td colSpan={8}>No reports match your filters.</td></tr>
                ) : visible.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="report-cell">
                        <div className={`report-icon ${r.iconCls}`}><svg viewBox="0 0 24 24">{r.d}</svg></div>
                        <div><div className="report-name">{r.name}</div><div className="report-desc">{r.desc}</div></div>
                      </div>
                    </td>
                    <td>
                      <div className="site-cell">
                        <div className={`site-logo ${r.woo ? 'sl-wc' : 'sl-wp'}`}>{r.woo ? 'WC' : 'WP'}</div>
                        <div>
                          <div className="site-name">{r.site}</div>
                          <div className="site-label">{r.main ? <span className="main-site-badge">Main Site</span> : r.siteLabel}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`type-badge ${r.typeCls}`}>{r.type}</span></td>
                    <td><div className="gen-date">{r.genDate[0]}</div><div className="gen-time">{r.genDate[1]}</div></td>
                    <td><div className="dr-range">{r.range[0]}</div><div className="dr-period">{r.range[1]}</div></td>
                    <td><span className={`status-badge sb-${r.status}`}><span className="sb-dot" />{r.statusLabel}</span></td>
                    <td>{r.size ? <span className="size-val">{r.size}</span> : <span className="size-dash">—</span>}</td>
                    <td>
                      <div className="action-cell">
                        {r.status === 'failed' ? (
                          <div className="retry-btn"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div>
                        ) : (
                          <div className="dl-btn"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                        )}
                        <div className="dots-btn">⋯</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tbl-footer">
              <div className="tbl-footer-text">Showing {visible.length} of 48 reports</div>
              <div className="pagination">
                <div className="pg-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>
                <div className="pg-btn active">1</div><div className="pg-btn">2</div><div className="pg-btn">3</div>
                <div className="pg-dots">…</div><div className="pg-btn">5</div>
                <div className="pg-btn"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
              </div>
            </div>
          </div>
        </div>

        <div className="reports-right">
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Reports Overview</span></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                <ChartCanvas config={donutConfig} width={120} height={120} />
                <div className="donut-center"><div className="donut-num">48</div><div className="donut-lbl">Total</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#8b5cf6' }} /><span className="dl-name">Security</span><span className="dl-val">18</span><span className="dl-pct">37.5%</span></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }} /><span className="dl-name">Scan</span><span className="dl-val">12</span><span className="dl-pct">25%</span></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f97316' }} /><span className="dl-name">Backup</span><span className="dl-val">6</span><span className="dl-pct">12.5%</span></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#eab308' }} /><span className="dl-name">Update</span><span className="dl-val">6</span><span className="dl-pct">12.5%</span></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#a78bfa' }} /><span className="dl-name">Uptime</span><span className="dl-val">6</span><span className="dl-pct">12.5%</span></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Reports Generated</span><span style={{ fontSize: 11, color: '#5a6480' }}>Last 7 Days</span></div>
            <div className="chart-wrap"><div className="chart-canvas-wrap"><ChartCanvas config={lineConfig} /></div></div>
          </div>

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Top Report Types</span></div>
            {[
              { cls: 'ri-purple', d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, name: 'Security Reports', count: 18, pct: '37.5%' },
              { cls: 'ri-teal', d: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, name: 'Scan Reports', count: 12, pct: '25%' },
              { cls: 'ri-orange', d: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, name: 'Backup Reports', count: 6, pct: '12.5%' },
              { cls: 'ri-blue', d: <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></>, name: 'Update Reports', count: 6, pct: '12.5%' },
              { cls: 'ri-pink', d: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>, name: 'Uptime Reports', count: 6, pct: '12.5%' },
            ].map((t, i) => (
              <div className="trt-item" key={i}>
                <div className={`trt-icon ${t.cls}`}><svg viewBox="0 0 24 24">{t.d}</svg></div>
                <div className="trt-body"><div className="trt-name">{t.name}</div></div>
                <span className="trt-count" style={{ marginRight: 6 }}>{t.count}</span>
                <span className="trt-pct">{t.pct}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Quick Actions</span></div>
            <div className="qa-grid">
              <div className="qa-card">
                <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
                <div className="qa-body"><div className="qa-label">Generate Custom Report</div><div className="qa-desc">Create a new report</div></div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div className="qa-body"><div className="qa-label">Schedule Reports</div><div className="qa-desc">Automate reports</div></div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-orange"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="9"/><rect x="14" y="7" width="3" height="5"/></svg></div>
                <div className="qa-body"><div className="qa-label">Report Templates</div><div className="qa-desc">Manage templates</div></div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <div className="qa-body"><div className="qa-label">Export All Reports</div><div className="qa-desc">Download all reports</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
