import { useState, useEffect } from 'react';
import { api } from '../api';

/* Daily automated health check runs via GitHub Actions cron at 03:00 UTC = 08:00 AM PKT (fixed schedule). */
const DAILY_CHECK_TIME = '08:00 AM';

function UptimeCountdown() {
  const [onlineCount, setOnlineCount] = useState(null);
  const [totalCount,  setTotalCount]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const r = await api.listSites();
        const sites = r.sites || [];
        if (cancelled) return;
        setTotalCount(sites.length);
        setOnlineCount(sites.filter(s => s.status === 'online').length);
      } catch { /* ignore */ }
    };
    fetchCounts();
    const timer = setInterval(fetchCounts, 5 * 60 * 1000); // refresh every 5 minutes
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return (
    <div className="uptime-pill" title="Daily automated health check">
      <svg className="cd-ring-svg" width="26" height="26" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="10" className="cd-track" />
        <circle cx="14" cy="14" r="10" className="up-ring-progress" style={{ strokeDasharray: 2 * Math.PI * 10, strokeDashoffset: 0 }} />
      </svg>
      <div className="cd-text">
        <span className="cd-label">Daily Check</span>
        <span className="cd-val">{DAILY_CHECK_TIME}</span>
      </div>
      {totalCount !== null && (
        <div className="up-count">
          <span className="up-dot" />
          <span className="up-num">{onlineCount}/{totalCount}</span>
        </div>
      )}
    </div>
  );
}

function Subhead({ meta }) {
  if (Array.isArray(meta.breadcrumb) && meta.breadcrumb.length) {
    const chevron = <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>;
    return (
      <div className="topbar-bread">
        {meta.breadcrumb.map((c, i) => (
          <span key={c} style={{ display: 'contents' }}>
            {i > 0 && chevron}
            <span className={i === meta.breadcrumb.length - 1 ? 'crumb-current' : undefined}>{c}</span>
          </span>
        ))}
      </div>
    );
  }
  return <div className="topbar-sub">{meta.subtitle || ''}</div>;
}

function useActiveAlertCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await api.listAlerts();
        if (cancelled) return;
        const alerts = r.alerts || [];
        setCount(alerts.filter(a => a.status === 'active').length);
      } catch { /* ignore */ }
    };
    fetchCount();
    const timer = setInterval(fetchCount, 5 * 60 * 1000); // refresh every 5 minutes
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return count;
}

export default function Topbar({ meta = {}, onSearch }) {
  const notifCount = useActiveAlertCount();
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{meta.title}</div>
        <Subhead meta={meta} />
      </div>

      {meta.search && (
        <div className="topbar-center">
          <div className="topbar-search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" placeholder={meta.search} onChange={(e) => onSearch && onSearch(e.target.value)} />
          </div>
        </div>
      )}

      <div className="topbar-actions">
        <UptimeCountdown />
        <button className="topbar-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </button>
        <button className="date-btn">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Last 7 Days
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>
    </div>
  );
}
