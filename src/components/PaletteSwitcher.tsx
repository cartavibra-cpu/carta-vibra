'use client';
import { useEffect, useState } from 'react';
import { CV_THEME_META, readGlobalTheme, setGlobalTheme, type CvTheme } from '@/lib/theme';

/**
 * Selector de la paleta global (identidad de color de Carta Vibra).
 * Siempre guarda en localStorage y la aplica al <html> (todo el chrome cambia al toque).
 * `onPick` opcional: para que quien lo use haga algo extra (ej: guardar en los locales).
 */
export default function PaletteSwitcher({
  compact = false,
  onPick,
}: {
  compact?: boolean;
  onPick?: (id: CvTheme) => void;
}) {
  const [theme, setTheme] = useState<CvTheme>('vibra');
  useEffect(() => { setTheme(readGlobalTheme()); }, []);

  const pick = (id: CvTheme) => {
    if (id === theme) return;
    setTheme(id);
    setGlobalTheme(id);
    onPick?.(id);
  };

  if (compact) {
    // Fila de dots-gradiente (landing, piola)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
        {CV_THEME_META.map((t) => {
          const on = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              title={`${t.name} · ${t.story}`}
              aria-label={t.name}
              style={{
                width: on ? 22 : 18, height: on ? 22 : 18, borderRadius: '50%',
                background: t.grad, cursor: 'pointer', padding: 0, flexShrink: 0,
                border: on ? '2px solid var(--cv-ink)' : '1px solid var(--cv-hair)',
                boxShadow: on ? '0 0 0 3px var(--cv-bg), 0 2px 10px rgba(0,0,0,.35)' : 'none',
                transition: 'width .12s ease, height .12s ease, border-color .15s ease, box-shadow .15s ease',
              }}
            />
          );
        })}
      </div>
    );
  }

  // Grid con nombres (mis locales)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
      {CV_THEME_META.map((t) => {
        const on = t.id === theme;
        return (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            title={`${t.name} · ${t.story}`}
            style={{
              cursor: 'pointer', padding: 4, overflow: 'hidden',
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 5,
              background: on ? 'rgba(var(--cv-accent-rgb),.10)' : 'var(--cv-surf)',
              border: on ? '1.5px solid var(--cv-accent)' : '1px solid var(--cv-hair)',
              transition: 'transform .12s ease, border-color .15s ease, background .15s ease',
            }}
          >
            <div style={{ height: 28, borderRadius: 7, background: t.grad, position: 'relative' }}>
              {on && <span style={{ position: 'absolute', top: 3, right: 6, fontSize: 11, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>✓</span>}
            </div>
            <span className="cv-wordmark" style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1, color: on ? 'var(--cv-accent)' : 'var(--cv-ink)' }}>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
