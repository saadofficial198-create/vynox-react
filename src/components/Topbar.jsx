import { useScanner } from '../context/ScannerContext';

function fmtTime(s) {
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${String(m).padStart(2,'0')}m`;
  }
  return String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
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

function ScanCountdown() {
  const { remaining, totalSecs, flash, isScanning, progress } = useScanner();
  const isOff  = totalSecs === 0;
  const circ   = 2 * Math.PI * 10;
  const offset = isOff ? 0 : circ * (1 - remaining / totalSecs);

  /* Show scan progress instead of countdown while scanning */
  const label = isScanning ? 'Scanning' : 'Next Scan';
  const value = isScanning
    ? (progress.total > 0 ? `${progress.done}/${progress.total}` : '…')
    : isOff ? 'Off' : fmtTime(remaining);

  /* Ring progress during scan = sites done / total */
  const scanOffset = isScanning && progress.total > 0
    ? circ * (1 - progress.done / progress.total)
    : offset;

  return (
    <div
      className={`scan-countdown${isOff && !isScanning ? ' cd-off' : ''}${flash ? ' cd-flash' : ''}${isScanning ? ' cd-scanning' : ''}`}
      title={isScanning && progress.current ? `Scanning: ${progress.current}` : 'Auto scan countdown'}
    >
      <svg className="cd-ring-svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="10" className="cd-track" />
        <circle
          cx="14" cy="14" r="10"
          className="cd-progress"
          style={{ strokeDasharray: circ, strokeDashoffset: scanOffset }}
        />
      </svg>
      <div className="cd-text">
        <span className="cd-label">{label}</span>
        <span className="cd-val">{value}</span>
      </div>
    </div>
  );
}

function ScanAllBtn() {
  const { isScanning, triggerScan, progress } = useScanner();
  const label = isScanning
    ? (progress.total > 0 ? `${progress.done}/${progress.total} done` : 'Starting…')
    : 'Scan All';

  return (
    <button
      className={`scan-all-btn${isScanning ? ' scanning' : ''}`}
      onClick={triggerScan}
      disabled={isScanning}
      title={isScanning && progress.current ? `Scanning: ${progress.current}` : 'Scan all connected sites now'}
    >
      <svg className="sa-icon" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8"  x2="11" y2="14" />
        <line x1="8"  y1="11" x2="14" y2="11" />
      </svg>
      <span className="sa-label">{label}</span>
      <span className="sa-spinner" />
    </button>
  );
}

export default function Topbar({ meta = {}, onSearch }) {
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
        <ScanCountdown />
        <ScanAllBtn />
        <button className="topbar-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          <span className="notif-badge">12</span>
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
