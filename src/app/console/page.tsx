'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import BrandMark from '@/components/BrandMark';
import Waveform from '@/components/Waveform';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

const CROSSFADE_SECONDS = 4;
const STEP_MS = 100;

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(94,46,255,.2), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(0,212,255,.1), transparent 60%), #07060e';

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

export default function ConsolePage() {
  const [status, setStatus] = useState<any>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [queue, setQueue] = useState<{ track_id: string; votes: number }[]>([]);
  const [nowTitle, setNowTitle] = useState('—');
  const [maxSeconds, setMaxSeconds] = useState(0);

  const tokenRef = useRef<string | null>(null);
  const venueRef = useRef<string | null>(null);
  const tracksRef = useRef<Record<string, Track>>({});

  // dos "decks" para el crossfade
  const decksRef = useRef<Record<string, any>>({});
  const currentRef = useRef<'A' | 'B'>('A');
  const busyRef = useRef(false);
  const playingRef = useRef(false);
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSecondsRef = useRef(0);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('console_device_token') : null;
    if (token) resumeSession(token);
    else startPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeSession = async (token: string) => {
    setLoading(true);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_status', { p_token: token });
      if (error) { localStorage.removeItem('console_device_token'); return startPairing(); }
      if (data.paired) {
        tokenRef.current = token; venueRef.current = data.venue_id; setStatus(data); setLoading(false);
      } else { localStorage.removeItem('console_device_token'); return startPairing(); }
    } catch { localStorage.removeItem('console_device_token'); return startPairing(); }
  };

  const startPairing = async () => {
    setLoading(true); setError(null); setStatus(null);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_request_pairing');
      if (error) throw error;
      localStorage.setItem('console_device_token', data.device_token);
      tokenRef.current = data.device_token;
      setPairCode(data.pairing_code);
      pollStatus(data.device_token);
    } catch (e: any) { setError(e.message ?? String(e)); setLoading(false); }
  };

  const pollStatus = async (token: string) => {
    setLoading(true);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_status', { p_token: token });
      if (error) throw error;
      setStatus(data); setLoading(false);
      if (data.paired) venueRef.current = data.venue_id;
      else setTimeout(() => pollStatus(token), 2000);
    } catch (e: any) { setError(e.message ?? String(e)); setLoading(false); }
  };

  const resetPairing = () => {
    localStorage.removeItem('console_device_token');
    tokenRef.current = null; venueRef.current = null;
    setStatus(null); setPairCode(null); setStarted(false);
    startPairing();
  };

  const rotate = async () => {
    const sb = supa(); const token = tokenRef.current; if (!sb || !token) return;
    const { data } = await sb.rpc('console_rotate_code', { p_token: token, p_ttl_seconds: 150 });
    if (data?.code) setRoomCode(data.code);
  };

  const refreshQueue = async () => {
    const sb = supa(); const venueId = venueRef.current; if (!sb || !venueId) return;
    const { data } = await sb.from('queue').select('track_id,votes')
      .eq('venue_id', venueId).eq('state', 'queued')
      .order('votes', { ascending: false }).order('created_at', { ascending: true });
    setQueue((data as any) || []);
  };

  const refreshNow = async () => {
    const sb = supa(); const venueId = venueRef.current; if (!sb || !venueId) return;
    const { data } = await sb.from('now_playing').select('track_id').eq('venue_id', venueId).maybeSingle();
    const tid = (data as any)?.track_id;
    const tr = tid ? tracksRef.current[tid] : null;
    setNowTitle(tr ? `${tr.title}${tr.artist ? ' — ' + tr.artist : ''}` : '—');
  };

  // Funde el deck actual hacia el otro deck reproduciendo videoId
  const transitionTo = (videoId: string) => {
    const fromKey = currentRef.current;
    const toKey = fromKey === 'A' ? 'B' : 'A';
    const from = decksRef.current[fromKey];
    const to = decksRef.current[toKey];
    if (!to) { busyRef.current = false; return; }
    try { to.loadVideoById(videoId); to.setVolume(0); } catch { busyRef.current = false; return; }

    if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
    const steps = Math.max(1, Math.round((CROSSFADE_SECONDS * 1000) / STEP_MS));
    let i = 0;
    rampRef.current = setInterval(() => {
      i++;
      const f = Math.min(1, i / steps);
      try { to.setVolume(Math.round(f * 100)); } catch {}
      try { if (from) from.setVolume(Math.round((1 - f) * 100)); } catch {}
      const toEl = document.getElementById('wrap-' + toKey);
      const fromEl = document.getElementById('wrap-' + fromKey);
      if (toEl) toEl.style.opacity = String(f);
      if (fromEl) fromEl.style.opacity = String(1 - f);
      if (i >= steps) {
        if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
        try { if (from) from.stopVideo(); } catch {}
        currentRef.current = toKey;
        busyRef.current = false;
      }
    }, STEP_MS);
  };

  // Pasa a la siguiente canción más votada (con crossfade)
  const advance = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
      if (!sb || !token || !venueId) { busyRef.current = false; return; }
      const { data } = await sb.from('queue').select('track_id')
        .eq('venue_id', venueId).eq('state', 'queued')
        .order('votes', { ascending: false }).order('created_at', { ascending: true }).limit(1);
      const top = (data as any)?.[0];
      if (!top) { busyRef.current = false; return; }
      const track = tracksRef.current[top.track_id];
      await sb.rpc('console_set_now_playing', { p_token: token, p_track: top.track_id, p_position: 0 });
      await refreshNow();
      if (!track?.external_id) { busyRef.current = false; setTimeout(advance, 400); return; }
      playingRef.current = true;
      transitionTo(track.external_id);
    } catch { busyRef.current = false; }
  };

  const startConsole = async () => {
    const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
    if (!sb || !token || !venueId) return;
    setStarted(true);

    const { data: t } = await sb.from('catalog_track').select('id,title,artist,external_id').eq('venue_id', venueId);
    const map: Record<string, Track> = {};
    (t as Track[] | null)?.forEach((tr) => { map[tr.id] = tr; });
    tracksRef.current = map;

    await rotate();
    setInterval(rotate, 120000);

    await refreshQueue();
    await refreshNow();
    sb.channel('console-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `venue_id=eq.${venueId}` }, async () => {
        await refreshQueue();
        if (!playingRef.current && !busyRef.current) advance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `venue_id=eq.${venueId}` }, refreshNow)
      .subscribe();

    const onStateChange = (e: any) => {
      if (e.data === window.YT.PlayerState.ENDED && !busyRef.current) {
        playingRef.current = false;
        advance();
      }
    };
    const onError = () => {
      if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
      try { decksRef.current[currentRef.current]?.setVolume(100); } catch {}
      const el = document.getElementById('wrap-' + currentRef.current); if (el) el.style.opacity = '1';
      busyRef.current = false;
      setTimeout(() => advance(), 400);
    };

    const YT = await loadYT();
    let ready = 0;
    const onReady = () => { ready++; if (ready === 2) advance(); };
    const opts = (id: string) => ({
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onReady, onStateChange, onError },
    } as any);
    decksRef.current.A = new YT.Player('yt-A', opts('A'));
    decksRef.current.B = new YT.Player('yt-B', opts('B'));

    // monitor: cuando la actual está por terminar, traer la siguiente fundida
    setInterval(() => {
      if (busyRef.current || !playingRef.current) return;
      const p = decksRef.current[currentRef.current];
      if (!p || !p.getDuration) return;
      let dur = 0, cur = 0;
      try { dur = p.getDuration(); cur = p.getCurrentTime(); } catch { return; }
      const maxSec = maxSecondsRef.current;
      const nearEnd = dur > 0 && dur - cur <= CROSSFADE_SECONDS + 1;
      const reachedMax = maxSec > 0 && cur >= maxSec;
      if (nearEnd || reachedMax) advance();
    }, 1000);
  };

  // ---------- Error ----------
  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: STAGE_BG }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--cv-warm)', fontSize: 15, marginBottom: 14 }}>Error: {error}</p>
          <button className="cv-btn cv-btn-cyan" style={{ fontSize: 15, padding: '12px 22px' }} onClick={startPairing}>Reintentar</button>
        </div>
      </main>
    );
  }

  // ---------- Vincular consola ----------
  if (!status?.paired) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
        <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 42%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24 }}>
          <BrandMark size={150} />
          <div style={{ textAlign: 'center' }}>
            <h1 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 600 }}>Vinculá esta consola</h1>
            <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10 }}>Escribí este código en tu panel · sección “Vincular consola”</p>
          </div>
          {pairCode ? (
            <div style={{ display: 'flex', gap: 10 }}>
              {pairCode.split('').map((d, i) => (
                <div key={i} className="cv-wordmark" style={{ width: 60, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, background: 'var(--cv-bg-2)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: 'var(--cv-text)' }}>{d}</div>
              ))}
            </div>
          ) : (<p className="cv-mono" style={{ color: 'var(--cv-muted)' }}>generando código…</p>)}
          <button onClick={resetPairing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cv-font-body)', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline' }}>Generar un código nuevo</button>
        </div>
      </main>
    );
  }

  // ---------- Iniciar sesión musical ----------
  if (!started) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
        <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 44%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: 24 }}>
          <BrandMark size={160} />
          <div style={{ textAlign: 'center' }}>
            <h1 className="cv-wordmark" style={{ fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 600 }}>{status.name}</h1>
            <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10 }}>Consola lista para {status.slug}</p>
          </div>
          <button className="cv-btn cv-btn-mint" style={{ fontSize: 20, padding: '18px 40px', boxShadow: '0 0 50px -8px rgba(110,243,178,.5)' }} onClick={startConsole}>
            ▶ Iniciar sesión musical
          </button>
          <p style={{ maxWidth: 360, textAlign: 'center', fontSize: 12, color: 'var(--cv-mono)', lineHeight: 1.5 }}>
            Tocá el botón para desbloquear el audio (los navegadores no dejan reproducir solos hasta que hay un clic).
          </p>
          <button onClick={resetPairing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cv-font-body)', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline' }}>Vincular otra consola</button>
        </div>
      </main>
    );
  }

  // ---------- Consola en vivo ----------
  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'radial-gradient(1000px 720px at 50% 52%, rgba(0,212,255,.10), transparent 60%), #060810' }}>
      <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.02) 0 1px, transparent 1px 36px)', opacity: 0.4 }} />
      <div style={{ position: 'relative', minHeight: '100vh', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>

        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div className="cv-wordmark" style={{ fontSize: 22 }}>carta <span className="cv-grad-text">vibra</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-cyan)', boxShadow: '0 0 12px var(--cv-cyan)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-cyan)' }}>EN VIVO</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>

          {/* izquierda: video + sonando ahora */}
          <div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 30px 80px -40px rgba(0,0,0,.9)' }}>
              <div id="wrap-A" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1 }}><div id="yt-A" /></div>
              <div id="wrap-B" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }}><div id="yt-B" /></div>
            </div>
            <div className="cv-mono" style={{ marginTop: 14, fontSize: 14, letterSpacing: '.06em', color: 'var(--cv-muted-2)' }}>
              SONANDO AHORA · <span style={{ color: 'var(--cv-cyan)' }}>{nowTitle}</span>
            </div>
          </div>

          {/* derecha: código + cola + ajustes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* código para votar (héroe en gradiente) */}
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(0,212,255,.16)', background: 'radial-gradient(400px 240px at 50% 0%, rgba(0,212,255,.12), transparent 60%), var(--cv-bg-2)', padding: '22px 20px', textAlign: 'center' }}>
              <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.24em', color: 'var(--cv-cyan-light)' }}>CÓDIGO PARA VOTAR</div>
              <div className="cv-wordmark cv-grad-code" style={{ fontSize: 'clamp(56px, 7vw, 92px)', fontWeight: 700, lineHeight: 1, letterSpacing: '.04em', margin: '8px 0', textShadow: '0 0 50px rgba(0,212,255,.3)' }}>{roomCode ?? '—'}</div>
              <div style={{ marginTop: 6 }}><Waveform n={40} color="#00D4FF" maxH={26} barW={3} gap={3} seed={7} /></div>
              <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 10 }}>Los clientes lo ingresan en su celular · cambia cada pocos minutos</div>
            </div>

            {/* cola */}
            <div>
              <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)', marginBottom: 12 }}>EN COLA · LO MÁS VOTADO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {queue.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>esperando votos…</div>}
                {queue.map((q, i) => {
                  const tr = tracksRef.current[q.track_id];
                  return (
                    <div key={q.track_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-cyan)', minWidth: 22 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr?.title ?? '—'}</span>
                      <span className="cv-wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: 'var(--cv-cyan-light)' }}>
                        <span style={{ color: 'var(--cv-cyan)' }}>▲</span>{q.votes}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ajustes (discreto, para probar) */}
            <div className="cv-card" style={{ padding: '14px 16px' }}>
              <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mono)', marginBottom: 10 }}>AJUSTES</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--cv-muted)', flexWrap: 'wrap' }}>
                Segundos por canción (0 = completa):
                <input type="number" min={0} className="cv-input" style={{ width: 72, padding: '7px 10px' }} value={maxSeconds}
                  onChange={(e) => { const n = parseInt(e.target.value) || 0; setMaxSeconds(n); maxSecondsRef.current = n; }} />
              </label>
              <button className="cv-btn cv-btn-ghost" style={{ marginTop: 10, fontSize: 13, padding: '8px 14px' }} onClick={() => advance()}>⏭ Saltear a la siguiente</button>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
