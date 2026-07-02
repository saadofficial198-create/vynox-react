import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import { api } from '../api';
import '../styles/scans.css';

const ScoreSVG = ({ score, color, dash }) => (
  <div className="score-wrap">
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="16" fill="none" stroke="#1a2235" strokeWidth="3"/>
      <circle cx="22" cy="22" r="16" fill="none" stroke={color} strokeWidth="3" pathLength="100" strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90 22 22)"/>
      <text x="22" y="26" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="700">{score}%</text>
    </svg>
  </div>
);

function fmtParts(iso) {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  return [
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  ];
}

const TABS = [
  { key: 'all',       label: 'All Scans' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed',    label: 'Failed' },
];

export default function Scans() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-scans'); return () => setPageClass(''); }, [setPageClass]);

  const [scans, setScans]     = useState([]);
  const [sites, setSites]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setErr]   = useState(null);
  const [running, setRunning] = useState(null); // siteId during scan
  const [pickerOpen, setPickerOpen] = useState(false);

  const [tab, setTab]     = useState('all');
  const [search, setSearch] = useState('');
  const [siteF, setSiteF] = useState('All Sites');

  const load = () => {
    setLoading(true);
    Promise.all([api.listScans(), api.listSites()])
      .then(([s, st]) => { setScans(s.scans || []); setSites(st.sites || []); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function runScan(siteId) {
    setPickerOpen(false);
    setRunning(siteId);
    try { await api.syncSite(siteId); load(); }
    catch (e) { alert('Scan failed: ' + e.message); }
    finally { setRunning(null); }
  }

  const counts = useMemo(() => {
    const c = { total: scans.length, completed: 0, failed: 0, suspicious: 0, totalFiles: 0 };
    scans.forEach(s => {
      if (s.status === 'completed') c.completed++;
      if (s.status === 'failed')    c.failed++;
      c.suspicious += s.suspicious || 0;
      c.totalFiles += s.filesScanned || 0;
    });
    return c;
  }, [scans]);

  const siteOptions = useMemo(() => ['All Sites', ...Array.from(new Set(scans.map(s => s.site)))], [scans]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scans.filter(s => {
      const matchTab = tab === 'all' || s.status === tab;
      const matchSearch = !term || `${s.site} ${s.siteLabel}`.toLowerCase().includes(term);
      const matchSite = siteF === 'All Sites' || s.site === siteF;
      return matchTab && matchSearch && matchSite;
    });
  }, [scans, tab, search, siteF]);

  // Last-7-days activity
  const activityConfig = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    const buckets = { completed: Array(7).fill(0), failed: Array(7).fill(0) };
    scans.forEach(s => {
      const dt = new Date(s.date);
      const idx = 6 - Math.floor((Date.now() - dt.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) buckets[s.status]?.[idx] !== undefined && buckets[s.status][idx]++;
    });
    return (ctx) => {
      const grad = (rgba) => { const g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)')); return g; };
      const ds = (color, rgba, data) => ({ data, borderColor: color, backgroundColor: grad(rgba), borderWidth: 2, pointBackgroundColor: color, pointRadius: 3, pointHoverRadius: 5, tension: 0.4, fill: true });
      return {
        type: 'line',
        data: { labels: days, datasets: [
          ds('#22c55e', 'rgba(34,197,94,0.30)',  buckets.completed),
          ds('#ef4444', 'rgba(239,68,68,0.22)',  buckets.failed),
        ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1 } }, scales: { x: { grid: { color: 'rgba(30,37,53,0.8)' }, ticks: { color: '#5a6480' } }, y: { min: 0, suggestedMax: Math.max(2, ...buckets.completed, ...buckets.failed) + 1, grid: { color: 'rgba(30,37,53,0.8)' }, ticks: { color: '#5a6480', stepSize: 1 } } } },
      };
    };
  }, [scans]);

  const typesConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [counts.completed, counts.failed], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '68%', animation: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (c) => ` ${['Completed','Failed'][c.dataIndex]}: ${c.raw}` } } } },
  }), [counts.completed, counts.failed]);

  const pct = (n) => counts.total ? ((n / counts.total) * 100).toFixed(1) : '0';

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Scans</div><div className="stat-value">{counts.total}</div><div className="stat-sub">Across all sites</div></div>
          <div className="stat-sparkline"><Sparkline id="sc-g1" color="#3b82f6" points="2,20 12,16 22,18 32,12 42,14 52,10 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div className="stat-text"><div className="stat-label">Completed</div><div className="stat-value">{counts.completed}</div><div className="stat-sub">{pct(counts.completed)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="sc-g2" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 64,8" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div className="stat-text"><div className="stat-label">Failed</div><div className="stat-value">{counts.failed}</div><div className="stat-sub">{pct(counts.failed)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="sc-g3" color="#ef4444" points="2,14 12,18 22,10 32,20 42,8 52,16 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Suspicious Files</div><div className="stat-value">{counts.suspicious}</div><div className="stat-sub">Across all scans</div></div>
          <div className="stat-sparkline"><Sparkline id="sc-g4" color="#f97316" points="2,18 12,22 22,14 32,20 42,12 52,18 64,14" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-purple"><svg viewBox="0 0 24 24"><polyline points="13 2 13 9 20 9"/><path d="M20 14v7H4V2h9"/></svg></div>
          <div className="stat-text"><div className="stat-label">Files Scanned</div><div className="stat-value" style={{ fontSize: 20 }}>{counts.totalFiles.toLocaleString()}</div><div className="stat-sub">Cumulative</div></div>
          <div className="stat-sparkline"><Sparkline id="sc-g5" color="#8b5cf6" points="2,16 12,20 22,14 32,18 42,12 52,16 64,10" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
      </div>

      <div className="scans-layout">
        <div className="scans-main">
          <div className="panel">
            <div className="scans-tabbar">
              <div className="scans-tabs">
                {TABS.map(t => (
                  <div key={t.key} className={`tab-item${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
                ))}
              </div>
              <div className="scans-filters">
                <div className="search-box">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input className="search-input" type="text" placeholder="Search scans..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <CustomSelect value={siteF} onChange={setSiteF} options={siteOptions} />
                <button className="export-btn" onClick={load} title="Refresh">
                  <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                  Refresh
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Site</th>
                  <th style={{ minWidth: 150 }}>Scan Type</th>
                  <th>Triggered By</th>
                  <th>Status</th>
                  <th style={{ minWidth: 110 }}>Started At</th>
                  <th>Files</th>
                  <th>Suspicious</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr className="no-results-row"><td colSpan={9}>Loading scans…</td></tr>)}
                {!loading && loadError && (<tr className="no-results-row"><td colSpan={9} style={{ color: '#fca5a5' }}>Failed to load: {loadError}</td></tr>)}
                {!loading && !loadError && visible.length === 0 && (
                  <tr className="no-results-row"><td colSpan={9}>{scans.length === 0 ? 'No scans yet. Click "Run New Scan" to start.' : 'No scans match your filters.'}</td></tr>
                )}
                {!loading && visible.map(s => {
                  const [dm, dt] = fmtParts(s.date);
                  return (
                    <tr key={s.id}>
                      <td><div className="site-cell"><div className={`wp-circle${s.woo ? ' woo' : ''}`}>W</div><div><div className="site-url">{s.site}</div><div className="site-label">{s.siteLabel}</div></div></div></td>
                      <td>
                        <div className="scan-type-cell">
                          <div className="scan-type-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"/></svg></div>
                          <div><div className="scan-type-name">{s.type}</div><div className="scan-type-sub">All Security Checks</div></div>
                        </div>
                      </td>
                      <td><div className="trigger-name">{s.trigger}</div><div className="trigger-sub">{s.triggerSub}</div></td>
                      <td><span className={`scan-status ss-${s.status}`}>{s.statusLabel}</span></td>
                      <td><div className="date-main">{dm}</div><div className="date-time">{dt}</div></td>
                      <td>{s.filesScanned > 0 ? <span className="duration-val">{s.filesScanned}</span> : <span className="duration-empty">—</span>}</td>
                      <td>{s.suspicious > 0 ? <span className="sev sev-high">{s.suspicious}</span> : <span style={{ color: '#22c55e', fontWeight: 600 }}>Clean</span>}</td>
                      <td>{s.score != null ? <ScoreSVG score={s.score} color={s.scoreColor} dash={s.scoreDash} /> : <span className="duration-empty">—</span>}</td>
                      <td>
                        <div className="action-cell">
                          <button className="view-btn" onClick={() => runScan(s.siteId)} disabled={running === s.siteId}>{running === s.siteId ? 'Scanning…' : 'Re-scan'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && visible.length > 0 && (
              <div className="tbl-footer">
                <span className="tbl-footer-text">Showing {visible.length} of {counts.total} scans</span>
              </div>
            )}
          </div>
        </div>

        <div className="scans-right">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Scan Activity</div>
              <span style={{ fontSize: 11, color: '#5a6480' }}>Last 7 Days</span>
            </div>
            <div className="chart-wrap">
              <div className="activity-canvas">{counts.total > 0 && <ChartCanvas config={activityConfig} />}</div>
              <div className="chart-legend">
                <div className="cl-item"><div className="cl-dot" style={{ background: '#22c55e' }} />Completed</div>
                <div className="cl-item"><div className="cl-dot" style={{ background: '#ef4444' }} />Failed</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Status Overview</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                {counts.total > 0 && <ChartCanvas config={typesConfig} width={110} height={110} />}
                <div className="donut-center"><div className="donut-num">{counts.total}</div><div className="donut-lbl">Total Scans</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#22c55e' }} /><div className="dl-name">Completed</div><div className="dl-val">{counts.completed}</div><div className="dl-pct">({pct(counts.completed)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }} /><div className="dl-name">Failed</div><div className="dl-val">{counts.failed}</div><div className="dl-pct">({pct(counts.failed)}%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Recent Scans</div></div>
            {scans.slice(0, 5).map(s => {
              const [dm, dt] = fmtParts(s.date);
              const badgeCls = s.status === 'completed' ? 'rb-completed' : 'rb-failed';
              return (
                <div className="rss-item" key={s.id}>
                  <div className={`rss-wp${s.woo ? ' woo' : ''}`}>W</div>
                  <div className="rss-body"><div className="rss-name">{s.site}</div><div className="rss-type">{s.type}</div></div>
                  <span className={`rss-badge ${badgeCls}`}>{s.statusLabel}</span>
                  <span className="rss-time">{dm}</span>
                </div>
              );
            })}
            {scans.length === 0 && <div style={{ padding: 14, color: '#7a839e', fontSize: 13 }}>No scans yet</div>}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
            <div className="qa-grid">
              <div className="qa-card" onClick={() => setPickerOpen(true)} style={{ cursor: sites.length ? 'pointer' : 'not-allowed', opacity: sites.length ? 1 : 0.5 }}>
                <div className="qa-icon qi-blue"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <div className="qa-label">Run New Scan</div>
                <div className="qa-sub">{sites.length ? 'Start scan on a site' : 'Add a site first'}</div>
              </div>
              <div className="qa-card" onClick={load}>
                <div className="qa-icon qi-cyan"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div>
                <div className="qa-label">Refresh List</div>
                <div className="qa-sub">Reload scan history</div>
              </div>
              <div className="qa-card">
                <div className="qa-icon qi-purple"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
                <div className="qa-label">Scan Settings</div>
                <div className="qa-sub">Coming soon</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(7,11,22,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 92vw)', background: '#0f1729', border: '1px solid #2a3448', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #1e2840' }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Run scan on which site?</div>
              <div style={{ fontSize: 12, color: '#7a839e', marginTop: 4 }}>This pulls fresh data and stores a new scan snapshot.</div>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
              {sites.length === 0 && <div style={{ padding: 20, color: '#7a839e', textAlign: 'center', fontSize: 13 }}>No sites connected. Add one in Sites page first.</div>}
              {sites.map(s => (
                <button key={s._id} onClick={() => runScan(s._id)} disabled={running === s._id} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: '1px solid transparent', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', marginBottom: 4 }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(91,70,245,0.10)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: '#5b46f5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>W</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#7a839e', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url}</div>
                  </div>
                  <span style={{ fontSize: 12, color: running === s._id ? '#f59e0b' : '#5b46f5' }}>{running === s._id ? 'Scanning…' : 'Start →'}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid #1e2840', textAlign: 'right' }}>
              <button onClick={() => setPickerOpen(false)} style={{ background: 'transparent', border: '1px solid #2a3448', color: '#7a839e', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
