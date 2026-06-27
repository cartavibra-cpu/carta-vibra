'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

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

  const tokenRef = useRef<string | null>(null);
  const venueRef = useRef<string | null>(null);
  const tracksRef = useRef<Record<string, Track>>({});
  const playerRef = useRef<any>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('console_device_token') : null;
    if (token) resumeSession(token);
    else startPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si hay un token guardado: si está vinculado, lo usamos; si quedó a medias o es
  // desconocido, lo descartamos y pedimos un código nuevo (así nunca quedás pegado).
  const resumeSession = async (token: string) => {
    setLoading(true);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_status', { p_token: token });
      if (error) { localStorage.removeItem('console_device_token'); return startPairing(); }
      if (data.paired) {
        tokenRef.current = token;
        venueRef.current = data.venue_id;
        setStatus(data);
        setLoading(false);
      } else {
        localStorage.removeItem('console_device_token');
        return startPairing();
      }
    } catch {
      localStorage.removeItem('console_device_token');
      return startPairing();
    }
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

  const playNext = async () => {
    const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
    if (!sb || !token || !venueId) return;
    const { data } = await sb.from('queue').select('track_id')
      .eq('venue_id', venueId).eq('state', 'queued')
      .order('votes', { ascending: false }).order('created_at', { ascending: true }).limit(1);
    const top = (data as any)?.[0];
    if (!top) { playingRef.current = false; return; }
    const track = tracksRef.current[top.track_id];
    await sb.rpc('console_set_now_playing', { p_token: token, p_track: top.track_id, p_position: 0 });
    await refreshNow();
    if (track?.external_id && playerRef.current?.loadVideoById) {
      playingRef.current = true;
      playerRef.current.loadVideoById(track.external_id);
    } else {
      playingRef.current = false;
      setTimeout(playNext, 600);
    }
  };

  const startConsole = async () => {
    const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
    if (!sb || !token || !venueId) return;
    setStarted(true);

    const { data: t } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('venue_id', venueId);
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
        if (!playingRef.current) playNext();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `venue_id=eq.${venueId}` }, refreshNow)
      .subscribe();

    const YT = await loadYT();
    playerRef.current = new YT.Player('yt-player', {
      playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => playNext(),
        onStateChange: (e: any) => { if (e.data === YT.PlayerState.ENDED) playNext(); },
        onError: () => { playingRef.current = false; setTimeout(() => playNext(), 400); },
      },
    });
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
        ) : (
          <p className="text-gray-600">Generando código…</p>
        )}
        <p className="max-w-md text-center text-sm text-gray-600">
          Escribí este código de 6 dígitos en tu <b>panel</b> (en la compu donde iniciaste sesión): tu local → sección <b>“Vincular consola”</b>.
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
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <div id="yt-player" className="h-full w-full" />
          </div>
          <p className="mt-2 text-lg font-semibold">Sonando: {nowTitle}</p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border-4 border-black bg-white p-6 text-center">
            <p className="text-sm font-semibold uppercase text-gray-500">Código para votar</p>
            <p className="text-6xl font-black tracking-widest">{roomCode ?? '—'}</p>
            <p className="mt-1 text-xs text-gray-500">Los clientes lo ingresan en su celular · cambia cada pocos minutos</p>
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
