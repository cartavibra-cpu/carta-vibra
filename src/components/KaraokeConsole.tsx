'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Signup = { id: string; singer: string; title: string | null; artist: string | null; external_id: string | null; state: string; sort: number };

function loadYT(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(s);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
  });
}

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(94,46,255,.2), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(110,243,178,.10), transparent 60%), #07060e';

export default function KaraokeConsole({ token, venueId, slug, roomCode }: { token: string; venueId: string; slug: string; roomCode: string | null }) {
  const [queue, setQueue] = useState<Signup[]>([]);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const advancingRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);

  const current = queue.find((s) => s.state === 'singing') || null;
  const waiting = queue.filter((s) => s.state === 'waiting');

  const loadQueue = async () => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('karaoke_signup')
      .select('id,singer,title,artist,external_id,state,sort')
      .eq('venue_id', venueId).in('state', ['waiting', 'singing']).order('sort');
    setQueue((data as Signup[]) || []);
  };

  const advance = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const sb = supa();
    try { if (sb) await sb.rpc('karaoke_advance', { p_token: token }); }
    finally { advancingRef.current = false; }
    // el realtime recarga la fila; el efecto del reproductor carga al nuevo
  };

  // realtime + player (una vez)
  useEffect(() => {
    let cancelled = false;
    loadQueue();
    const sb = supa();
    const ch = sb?.channel('karaoke-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karaoke_signup', filter: `venue_id=eq.${venueId}` }, () => loadQueue())
      .subscribe();

    loadYT().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player('yt-karaoke', {
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 1, disablekb: 0, rel: 0, modestbranding: 1, playsinline: 1, fs: 1, cc_load_policy: 0 },
        events: {
          onReady: () => { readyRef.current = true; syncPlayer(); },
          onStateChange: (e: any) => { if (e.data === window.YT.PlayerState.ENDED) advance(); },
          onError: () => { advance(); },
        },
      });
    });

    return () => { cancelled = true; if (sb && ch) sb.removeChannel(ch); try { playerRef.current?.destroy?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // cargar el video del que está cantando
  const syncPlayer = () => {
    if (!readyRef.current) return;
    const id = current?.external_id || null;
    if (id && id !== loadedIdRef.current) {
      loadedIdRef.current = id;
      try { playerRef.current.loadVideoById(id); } catch {}
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncPlayer(); }, [current?.external_id]);

  // Nota: el primer arranque (y tras vaciarse la fila) lo dispara el operador con
  // "Empezar" — eso da el gesto que YouTube necesita para reproducir con audio.
  // Después, al terminar cada tema, onStateChange(ENDED) llama a advance() solo.

  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
      <div style={{ position: 'relative', minHeight: '100vh', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>

        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div className="cv-wordmark" style={{ fontSize: 22 }}>carta <span className="cv-grad-text">vibra</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)' }}>
              Anotate con el código <b className="cv-grad-code" style={{ fontFamily: 'var(--cv-font-display)', fontSize: 16, letterSpacing: '.1em' }}>{roomCode ?? '—'}</b>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-mint)', boxShadow: '0 0 12px var(--cv-mint)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
              <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>KARAOKE EN VIVO</span>
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>

          {/* escenario */}
          <div>
            <div style={{ position: 'relative', background: '#000', borderRadius: 18, overflow: 'hidden', aspectRatio: '16 / 9', border: '1px solid rgba(255,255,255,.08)' }}>
              <div id="yt-karaoke" style={{ width: '100%', height: '100%', display: current ? 'block' : 'none' }} />
              {!current && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 46 }}>🎤</div>
                  <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, color: 'var(--cv-text)' }}>Anotate para cantar</div>
                  <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>escaneá el QR y poné el código</div>
                  <div className="cv-wordmark cv-grad-code" style={{ fontSize: 'clamp(48px, 7vw, 80px)', fontWeight: 700, letterSpacing: '.05em', marginTop: 6, textShadow: '0 0 50px rgba(0,212,255,.3)' }}>{roomCode ?? '—'}</div>
                </div>
              )}
            </div>

            {/* cantando ahora + controles */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>CANTANDO AHORA</div>
                <div className="cv-wordmark" style={{ fontSize: 28, fontWeight: 700, color: 'var(--cv-text)', lineHeight: 1.1, marginTop: 2 }}>
                  {current ? current.singer : '—'}
                </div>
                {current && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{current.title}{current.artist ? ` — ${current.artist}` : ''}</div>}
              </div>
              <button className="cv-btn cv-btn-ghost" onClick={advance} disabled={!current && waiting.length === 0}
                style={{ fontSize: 15, padding: '11px 22px', opacity: !current && waiting.length === 0 ? 0.5 : 1 }}>
                ⏭ {current ? 'Siguiente cantante' : 'Empezar'}
              </button>
            </div>
          </div>

          {/* fila */}
          <div className="cv-card" style={{ padding: '18px 18px' }}>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)', marginBottom: 14 }}>PRÓXIMOS TURNOS ({waiting.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '62vh', overflowY: 'auto' }}>
              {waiting.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>nadie en espera. Cuando se anoten, aparecen acá.</div>}
              {waiting.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid var(--cv-line)' }}>
                  <span className="cv-wordmark" style={{ fontSize: 16, fontWeight: 700, color: 'var(--cv-muted)', width: 22, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.singer}</div>
                    <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}{s.artist ? ` — ${s.artist}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <a href={slug ? `/panel/venues/${slug}` : '/panel'} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', textDecoration: 'none' }}>← Volver al panel</a>
        </div>
      </div>
    </main>
  );
}
