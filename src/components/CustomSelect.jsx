import { useEffect, useRef, useState } from 'react';

const CHEVRON = (
  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
);
const CHECK = (
  <svg className="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
);

/**
 * Shared custom dropdown (matches .custom-select-* CSS).
 * Controlled: pass `value` + `onChange(value)`. `options` is an array of strings.
 */
export default function CustomSelect({ options, value, onChange, sm = false, up = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const cls = ['custom-select-wrap', up ? 'custom-select-up' : ''].filter(Boolean).join(' ');
  const btnCls = ['custom-select-btn', sm ? 'custom-select-sm' : '', open ? 'open' : ''].filter(Boolean).join(' ');

  return (
    <div className={cls} ref={wrapRef}>
      <div className={btnCls} onClick={() => setOpen((o) => !o)}>
        <span className="custom-select-label">{value}</span>
        {CHEVRON}
      </div>
      <div className={`custom-select-dropdown${open ? ' open' : ''}`}>
        {options.map((opt) => (
          <div
            key={opt}
            className={`custom-select-option${opt === value ? ' selected' : ''}`}
            onClick={() => { onChange(opt); setOpen(false); }}
          >
            {CHECK}{opt}
          </div>
        ))}
      </div>
    </div>
  );
}
