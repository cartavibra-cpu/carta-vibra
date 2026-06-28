'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

const CROSSFADE_SECONDS = 4;
const STEP_MS = 100;

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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-red-600">Error: {error}</p>
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={startPairing}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (!status?.paired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-4xl font-black">Vinculá esta consola</h1>
        {pairCode ? (
          <div className="rounded-2xl border-4 border-black bg-white p-8">
            <p className="mb-2 text-center text-lg font-semibold">Código de vinculación</p>
            <p className="text-center text-7xl font-black tracking-widest">{pairCode}</p>
          </div>
        ) : (<p className="text-gray-600">Generando código…</p>)}
        <p className="max-w-md text-center text-sm text-gray-600">
          Escribí este código de 6 dígitos en tu <b>panel</b>: tu local → sección <b>“Vincular consola”</b>.
        </p>
        <button className="text-sm text-gray-500 underline" onClick={resetPairing}>Generar un código nuevo</button>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-3xl font-bold">{status.name}</h1>
        <p className="text-gray-600">Consola lista para {status.slug}</p>
        <button className="rounded-2xl bg-green-600 px-10 py-5 text-2xl font-bold text-white" onClick={startConsole}>
          ▶ Iniciar sesión musical
        </button>
        <p className="max-w-sm text-center text-xs text-gray-500">
          Tocá el botón para desbloquear el audio (los navegadores no dejan reproducir solos hasta que hay un clic).
        </p>
        <button className="text-sm text-gray-500 underline" onClick={resetPairing}>Vincular otra consola</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <div id="wrap-A" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1 }}><div id="yt-A" /></div>
            <div id="wrap-B" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }}><div id="yt-B" /></div>
          </div>
          <p className="mt-2 text-lg font-semibold">Sonando: {nowTitle}</p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border-4 border-black bg-white p-6 text-center">
            <p className="text-sm font-semibold uppercase text-gray-500">Código para votar</p>
            <p className="text-6xl font-black tracking-widest">{roomCode ?? '—'}</p>
            <p className="mt-1 text-xs text-gray-500">Los clientes lo ingresan en su celular · cambia cada pocos minutos</p>
          </div>
          <div className="rounded border p-3">
            <p className="mb-1 text-sm font-semibold">Ajustes (para probar)</p>
            <label className="text-sm">Segundos por canción (0 = completa):{' '}
              <input type="number" min={0} className="ml-1 w-20 border p-1" value={maxSeconds}
                onChange={(e) => { const n = parseInt(e.target.value) || 0; setMaxSeconds(n); maxSecondsRef.current = n; }} />
            </label>
            <button className="mt-2 block rounded bg-gray-700 px-3 py-1 text-sm text-white" onClick={() => advance()}>⏭ Saltear a la siguiente</button>
          </div>
          <div>
            <h2 className="mb-2 font-semibold">En cola (por votos)</h2>
            <ul className="space-y-1">
              {queue.length === 0 && <li className="text-sm text-gray-500">Esperando votos…</li>}
              {queue.map((q, i) => {
                const tr = tracksRef.current[q.track_id];
                return (
                  <li key={q.track_id} className="flex justify-between rounded border p-2 text-sm">
                    <span>{i + 1}. {tr?.title ?? '—'}</span>
                    <span className="text-gray-600">{q.votes} ▲</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
