// Shared pagination bar used by every page with a filterable table (Alerts,
// Scans, Updates, Sites, ...). Reuses the existing .pagination/.pg-btn
// styles from styles/style.css (already global) so it matches the look
// those pages already had.

// Builds the row of page buttons/ellipses: always shows first + last page,
// a window of up to 3 pages around the current one, and collapses
// everything else into '…' so a 40-page list doesn't render 40 buttons.
export function pageNumberList(total, current) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <div className={`pg-btn${page === 1 ? ' disabled' : ''}`} onClick={() => onChange(Math.max(1, page - 1))}>
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </div>
      {pageNumberList(totalPages, page).map((p, i) => (
        p === '…'
          ? <div className="pg-dots" key={`dots-${i}`}>…</div>
          : <div key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</div>
      ))}
      <div className={`pg-btn${page === totalPages ? ' disabled' : ''}`} onClick={() => onChange(Math.min(totalPages, page + 1))}>
        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  );
}
