import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import { api } from '../api';
import '../styles/updates.css';

function fmtDateParts(iso) {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  return [
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  ];
}

export default function Updates() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-updates'); return () => setPageClass(''); }, [setPageClass]);

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState('');
  const [site, setSite] = useState('All Sites');
  const [type, setType] = useState('All Update Types');
  const [sev, setSev] = useState('All Severities');
  const [status, setStatus] = useState('All Statuses');

  const load = () => {
    setLoading(true);
    api.listUpdates()
      .then(r => setUpdates(r.updates || []))
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { total: updates.length, high: 0, medium: 0, low: 0, core: 0, plugin: 0, theme: 0 };
    updates.forEach(u => {
      c[u.severity]++;
      if (u.kind === 'Core')   c.core++;
      if (u.kind === 'Plugin') c.plugin++;
      if (u.kind === 'Theme')  c.theme++;
    });
    return c;
  }, [updates]);

  const siteOptions = useMemo(() => ['All Sites', ...Array.from(new Set(updates.map(u => u.site)))], [updates]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return updates.filter(u => {
      const matchSearch = !term || `${u.site} ${u.siteLabel} ${u.name}`.toLowerCase().includes(term);
      const matchSite = site === 'All Sites' || u.site === site;
      const matchType = type === 'All Update Types' || u.kind === type;
      const matchSev = sev === 'All Severities' || u.severity === sev.toLowerCase();
      const matchStatus = status === 'All Statuses' || u.status === status.toLowerCase();
      return matchSearch && matchSite && matchType && matchSev && matchStatus;
    });
  }, [updates, search, site, type, sev, status]);

  const pct = (n) => counts.total ? ((n / counts.total) * 100).toFixed(1) : '0';

  const donutConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [counts.high, counts.medium, counts.low], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '70%', animation: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (c) => ` ${['High','Medium','Low'][c.dataIndex]}: ${c.raw}` } } } },
  }), [counts.high, counts.medium, counts.low]);

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-purple"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Updates Available</div><div className="stat-value">{counts.total}</div><div className="stat-sub">Across all sites</div></div>
          <div className="stat-sparkline"><Sparkline id="u-g1" color="#8b5cf6" points="2,20 12,16 22,18 32,12 42,14 52,10 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-red"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Critical Security Updates</div><div className="stat-value">{counts.high}</div><div className="stat-sub">{pct(counts.high)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="u-g2" color="#ef4444" points="2,14 12,18 22,10 32,20 42,8 52,16 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg></div>
          <div className="stat-text"><div className="stat-label">Outdated Plugins</div><div className="stat-value">{counts.plugin}</div><div className="stat-sub">{pct(counts.plugin)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="u-g3" color="#f97316" points="2,18 12,14 22,20 32,12 42,16 52,10 64,14" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div className="stat-text"><div className="stat-label">WordPress Core Updates</div><div className="stat-value">{counts.core}</div><div className="stat-sub">{pct(counts.core)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="u-g4" color="#3b82f6" points="2,22 12,18 22,22 32,16 42,20 52,14 64,18" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
          <div className="stat-text"><div className="stat-label">Theme Updates</div><div className="stat-value">{counts.theme}</div><div className="stat-sub">{pct(counts.theme)}% of total</div></div>
          <div className="stat-sparkline"><Sparkline id="u-g5" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 64,8" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
      </div>

      <div className="updates-layout">
        <div className="updates-main">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">All Updates</div></div>

            <div className="updates-toolbar">
              <div className="search-box">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="search-input" type="text" placeholder="Search updates..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <CustomSelect value={site} onChange={setSite} options={siteOptions} />
              <CustomSelect value={type} onChange={setType} options={['All Update Types', 'Core', 'Plugin', 'Theme']} />
              <CustomSelect value={sev} onChange={setSev} options={['All Severities', 'High', 'Medium', 'Low']} />
              <CustomSelect value={status} onChange={setStatus} options={['All Statuses', 'Available']} />
              <button className="scan-updates-btn" onClick={load}>
                <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                Refresh
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Site</th>
                  <th>Update Type</th>
                  <th style={{ minWidth: 150 }}>Item Name</th>
                  <th>Current Version</th>
                  <th>Latest Version</th>
                  <th>Severity</th>
                  <th style={{ minWidth: 120 }}>Last Checked</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr className="no-results-row"><td colSpan={9}>Loading updates…</td></tr>)}
                {!loading && loadError && (<tr className="no-results-row"><td colSpan={9} style={{ color: '#fca5a5' }}>Failed to load: {loadError}</td></tr>)}
                {!loading && !loadError && visible.length === 0 && (
                  <tr className="no-results-row"><td colSpan={9}>{updates.length === 0 ? 'No updates available. Sync sites first to detect updates.' : 'No updates match your filters.'}</td></tr>
                )}
                {!loading && visible.map(u => {
                  const [dm, dt] = fmtDateParts(u.date);
                  return (
                    <tr key={u.id}>
                      <td><div className="site-cell"><div className={`wp-circle${u.woo ? ' woo' : ''}`}>W</div><div><div className="site-url">{u.site}</div><div className="site-label">{u.siteLabel}</div></div></div></td>
                      <td><span className={`upd-type ${u.kindCls}`}>{u.kind}</span></td>
                      <td><span className="item-name">{u.name}</span></td>
                      <td><span className="ver-current">{u.current || '—'}</span></td>
                      <td><div className="ver-latest"><span>{u.latest}</span><span className="ver-arrow">↑</span></div></td>
                      <td><span className={`sev ${u.sevCls}`}>{u.sevLabel}</span></td>
                      <td><div className="date-main">{dm}</div><div className="date-time">{dt}</div></td>
                      <td><div className="status-available"><span className="dot-avail" />Available</div></td>
                      <td><div className="action-cell"><button className="upd-btn" disabled title="Apply not implemented yet">Update</button><div className="dots-btn">⋮</div></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && visible.length > 0 && (
              <div className="tbl-footer">
                <span className="tbl-footer-text">Showing {visible.length} of {counts.total} updates</span>
              </div>
            )}
          </div>
        </div>

        <div className="updates-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Updates by Severity</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                {counts.total > 0 && <ChartCanvas config={donutConfig} width={120} height={120} />}
                <div className="donut-center"><div className="donut-num">{counts.total}</div><div className="donut-lbl">Total</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }} /><div className="dl-name">High</div><div className="dl-val">{counts.high}</div><div className="dl-pct">({pct(counts.high)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }} /><div className="dl-name">Medium</div><div className="dl-val">{counts.medium}</div><div className="dl-pct">({pct(counts.medium)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#3b82f6' }} /><div className="dl-name">Low</div><div className="dl-val">{counts.low}</div><div className="dl-pct">({pct(counts.low)}%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Updates by Type</div></div>
            <div className="type-list" style={{ padding: 12 }}>
              <TypeRow color="#3b82f6" name="WordPress Core" count={counts.core} pct={pct(counts.core)} />
              <TypeRow color="#8b5cf6" name="Plugins"        count={counts.plugin} pct={pct(counts.plugin)} />
              <TypeRow color="#22c55e" name="Themes"         count={counts.theme}  pct={pct(counts.theme)} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
            <div className="qa-mini-grid">
              <div className="qa-mini-card" onClick={load}>
                <div className="qa-mini-icon qi-purple"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div>
                <div className="qa-mini-label">Refresh List</div>
                <div className="qa-mini-sub">Reload from server</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-blue"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/><line x1="12" y1="7" x2="12" y2="14"/><line x1="8" y1="11" x2="16" y2="11"/></svg></div>
                <div className="qa-mini-label">Update All</div>
                <div className="qa-mini-sub">Coming soon</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-orange"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div className="qa-mini-label">Schedule</div>
                <div className="qa-mini-sub">Auto update setup</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-green"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 1 22 12a10 10 0 0 1-2.93 7.07M4.93 4.93A10 10 0 0 0 2 12a10 10 0 0 0 2.93 7.07"/></svg></div>
                <div className="qa-mini-label">Settings</div>
                <div className="qa-mini-sub">Configure rules</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TypeRow({ color, name, count, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <div style={{ flex: 1, color: '#e2e8f0', fontSize: 13 }}>{name}</div>
      <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{count}</div>
      <div style={{ color: '#7a839e', fontSize: 12 }}>({pct}%)</div>
    </div>
  );
}
