'use client';
import { useEffect, useRef, useState } from 'react';

export type CvOption = { value: string; label: string };

/**
 * Dropdown propio con identidad Carta Vibra.
 * Reemplaza a <select> nativo (imposible de tematizar bien en todos los sistemas).
 * Toma la paleta del tema activo vía tokens --cv-*.
 */
export function CvSelect({
  value,
  onChange,
  options,
  style,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: CvOption[];
  style?: React.CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--cv-bg-2)', color: 'var(--cv-text)',
          border: '1px solid ' + (open ? 'rgba(var(--cv-accent-rgb),.5)' : 'var(--cv-line)'),
          borderRadius: 11, padding: '11px 14px', fontFamily: 'var(--cv-font-body)', fontSize: 15,
          cursor: disabled ? 'default' : 'pointer', outline: 'none', textAlign: 'left',
          opacity: disabled ? 0.55 : 1, transition: 'border-color .15s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.label : '—'}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" style={{ flexShrink: 0, transition: 'transform .18s ease', transform: open ? 'rotate(180deg)' : 'none' }} fill="none" stroke="var(--cv-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
          background: 'var(--cv-surf)', border: '1px solid rgba(var(--cv-accent-rgb),.28)',
          borderRadius: 12, padding: 5, boxShadow: '0 18px 44px -16px rgba(0,0,0,.7), 0 0 0 1px var(--cv-hair)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  background: sel ? 'rgba(var(--cv-accent-rgb),.16)' : 'transparent',
                  color: sel ? 'var(--cv-ink)' : 'var(--cv-mut)',
                  border: 'none', borderRadius: 8, padding: '9px 11px', fontFamily: 'var(--cv-font-body)', fontSize: 14.5,
                  cursor: 'pointer', textAlign: 'left', transition: 'background .12s ease, color .12s ease',
                }}
                onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.background = 'rgba(var(--cv-accent-rgb),.09)'; e.currentTarget.style.color = 'var(--cv-ink)'; } }}
                onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cv-mut)'; } }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {sel && <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0 }} fill="none" stroke="var(--cv-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CvSelect;
