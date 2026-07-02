import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import { api } from '../api';
import '../styles/alerts.css';

const TYPE_ICONS = {
  Malware:          { cls: 'ac-red',   d: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
  'Core Update':    { cls: 'ac-amber', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  Plugin:           { cls: 'ac-amber', d: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  SSL:              { cls: 'ac-blue',  d: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
  'Login Security': { cls: 'ac-red',   d: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  Server:           { cls: 'ac-teal',  d: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></> },
};

function fmtDateParts(iso) {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  return [
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  ];
}

export default function Alerts() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-alerts'); return () => setPageClass(''); }, [setPageClass]);

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('All Sites');
  const [type, setType] = useState('All Types');
  const [status, setStatus] = useState('All Status');

  useEffect(() => {
    setLoading(true);
    api.listAlerts()
      .then(r => setAlerts(r.alerts || []))
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { total: alerts.length, high: 0, medium: 0, low: 0, resolved: 0 };
    alerts.forEach(a => {
      if (a.status === 'resolved') c.resolved++;
      else c[a.severity]++;
    });
    return c;
  }, [alerts]);

  const siteOptions = useMemo(() => ['All Sites', ...Array.from(new Set(alerts.map(a => a.site)))], [alerts]);
  const typeOptions = useMemo(() => ['All Types', ...Array.from(new Set(alerts.map(a => a.type)))], [alerts]);

  const typeBreakdown = useMemo(() => {
    const map = {};
    alerts.forEach(a => { map[a.type] = (map[a.type] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count, pct: counts.total ? ((count / counts.total) * 100).toFixed(1) : '0' }));
  }, [alerts, counts.total]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return alerts.filter(a => {
      const matchTab =
        tab === 'all' ? true :
        tab === 'resolved' ? a.status === 'resolved' :
        a.severity === tab;
      const matchSearch = !term || (`${a.name} ${a.desc} ${a.site} ${a.siteLabel} ${a.type}`.toLowerCase().includes(term));
      const matchSite = site === 'All Sites' || a.site === site;
      const matchType = type === 'All Types' || a.type === type;
      const matchStatus = status === 'All Status' || a.status === status.toLowerCase();
      return matchTab && matchSearch && matchSite && matchType && matchStatus;
    });
  }, [alerts, tab, search, site, type, status]);

  const TABS = [
    { key: 'all',      label: <>All Alerts <span className="tab-count">({counts.total})</span></> },
    { key: 'high',     label: <>High <span className="tab-count">({counts.high})</span></> },
    { key: 'medium',   label: <>Medium <span className="tab-count">({counts.medium})</span></> },
    { key: 'low',      label: <>Low <span className="tab-count">({counts.low})</span></> },
    { key: 'resolved', label: <>Resolved <span className="tab-count">({counts.resolved})</span></> },
  ];

  const donutConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [counts.high, counts.medium, counts.low], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '70%', animation: false, plugins: { legend: { display: false } } },
  }), [counts.high, counts.medium, counts.low]);

  const pct = (n) => counts.total ? ((n / counts.total) * 100).toFixed(1) : '0';

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-red"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Alerts</div><div className="stat-value">{counts.total}</div><div className="stat-sub">Across all sites</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g1" color="#ef4444" points="2,16 12,20 22,12 32,22 42,10 52,18 66,14" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">High Severity</div><div className="stat-value">{counts.high}</div><div className="stat-sub">{pct(counts.high)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g2" color="#f97316" points="2,20 12,16 22,22 32,14 42,18 52,10 66,16" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-yellow"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Medium Severity</div><div className="stat-value">{counts.medium}</div><div className="stat-sub">{pct(counts.medium)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g3" color="#eab308" points="2,18 12,14 22,20 32,12 42,16 52,10 66,14" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div className="stat-text"><div className="stat-label">Low Severity</div><div className="stat-value">{counts.low}</div><div className="stat-sub">{pct(counts.low)}% of total alerts</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g4" color="#3b82f6" points="2,22 12,18 22,22 32,16 42,20 52,14 66,18" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
          <div className="stat-text"><div className="stat-label">Resolved</div><div className="stat-value">{counts.resolved}</div><div className="stat-sub">All time</div></div>
          <div className="stat-sparkline"><Sparkline id="a-g5" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 66,8" /></div>
        </div></div>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {TABS.map(t => (
            <div key={t.key} className={`filter-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
          ))}
        </div>
        <div className="alerts-toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="search-input" type="text" placeholder="Search alerts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <CustomSelect value={site} onChange={setSite} options={siteOptions} />
          <CustomSelect value={type} onChange={setType} options={typeOptions} />
          <CustomSelect value={status} onChange={setStatus} options={['All Status', 'Active', 'Resolved']} />
          <button className="export-btn">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
        </div>
      </div>

      <div className="alerts-layout">
        <div className="alerts-main">
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Alert</th>
                  <th style={{ minWidth: 140 }}>Site</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th style={{ minWidth: 120 }}>First Detected</th>
                  <th style={{ minWidth: 120 }}>Last Detected</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr className="no-results-row"><td colSpan={8}>Loading alerts…</td></tr>)}
                {!loading && loadError && (<tr className="no-results-row"><td colSpan={8} style={{ color: '#fca5a5' }}>Failed to load: {loadError}</td></tr>)}
                {!loading && !loadError && visible.length === 0 && (
                  <tr className="no-results-row"><td colSpan={8}>{alerts.length === 0 ? 'No alerts found. Sync a site first to see its alerts here.' : 'No alerts match your filters.'}</td></tr>
                )}
                {!loading && visible.map(a => {
                  const icon = TYPE_ICONS[a.type] || TYPE_ICONS.Server;
                  const [fd, ft] = fmtDateParts(a.first);
                  const [ld, lt] = fmtDateParts(a.last);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="alert-cell">
                          <div className={`alert-circle ${icon.cls}`}><svg viewBox="0 0 24 24">{icon.d}</svg></div>
                          <div><div className="al-name">{a.name}</div><div className="al-desc">{a.desc}</div></div>
                        </div>
                      </td>
                      <td><div className="site-cell"><div className="wp-circle">W</div><div><div className="site-url">{a.site}</div><div className="site-label">{a.siteLabel}</div></div></div></td>
                      <td><span className="type-badge">{a.type}</span></td>
                      <td><span className={`sev ${a.sevCls}`}>{a.sevLabel}</span></td>
                      <td><div className="date-main">{fd}</div><div className="date-time">{ft}</div></td>
                      <td><div className="date-main">{ld}</div><div className="date-time">{lt}</div></td>
                      <td>
                        {a.status === 'active'
                          ? <div className="status-active"><span className="dot-active" />Active</div>
                          : <span className="status-resolved">Resolved</span>}
                      </td>
                      <td><div className="dots-btn">⋮</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && visible.length > 0 && (
              <div className="tbl-footer">
                <span className="tbl-footer-text">Showing {visible.length} of {counts.total} alerts</span>
              </div>
            )}
          </div>
        </div>

        <div className="alerts-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Alerts by Severity</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                {counts.total > 0 && <ChartCanvas key={`${counts.high}-${counts.medium}-${counts.low}`} config={donutConfig} width={130} height={130} />}
                <div className="donut-center"><div className="donut-num">{counts.total}</div><div className="donut-lbl">Total Alerts</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }}/><div className="dl-name">High</div><div className="dl-val">{counts.high}</div><div className="dl-pct">({pct(counts.high)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }}/><div className="dl-name">Medium</div><div className="dl-val">{counts.medium}</div><div className="dl-pct">({pct(counts.medium)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }}/><div className="dl-name">Low</div><div className="dl-val">{counts.low}</div><div className="dl-pct">({pct(counts.low)}%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Alerts by Type</div></div>
            <div className="type-list">
              {typeBreakdown.length === 0 && <div style={{ padding: 12, color: '#7a839e', fontSize: 13 }}>No data</div>}
              {typeBreakdown.map(t => {
                const icon = TYPE_ICONS[t.name] || TYPE_ICONS.Server;
                const iconCls = icon.cls.replace('ac-', 'ti-');
                return (
                  <div className="type-row" key={t.name}>
                    <div className={`type-icon-sm ${iconCls}`}><svg viewBox="0 0 24 24">{icon.d}</svg></div>
                    <div className="type-name-col">{t.name}</div>
                    <div className="type-count-col">{t.count}</div>
                    <div className="type-pct-col">({t.pct}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="qa-panel">
        <div className="panel-title">Quick Actions</div>
        <div className="qa-grid">
          <div className="qa-card">
            <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <div><div className="qa-label">Run New Scan</div><div className="qa-sub">Scan All Sites Now</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
            <div><div className="qa-label">Mark All Resolved</div><div className="qa-sub">Resolve Active Alerts</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>
            <div><div className="qa-label">View All Sites</div><div className="qa-sub">Manage Connected Sites</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-orange"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
            <div><div className="qa-label">Export Report</div><div className="qa-sub">Download Alerts Report</div></div>
          </div>
          <div className="qa-card">
            <div className="qa-icon qi-cyan"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
            <div><div className="qa-label">Alert Settings</div><div className="qa-sub">Configure Notifications</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ cls, label, val, sub, spId, spColor }) {
  return (
    <div className="stat-card"><div className="stat-card-top">
      <div className={`stat-icon ${cls}`}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div>
      <div className="stat-text"><div className="stat-label">{label}</div><div className="stat-value">{val}</div><div className="stat-sub">{sub}</div></div>
      <div className="stat-sparkline"><Sparkline id={spId} color={spColor} points="2,18 12,14 22,16 32,10 42,12 52,8 66,10" /></div>
    </div></div>
  );
}
