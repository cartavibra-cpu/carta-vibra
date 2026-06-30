'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import BrandMark from '@/components/BrandMark';
import { useIsMobile } from '@/lib/useIsMobile';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), var(--cv-bg)';

type Template = { id: string; name: string; description: string | null; mood: string | null };
type Track = { id: string; title: string; artist: string | null; external_id: string | null; is_embeddable: boolean | null };

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
  const isMobile = useIsMobile();
  const [session, setSession] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  // preview modal
  const [modalTpl, setModalTpl] = useState<Template | null>(null);
  const [modalTracks, setModalTracks] = useState<Track[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  const openModal = async (t: Template) => {
    setModalTpl(t); setModalTracks([]); setPreviewId(null); setModalLoading(true);
    const sb = supa();
    if (!sb) { setModalLoading(false); return; }
    const { data } = await sb.from('playlist_template_track')
      .select('id,title,artist,external_id,is_embeddable').eq('template_id', t.id).order('sort').order('created_at');
    setModalTracks((data as Track[]) || []);
    setModalLoading(false);
  };
  const closeModal = () => { setModalTpl(null); setModalTracks([]); setPreviewId(null); };

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BrandMark size={104} /></div>
          <p style={{ fontSize: 15, color: 'var(--cv-text-2)', marginBottom: 18 }}>Necesitás iniciar sesión para ver las playlists curadas.</p>
          <a href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Ir al inicio</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '32px 20px 60px' }}>
        <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Curadas</h1>
        <p style={{ fontSize: 14.5, color: 'var(--cv-text-2)', lineHeight: 1.55, margin: '8px 0 26px', maxWidth: 580 }}>
          Playlists listas para usar. Abrí cualquiera para <b style={{ color: 'var(--cv-text)' }}>escuchar sus temas</b>, e importá la que te guste a tu <a href="/panel/playlists" style={{ color: 'var(--cv-cyan)' }}>biblioteca</a> — después la asignás a tus locales desde <a href="/panel" style={{ color: 'var(--cv-cyan)' }}>Mis locales</a>. Importar nunca pisa tus playlists: crea una copia tuya.
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

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <button className="cv-btn cv-btn-ghost" onClick={() => openModal(t)} style={{ fontSize: 12.5, padding: '8px 14px' }}>▸ Ver canciones</button>
                      {imported ? (
                        <span className="cv-mono" style={{ fontSize: 12.5, color: 'var(--cv-mint)', alignSelf: 'center' }}>✓ Agregada</span>
                      ) : (
                        <button className="cv-btn cv-btn-cyan" onClick={() => doImport(t)} disabled={importing === t.id} style={{ fontSize: 12.5, padding: '8px 14px', opacity: importing === t.id ? 0.6 : 1 }}>{importing === t.id ? 'Importando…' : 'Importar'}</button>
                      )}
                    </div>
                    {imported && (
                      <a href="/panel" className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted)', textDecoration: 'underline' }}>asignála a un local →</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL preview */}
      {modalTpl && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,3,10,.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 10 : 18 }}>
          <div onClick={(e) => e.stopPropagation()} className="cv-card" style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--cv-line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="cv-wordmark" style={{ fontSize: 20, fontWeight: 600, color: 'var(--cv-text)' }}>{modalTpl.name}</div>
                  {modalTpl.mood && <div className="cv-mono" style={{ fontSize: 11, color: moodAccent(modalTpl.mood, modalTpl.name), marginTop: 3 }}>{modalTpl.mood}</div>}
                </div>
                <button onClick={closeModal} className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
              {modalTpl.description && <p style={{ fontSize: 13, color: 'var(--cv-text-2)', lineHeight: 1.5, margin: '8px 0 0' }}>{modalTpl.description}</p>}
            </div>

            {/* reproductor */}
            {previewId && (
              <div style={{ padding: '14px 20px 0' }}>
                <iframe
                  key={previewId}
                  src={`https://www.youtube.com/embed/${previewId}?autoplay=1&rel=0`}
                  style={{ width: '100%', aspectRatio: '16 / 9', border: 'none', borderRadius: 12, background: '#000' }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {/* lista */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              {modalLoading ? (
                <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>cargando canciones…</div>
              ) : modalTracks.length === 0 ? (
                <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>esta playlist todavía no tiene canciones.</div>
              ) : (
                <>
                  {!previewId && <p className="cv-mono" style={{ fontSize: 11.5, color: 'var(--cv-mono)', margin: '0 0 10px' }}>tocá ▶ en cualquier tema para escucharlo</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {modalTracks.map((tr, i) => {
                      const active = previewId === tr.external_id;
                      return (
                        <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: active ? 'rgba(0,212,255,.10)' : 'transparent', border: active ? '1px solid rgba(0,212,255,.3)' : '1px solid transparent' }}>
                          <button onClick={() => tr.external_id && setPreviewId(tr.external_id)} disabled={!tr.external_id}
                            style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--cv-line)', background: active ? 'var(--cv-cyan)' : 'rgba(255,255,255,.04)', color: active ? 'var(--cv-on)' : 'var(--cv-cyan)', cursor: tr.external_id ? 'pointer' : 'default', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {active ? '♪' : '▶'}
                          </button>
                          <span className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', width: 20, flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, color: 'var(--cv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.title}</div>
                            {tr.artist && <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.artist}</div>}
                          </div>
                          {tr.is_embeddable === false && <span title="No se puede reproducir embebido" style={{ fontSize: 11, color: 'var(--cv-warm)', flexShrink: 0 }}>⚠️</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--cv-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              {done[modalTpl.id] ? (
                <>
                  <span className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mint)' }}>✓ En tu biblioteca</span>
                  <a href="/panel" className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '9px 16px', textDecoration: 'none' }}>Asignar a un local →</a>
                </>
              ) : (
                <>
                  <span className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)' }}>{modalTracks.length} {modalTracks.length === 1 ? 'canción' : 'canciones'}</span>
                  <button className="cv-btn cv-btn-cyan" onClick={() => doImport(modalTpl)} disabled={importing === modalTpl.id} style={{ fontSize: 14, padding: '10px 20px', opacity: importing === modalTpl.id ? 0.6 : 1 }}>
                    {importing === modalTpl.id ? 'Importando…' : 'Importar a mi biblioteca'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
