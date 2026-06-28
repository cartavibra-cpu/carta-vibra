'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e';

type Template = { id: string; name: string; description: string | null; mood: string | null };

const PALETTE = ['var(--cv-violet-light)', 'var(--cv-cyan)', 'var(--cv-mint)'];
function moodAccent(mood: string | null, name: string) {
  const m = (mood || '').toLowerCase();
  if (/(chill|lounge|caf|relax|suave|tranqui|jazz|bossa|acust|ambient)/.test(m)) return 'var(--cv-violet-light)';
  if (/(fiesta|party|baile|dance|after|reggaet|cumbia|perreo|hot|fuego|carrete)/.test(m)) return 'var(--cv-mint)';
  if (/(rock|pop|indie|cl[aá]sic|hits|variad|80|90|retro)/.test(m)) return 'var(--cv-cyan)';
  const s = mood || name || '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function CuradasPage() {
  const [session, setSession] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({}); // template_id -> "N canciones"

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }: any) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    setLoading(true);
    const { data } = await sb.from('playlist_template').select('id,name,description,mood').eq('published', true).order('sort').order('created_at');
    const tpls = (data as Template[]) || [];
    setTemplates(tpls);
    if (tpls.length) {
      const { data: trk } = await sb.from('playlist_template_track').select('template_id');
      const c: Record<string, number> = {};
      (trk as { template_id: string }[] | null)?.forEach((r) => { c[r.template_id] = (c[r.template_id] || 0) + 1; });
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => { if (session) load(); }, [session]);

  const doImport = async (t: Template) => {
    const sb = supa();
    if (!sb) return;
    setImporting(t.id);
    const { data, error } = await sb.rpc('import_curated_playlist', { p_template: t.id, p_type: 'jukebox' });
    setImporting(null);
    if (error) { alert('No se pudo importar: ' + error.message); return; }
    const n = data?.imported ?? 0;
    setDone((prev) => ({ ...prev, [t.id]: `${n} ${n === 1 ? 'canción' : 'canciones'}` }));
  };

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>carta <span className="cv-grad-text">vibra</span></div>
          <p style={{ fontSize: 15, color: 'var(--cv-text-2)', marginBottom: 18 }}>Necesitás iniciar sesión para ver las playlists curadas.</p>
          <a href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Ir al inicio</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Curadas</h1>
        <p style={{ fontSize: 14.5, color: 'var(--cv-text-2)', lineHeight: 1.55, margin: '8px 0 26px', maxWidth: 560 }}>
          Playlists listas para usar. Importá la que te guste a tu <a href="/panel/playlists" style={{ color: 'var(--cv-cyan)' }}>biblioteca</a> y después asignála a tus locales desde <a href="/panel" style={{ color: 'var(--cv-cyan)' }}>Mis locales</a>.
        </p>

        {loading ? (
          <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>cargando playlists curadas…</div>
        ) : templates.length === 0 ? (
          <div className="cv-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🎵</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text)', marginBottom: 4 }}>Pronto vas a tener playlists curadas acá</div>
            <p className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)' }}>Estamos preparando colecciones listas para usar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {templates.map((t) => {
              const accent = moodAccent(t.mood, t.name);
              const n = counts[t.id] ?? 0;
              const imported = done[t.id];
              return (
                <div key={t.id} className="cv-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* franja de mood */}
                  <div style={{ height: 4, background: accent, boxShadow: `0 0 18px ${accent}` }} />
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div className="cv-wordmark" style={{ fontSize: 18, fontWeight: 600, color: 'var(--cv-text)', lineHeight: 1.2 }}>{t.name}</div>
                    {t.mood && (
                      <span style={{ alignSelf: 'flex-start', fontSize: 11, fontFamily: 'var(--cv-font-mono, monospace)', letterSpacing: '.08em', color: accent, border: `1px solid ${accent}`, borderRadius: 999, padding: '2px 10px', textTransform: 'lowercase' }}>{t.mood}</span>
                    )}
                    {t.description && (
                      <p style={{ fontSize: 13, color: 'var(--cv-text-2)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</p>
                    )}
                    <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 'auto' }}>{n} {n === 1 ? 'canción' : 'canciones'}</div>

                    {imported ? (
                      <div style={{ marginTop: 4 }}>
                        <div className="cv-mono" style={{ fontSize: 12.5, color: 'var(--cv-mint)' }}>✓ Agregada a tu biblioteca</div>
                        <a href="/panel" className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted)', textDecoration: 'underline' }}>asignála a un local →</a>
                      </div>
                    ) : (
                      <button className="cv-btn cv-btn-ghost" onClick={() => doImport(t)} disabled={importing === t.id}
                        style={{ marginTop: 4, fontSize: 13, padding: '8px 14px', opacity: importing === t.id ? 0.6 : 1 }}>
                        {importing === t.id ? 'Importando…' : 'Importar a mi biblioteca'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
