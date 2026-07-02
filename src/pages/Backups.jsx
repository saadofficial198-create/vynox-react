import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../components/Layout';
import ChartCanvas from '../components/ChartCanvas';
import Sparkline from '../components/Sparkline';
import CustomSelect from '../components/CustomSelect';
import { api } from '../api';
import '../styles/backups.css';

function fmtParts(iso) {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return [iso, ''];
  return [
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  ];
}

export default function Backups() {
  const { setPageClass } = usePage();
  useEffect(() => { setPageClass('page-backups'); return () => setPageClass(''); }, [setPageClass]);

  const [backups, setBackups] = useState([]);
  const [summary, setSummary] = useState({ totalSites: 0, success: 0, failed: 0, pending: 0, totalBackupSize: '0 B', totalBackupBytes: 0, diskFreeFmt: '—', diskTotalFmt: '—', diskUsedPct: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setErr] = useState(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    api.listBackups()
      .then(r => { setBackups(r.backups || []); setSummary(r.summary || {}); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return backups.filter(b => {
      const matchSearch = !term || `${b.site} ${b.siteLabel}`.toLowerCase().includes(term);
      const matchStatus = status === 'All Status' || b.status === status.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [backups, search, status]);

  const pct = (n) => summary.totalSites ? ((n / summary.totalSites) * 100).toFixed(1) : '0';

  const donutConfig = useMemo(() => ({
    type: 'doughnut',
    data: { datasets: [{ data: [summary.success || 0, summary.failed || 0, summary.pending || 0], backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'], borderWidth: 0, hoverOffset: 4 }] },
    options: { responsive: false, cutout: '70%', animation: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2840', titleColor: '#e2e8f0', bodyColor: '#7a839e', borderColor: '#2a3448', borderWidth: 1, callbacks: { label: (c) => ` ${['Successful','Failed','Pending'][c.dataIndex]}: ${c.raw}` } } } },
  }), [summary.success, summary.failed, summary.pending]);

  // Storage Usage: backup bytes used vs available disk free
  const totalAvailable = (summary.totalBackupBytes || 0) + (summary.diskFreeBytes || 0);
  const storagePct = totalAvailable ? Math.min(100, (summary.totalBackupBytes / totalAvailable) * 100) : 0;

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-green"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Sites</div><div className="stat-value">{summary.totalSites || 0}</div><div className="stat-sub">All Connected Sites</div></div>
          <div className="stat-sparkline"><Sparkline id="b-g1" color="#22c55e" points="2,22 12,18 22,20 32,14 42,16 52,10 64,8" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24"><polyline points="22 12 16 12 13 21 9 3 6 12 2 12"/></svg></div>
          <div className="stat-text"><div className="stat-label">Backups OK</div><div className="stat-value" style={{ fontSize: 22 }}>{summary.success || 0} / {summary.totalSites || 0}</div><div className="stat-sub">{pct(summary.success || 0)}% Sites Backed Up</div></div>
          <div className="stat-sparkline"><Sparkline id="b-g2" color="#3b82f6" points="2,22 12,18 22,22 32,16 42,20 52,14 64,18" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="stat-text"><div className="stat-label">Backups Failed</div><div className="stat-value">{summary.failed || 0}</div><div className="stat-sub">{pct(summary.failed || 0)}% Sites Failed</div></div>
          <div className="stat-sparkline"><Sparkline id="b-g3" color="#f97316" points="2,14 12,18 22,10 32,20 42,8 52,16 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-purple"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div className="stat-text"><div className="stat-label">Pending</div><div className="stat-value">{summary.pending || 0}</div><div className="stat-sub">{pct(summary.pending || 0)}% Sites Pending</div></div>
          <div className="stat-sparkline"><Sparkline id="b-g4" color="#8b5cf6" points="2,18 12,22 22,16 32,20 42,14 52,18 64,14" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
        <div className="stat-card"><div className="stat-card-top">
          <div className="stat-icon si-cyan"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
          <div className="stat-text"><div className="stat-label">Total Backup Size</div><div className="stat-value" style={{ fontSize: 20 }}>{summary.totalBackupSize || '0 B'}</div><div className="stat-sub">Across All Sites</div></div>
          <div className="stat-sparkline"><Sparkline id="b-g5" color="#06b6d4" points="2,20 12,16 22,18 32,12 42,14 52,10 64,12" width={66} height={30} viewBox="0 0 66 30" /></div>
        </div></div>
      </div>

      <div className="backups-layout">
        <div className="backups-main">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">All Sites Backups</div></div>

            <div className="backups-toolbar">
              <div className="search-box">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="search-input" type="text" placeholder="Search sites..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <CustomSelect value={status} onChange={setStatus} options={['All Status', 'Success', 'Failed', 'Pending']} />
              <button className="run-backup-btn" onClick={load}>
                <span className="rbtn-main">
                  <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                  Refresh
                </span>
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Site</th>
                  <th style={{ minWidth: 130 }}>Last Backup</th>
                  <th>Backups</th>
                  <th>Total Size</th>
                  <th>Server Disk</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr className="no-results-row"><td colSpan={7}>Loading backups…</td></tr>)}
                {!loading && loadError && (<tr className="no-results-row"><td colSpan={7} style={{ color: '#fca5a5' }}>Failed to load: {loadError}</td></tr>)}
                {!loading && !loadError && visible.length === 0 && (
                  <tr className="no-results-row"><td colSpan={7}>{backups.length === 0 ? 'No sites yet — add one in Sites page.' : 'No backups match your filters.'}</td></tr>
                )}
                {!loading && visible.map(b => {
                  const [lm, lt] = fmtParts(b.lastBackup?.modified);
                  const isOpen = expanded === b.id;
                  return (
                    <Fragment key={b.id}>
                      <tr>
                        <td>
                          <div className="site-cell">
                            <div className={`wp-circle${b.woo ? ' woo' : ''}`}>W</div>
                            <div>
                              <div className="site-url">{b.site}</div>
                              <div className="site-label">{b.siteLabel}</div>
                            </div>
                          </div>
                        </td>
                        <td>{b.lastBackup ? <><div className="date-main">{lm}</div><div className="date-time">{lt}</div></> : <span style={{ color: '#5a6480' }}>—</span>}</td>
                        <td><span className="backup-size">{b.backupCount}</span></td>
                        <td><span className="backup-size">{b.totalBackupSize}</span></td>
                        <td>
                          {b.diskFree ? (
                            <div><div className="date-main">{b.diskFree} free</div><div className="date-time">of {b.diskTotal} ({b.diskUsedPercent} used)</div></div>
                          ) : <span style={{ color: '#5a6480' }}>—</span>}
                        </td>
                        <td><span className={`bk-status bk-${b.status}`}><span className="bk-status-dot" />{b.statusLabel}</span></td>
                        <td>
                          <div className="action-cell">
                            <button className="view-backup-btn" onClick={() => setExpanded(isOpen ? null : b.id)}>{isOpen ? 'Hide' : 'View'} Backups</button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} style={{ background: 'rgba(91,70,245,0.05)', padding: '12px 20px' }}>
                            {(b.allBackups || []).length === 0 && <div style={{ color: '#7a839e', fontSize: 13 }}>No backup files found.</div>}
                            {(b.allBackups || []).length > 0 && (
                              <div>
                                <div style={{ fontSize: 12, color: '#7a839e', marginBottom: 8 }}>Backup files in <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 3, color: '#a7b0c8' }}>{b.backupDirectory}</code></div>
                                <table style={{ width: '100%', fontSize: 12 }}>
                                  <thead><tr style={{ color: '#5a6480' }}><th style={{ textAlign: 'left', padding: '4px 0' }}>File</th><th style={{ textAlign: 'right' }}>Size</th><th style={{ textAlign: 'right' }}>Modified</th></tr></thead>
                                  <tbody>
                                    {b.allBackups.map((f, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '6px 0', color: '#e2e8f0', wordBreak: 'break-all' }}>{f.name}</td>
                                        <td style={{ textAlign: 'right', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 8 }}>{f.size}</td>
                                        <td style={{ textAlign: 'right', color: '#7a839e', whiteSpace: 'nowrap', paddingLeft: 8 }}>{f.modified}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {!loading && visible.length > 0 && (
              <div className="tbl-footer">
                <span className="tbl-footer-text">Showing {visible.length} of {summary.totalSites} sites</span>
              </div>
            )}
          </div>
        </div>

        <div className="backups-right">
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Backup Overview</div></div>
            <div className="donut-inner">
              <div className="donut-wrap">
                {summary.totalSites > 0 && <ChartCanvas config={donutConfig} width={120} height={120} />}
                <div className="donut-center"><div className="donut-num">{summary.totalSites || 0}</div><div className="donut-lbl">Total Sites</div></div>
              </div>
              <div className="donut-legend">
                <div className="dl-row"><div className="dl-dot" style={{ background: '#22c55e' }} /><div className="dl-name">Successful</div><div className="dl-val">{summary.success || 0}</div><div className="dl-pct">({pct(summary.success || 0)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#ef4444' }} /><div className="dl-name">Failed</div><div className="dl-val">{summary.failed || 0}</div><div className="dl-pct">({pct(summary.failed || 0)}%)</div></div>
                <div className="dl-row"><div className="dl-dot" style={{ background: '#f59e0b' }} /><div className="dl-name">Pending</div><div className="dl-val">{summary.pending || 0}</div><div className="dl-pct">({pct(summary.pending || 0)}%)</div></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Storage Usage</div></div>
            <div className="storage-body">
              <div className="storage-top">
                <span className="storage-used">{summary.totalBackupSize} backups · {summary.diskFreeFmt} free</span>
                <span className="storage-pct">{summary.diskUsedPct != null ? `${summary.diskUsedPct}%` : '—'}</span>
              </div>
              <div className="storage-bar-wrap"><div className="storage-bar-fill" style={{ width: summary.diskUsedPct != null ? `${summary.diskUsedPct}%` : '0%' }} /></div>
              <div className="storage-meta">
                <div className="storage-meta-item"><span className="sm-label">Backups Used</span><span className="sm-value">{summary.totalBackupSize}</span></div>
                <div className="storage-meta-item" style={{ textAlign: 'right' }}><span className="sm-label">Disk Free</span><span className="sm-value-right">{summary.diskFreeFmt}</span></div>
              </div>
              <div className="storage-meta" style={{ marginTop: 6 }}>
                <div className="storage-meta-item"><span className="sm-label">Backup Files</span><span className="sm-value">{backups.reduce((n, b) => n + (b.backupCount || 0), 0)}</span></div>
                <div className="storage-meta-item" style={{ textAlign: 'right' }}><span className="sm-label">Disk Total</span><span className="sm-value-right">{summary.diskTotalFmt}</span></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Recent Backup Activity</div></div>
            {backups.flatMap(b => (b.allBackups || []).slice(0, 3).map(f => ({ ...f, site: b.site, siteLabel: b.siteLabel, woo: b.woo })))
              .sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
              .slice(0, 6)
              .map((a, i) => (
                <div className="activity-item" key={i}>
                  <div className={`act-wp${a.woo ? ' woo' : ''}`}>W</div>
                  <div className="act-body"><div className="act-name">{a.site}</div><div className="act-desc" style={{ wordBreak: 'break-all' }}>{a.name}</div></div>
                  <span className="act-time">{a.size}</span>
                  <div className="act-icon ai-success"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>
              ))}
            {backups.every(b => (b.allBackups || []).length === 0) && <div style={{ padding: 14, color: '#7a839e', fontSize: 13 }}>No backup files yet</div>}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
            <div className="qa-mini-grid">
              <div className="qa-mini-card" onClick={load}>
                <div className="qa-mini-icon qi-purple"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div>
                <div className="qa-mini-label">Refresh</div>
                <div className="qa-mini-sub">Reload list</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-blue"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <div className="qa-mini-label">Schedule</div>
                <div className="qa-mini-sub">Coming soon</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-green"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <div className="qa-mini-label">Download</div>
                <div className="qa-mini-sub">Coming soon</div>
              </div>
              <div className="qa-mini-card">
                <div className="qa-mini-icon qi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>
                <div className="qa-mini-label">Cleanup</div>
                <div className="qa-mini-sub">Coming soon</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Inline Fragment to keep adjacent rows
function Fragment({ children }) { return <>{children}</>; }
