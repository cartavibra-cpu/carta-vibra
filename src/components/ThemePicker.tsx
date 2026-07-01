'use client';
import { useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import { CV_THEME_META, isCvTheme, type CvTheme } from '@/lib/theme';

/** "vibra" con la onda, para el preview. */
function Vibra() {
  return (
    <span className="vibra">
      {['v', 'i', 'b', 'r', 'a'].map((c, i) => (
        <span key={i} className="ch" style={{ ['--i' as string]: i } as React.CSSProperties}>{c}</span>
      ))}
    </span>
  );
}

export default function ThemePicker({ venueId, current }: { venueId: string; current?: string | null }) {
  const initial: CvTheme = isCvTheme(current) ? current : 'vibra';
  const [theme, setTheme] = useState<CvTheme>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(id: CvTheme) {
    if (id === theme || saving) return;
    const prev = theme;
    setTheme(id); setSaving(true); setSaved(false); setErr(null);
    const sb = supa();
    if (!sb) { setSaving(false); return; }
    const { error } = await sb.rpc('set_venue_theme', { p_venue: venueId, p_theme: id });
    setSaving(false);
    if (error) {
      setTheme(prev); setErr(error.message);
      logError('panel-set-theme', new Error(error.message), { venueId, id });
    } else {
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <h2 className="cv-wordmark" style={{ fontSize: 19, fontWeight: 700 }}>Tema del local</h2>
        {saving && <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mut)' }}>guardando…</span>}
        {saved && <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-accent)' }}>✓ guardado</span>}
      </div>
      <p className="cv-mono" style={{ fontSize: 12.5, color: 'var(--cv-mut)', marginBottom: 16, lineHeight: 1.5 }}>
        Elegí la personalidad de tu pantalla y tu carta. Se aplica al toque en la consola y el widget.
      </p>

      {/* PREVIEW EN VIVO (tema acotado a esta caja) */}
      <div className="cv-mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--cv-faint)', fontWeight: 700, marginBottom: 7 }}>VISTA PREVIA · TU PANTALLA EN VIVO</div>
      <div
        data-cv-theme={theme}
        style={{
          position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 18,
          border: '1px solid var(--cv-hair)', padding: '18px 20px',
          background: 'radial-gradient(120% 130% at 50% 0%, color-mix(in srgb, var(--cv-accent) 9%, var(--cv-bg)) 0%, var(--cv-bg) 60%)',
          color: 'var(--cv-ink)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 10px var(--cv-glow)' }} />
          <span className="cv-mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--cv-accent)', fontWeight: 700 }}>SONANDO CON</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="cv-wm" style={{ fontSize: 34 }}><span className="carta">carta</span><Vibra /></div>
          <div style={{ textAlign: 'right' }}>
            <div className="cv-mono" style={{ fontSize: 9, letterSpacing: '.18em', color: 'var(--cv-faint)', fontWeight: 700 }}>CÓDIGO DE SALA</div>
            <div className="cv-wm cv-grad-theme" style={{ fontSize: 40, fontWeight: 800, lineHeight: 0.9 }}>4812</div>
          </div>
        </div>
      </div>

      {err && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-warm)', marginBottom: 12 }}>No se pudo guardar: {err}</div>}

      {/* SWATCHES compactos (todos juntos; la familia/historia va en el tooltip) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {CV_THEME_META.map((t) => {
          const on = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              disabled={saving}
              title={`${t.name} · ${t.story}`}
              style={{
                cursor: saving ? 'default' : 'pointer', padding: 4, overflow: 'hidden',
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
    </div>
  );
}
