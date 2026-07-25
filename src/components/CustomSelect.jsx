import { useEffect, useRef, useState } from 'react';

const CHEVRON = (
  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
);
const CHECK = (
  <svg className="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
);
const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="15.65" y2="15.65"/>
  </svg>
);

/**
 * Shared custom dropdown with built-in search + A-Z sort.
 * Controlled: pass `value` + `onChange(value)`. `options` is an array of strings.
 * Search box auto-appears when there are more than 5 options.
 */
export default function CustomSelect({ options, value, onChange, sm = false, up = false }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const wrapRef               = useRef(null);
  const searchRef             = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    // Focus search box when dropdown opens
    setTimeout(() => searchRef.current?.focus(), 30);
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  // "All X" items always stay pinned at top; rest sorted A-Z
  const pinned   = options.filter(o => /^All /i.test(o));
  const sortable = options.filter(o => !/^All /i.test(o)).slice().sort((a, b) => a.localeCompare(b));
  const ordered  = [...pinned, ...sortable];

  const q = query.trim().toLowerCase();
  const visible = q
    ? ordered.filter(o => o.toLowerCase().includes(q))
    : ordered;

  const showSearch = options.length > 5;

  const cls    = ['custom-select-wrap', up ? 'custom-select-up' : ''].filter(Boolean).join(' ');
  const btnCls = ['custom-select-btn', sm ? 'custom-select-sm' : '', open ? 'open' : ''].filter(Boolean).join(' ');

  return (
    <div className={cls} ref={wrapRef}>
      <div className={btnCls} onClick={() => setOpen(o => !o)}>
        <span className="custom-select-label">{value}</span>
        {CHEVRON}
      </div>

      <div className={`custom-select-dropdown${open ? ' open' : ''}`}>
        {showSearch && (
          <div className="csd-search-wrap">
            <span className="csd-search-icon">{SEARCH_ICON}</span>
            <input
              ref={searchRef}
              className="csd-search-input"
              type="text"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {query && (
              <button className="csd-clear-btn" onClick={e => { e.stopPropagation(); setQuery(''); }}>×</button>
            )}
          </div>
        )}

        <div className="csd-options-list">
          {visible.length === 0 && (
            <div className="csd-no-results">No results for "{query}"</div>
          )}
          {visible.map(opt => (
            <div
              key={opt}
              className={`custom-select-option${opt === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {CHECK}
              <span className="csd-opt-label">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
