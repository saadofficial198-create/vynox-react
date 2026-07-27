// Shared circular progress ring for PageSpeed Performance scores — used by
// both Sites.jsx (Performance tab, All Sites table's Health Status column)
// and Dashboard.jsx (Sites Overview table's Health Status column), so both
// places show the exact same visual for the exact same score instead of
// Dashboard falling back to the old "Needs Attention" health-check badge.
export default function ScoreRing({ label, val }) {
  const color = val == null ? '#3a4356' : val >= 90 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444';
  const pct = val == null ? 0 : val;
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 76 }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r={r} fill="none" stroke="#1a2233" strokeWidth="5" />
          {val != null && (
            <circle
              cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: val == null ? '#5a6480' : color }}>
          {val ?? '—'}
        </div>
      </div>
      {label && <div style={{ fontSize: 10.5, color: '#8892a8', textAlign: 'center', lineHeight: 1.2 }}>{label}</div>}
    </div>
  );
}
