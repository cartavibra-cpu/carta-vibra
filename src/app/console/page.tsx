'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import BrandMark from '@/components/BrandMark';
import Waveform from '@/components/Waveform';
import KaraokeConsole from '@/components/KaraokeConsole';
import { getSkin, SKIN_STORAGE_KEY, type SkinName } from '@/lib/skins';

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
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [queue, setQueue] = useState<{ track_id: string; votes: number }[]>([]);
  const [nowTitle, setNowTitle] = useState('—');
  const [maxSeconds, setMaxSeconds] = useState(0);
  const [isAutoNow, setIsAutoNow] = useState(false);
  const [autoOn, setAutoOn] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ccOn, setCcOn] = useState(false);
  const [copied, setCopied] = useState(false);
  // aviso cuando activás otra playlist en el local (no corta sola)
  const [pending, setPending] = useState<{ playlistId: string; name: string } | null>(null);
  // id de la playlist activa como ESTADO (no solo ref) para que <KaraokeConsole/>
  // reaccione cuando cambia la playlist. Y el overlay de transición entre modos.
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<null | 'jukebox' | 'karaoke'>(null);

  // Vista ambiente (la rockola que se proyecta)
  const [skin, setSkin] = useState<SkinName>('neon');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSettingsRef = useRef(false);

  const tokenRef = useRef<string | null>(null);
  const venueRef = useRef<string | null>(null);
  const tracksRef = useRef<Record<string, Track>>({});
  const stageRef = useRef<HTMLDivElement | null>(null);

  // dos "decks" para el crossfade
  const decksRef = useRef<Record<string, any>>({});
  const currentRef = useRef<'A' | 'B'>('A');
  const busyRef = useRef(false);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cmdChRef = useRef<any>(null);
  const maxSecondsRef = useRef(0);
  const ccOnRef = useRef(false);

  // AutoDJ (relleno aleatorio inteligente cuando no hay votos)
  const autoPoolRef = useRef<string[]>([]);
  const activePlaylistRef = useRef<string | null>(null);
  // canal realtime de la playlist activa (se re-suscribe al cambiar de playlist)
  const tracksChannelRef = useRef<{ unsubscribe: () => void } | null>(null);
  const bagRef = useRef<string[]>([]);
  const lastAutoRef = useRef<string | null>(null);
  const autoOnRef = useRef(true);

  // Auto-sanado: temas que fallan al reproducir se marcan "muertos" para no volver a elegirlos.
  const deadRef = useRef<Set<string>>(new Set());
  const nowTrackIdRef = useRef<string | null>(null);

  // Para alternar jukebox ⇄ karaoke en caliente (sin recargar):
  const jbChannelRef = useRef<any>(null);                                   // canal jukebox (cola + sonando)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);   // monitor de fin de canción
  const currentSectionRef = useRef<'jukebox' | 'karaoke'>('jukebox');       // modo actual (para detectar el cambio)
  const switchingToJukeboxRef = useRef(false);                              // bandera: karaoke→jukebox pendiente de arrancar

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('console_device_token') : null;
    if (token) resumeSession(token);
    else startPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pantalla completa: refleja el estado real del navegador
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Skin de la vista ambiente: la recordamos por dispositivo (Fase B: por local).
  useEffect(() => {
    try {
      const s = localStorage.getItem(SKIN_STORAGE_KEY);
      if (s === 'retro' || s === 'neon') setSkin(s);
    } catch {}
  }, []);

  const applySkin = (s: SkinName) => {
    setSkin(s);
    try { localStorage.setItem(SKIN_STORAGE_KEY, s); } catch {}
  };

  // Controles que se auto-esconden: aparecen al mover el mouse / tocar y se van solos.
  const pokeControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => { if (!showSettingsRef.current) setControlsVisible(false); }, 3200);
  };
  useEffect(() => {
    const t = setTimeout(() => { if (!showSettingsRef.current) setControlsVisible(false); }, 3800);
    return () => { clearTimeout(t); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  useEffect(() => { showSettingsRef.current = showSettings; if (showSettings) setControlsVisible(true); }, [showSettings]);

  // Atajos de teclado. El teclado lo maneja la consola (con fade); el reproductor
  // de YouTube conserva sus controles con el mouse. Si el foco entra al video, el
  // efecto de abajo lo devuelve al escenario para que los atajos sigan andando.
  useEffect(() => {
    if (!started || karaokeMode) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      pokeControls();
      const k = e.key.toLowerCase();
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); togglePlayPause(); }
      else if (e.key === 'ArrowRight' || k === 'n') { e.preventDefault(); advance(); }
      else if (k === 'f') { e.preventDefault(); toggleFs(); }
      else if (k === 'c') { e.preventDefault(); toggleCC(); }
      else if (e.key === 'Escape') { if (document.fullscreenElement) { e.preventDefault(); document.exitFullscreen?.(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, karaokeMode]);

  // Diálogo con los controles nativos: al hacer clic en el video el foco se va al
  // iframe de YouTube. Lo devolvemos al escenario para que el teclado siga siendo
  // de la consola (mouse = controles de YouTube, teclado = atajos con fade).
  useEffect(() => {
    if (!started || karaokeMode) return;
    const onBlur = () => {
      setTimeout(() => {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && ae.tagName === 'IFRAME' && stageRef.current && stageRef.current.contains(ae)) {
          try { stageRef.current.focus(); } catch {}
        }
      }, 0);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [started, karaokeMode]);

  // Al volver de Karaoke a Jukebox, arrancamos el motor jukebox recién cuando los
  // divs yt-A/yt-B ya se renderizaron. La bandera evita arrancarlo en el inicio
  // normal (ese caso lo maneja startConsole directamente).
  useEffect(() => {
    if (started && !karaokeMode && switchingToJukeboxRef.current) {
      switchingToJukeboxRef.current = false;
      startJukeboxEngine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karaokeMode, started]);

  const resumeSession = async (token: string) => {
    setLoading(true);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_status', { p_token: token });
      if (error) { localStorage.removeItem('console_device_token'); return startPairing(); }
      if (data.paired) {
        tokenRef.current = token; venueRef.current = data.venue_id; setStatus(data); setLoading(false);
        localStorage.removeItem('console_pairing_code');
      } else {
        // Mantener el MISMO código entre recargas en vez de generar uno nuevo cada vez.
        tokenRef.current = token;
        const savedCode = typeof window !== 'undefined' ? localStorage.getItem('console_pairing_code') : null;
        if (savedCode) { setPairCode(savedCode); setStatus(data); setLoading(false); pollStatus(token); }
        else { localStorage.removeItem('console_device_token'); return startPairing(); }
      }
    } catch { localStorage.removeItem('console_device_token'); return startPairing(); }
  };

  const startPairing = async () => {
    setLoading(true); setError(null); setStatus(null);
    try {
      const sb = supa(); if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_request_pairing');
      if (error) throw error;
      localStorage.setItem('console_device_token', data.device_token);
      localStorage.setItem('console_pairing_code', data.pairing_code);
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
      if (data.paired) { venueRef.current = data.venue_id; localStorage.removeItem('console_pairing_code'); }
      else setTimeout(() => pollStatus(token), 2000);
    } catch (e: any) { setError(e.message ?? String(e)); setLoading(false); }
  };

  const resetPairing = () => {
    localStorage.removeItem('console_device_token');
    localStorage.removeItem('console_pairing_code');
    tokenRef.current = null; venueRef.current = null;
    setStatus(null); setPairCode(null); setStarted(false);
    startPairing();
  };

  const copyPairCode = async () => {
    if (!pairCode) return;
    try {
      await navigator.clipboard.writeText(pairCode);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = pairCode; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
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

  // AutoDJ: bolsa barajada de la playlist activa (todas una vez antes de repetir).
  const pickAuto = (): string | null => {
    const pool = autoPoolRef.current.filter((id) => !deadRef.current.has(id));
    if (!pool.length) return null;
    let bag = bagRef.current.filter((id) => !deadRef.current.has(id) && pool.includes(id));
    if (bag.length === 0) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (pool.length > 1 && bag[0] === lastAutoRef.current) {
        bag.push(bag.shift() as string);
      }
    }
    const id = bag.shift() as string;
    bagRef.current = bag;
    lastAutoRef.current = id;
    return id;
  };

  // Subtítulos: aplica el estado actual (on/off) a un reproductor.
  const applyCC = (p: any) => {
    if (!p) return;
    try {
      if (ccOnRef.current) { p.loadModule?.('captions'); p.loadModule?.('cc'); }
      else { p.unloadModule?.('captions'); p.unloadModule?.('cc'); }
    } catch {}
  };
  const toggleCC = () => {
    const next = !ccOnRef.current;
    ccOnRef.current = next; setCcOn(next);
    applyCC(decksRef.current[currentRef.current]);
  };

  // Pantalla completa sobre el ESCENARIO (video + código flotante), no sobre el iframe pelado.
  const toggleFs = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else { el.requestFullscreen?.(); setTimeout(() => { try { el.focus(); } catch {} }, 60); }
  };

  // Pausa/Reanuda con fundido suave.
  const pauseWithFade = () => {
    const p = decksRef.current[currentRef.current];
    if (!p) return;
    setIsPaused(true); pausedRef.current = true;
    if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
    let v = 100;
    fadeRampRef.current = setInterval(() => {
      v -= 12;
      try { p.setVolume(Math.max(0, v)); } catch {}
      if (v <= 0) {
        if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
        try { p.pauseVideo(); } catch {}
      }
    }, 60);
  };
  const resumeWithFade = () => {
    const p = decksRef.current[currentRef.current];
    if (!p) return;
    setIsPaused(false); pausedRef.current = false;
    try { p.setVolume(0); p.playVideo(); } catch {}
    if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
    let v = 0;
    fadeRampRef.current = setInterval(() => {
      v += 12;
      try { p.setVolume(Math.min(100, v)); } catch {}
      if (v >= 100) { if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; } }
    }, 60);
  };
  // Decide según el estado REAL del reproductor (no solo nuestra bandera), así nunca se desfasa.
  const togglePlayPause = () => {
    const p = decksRef.current[currentRef.current];
    let st: number | null = null;
    try { st = p?.getPlayerState?.(); } catch {}
    if (st === 2) resumeWithFade();
    else if (st === 1 || st === 3) pauseWithFade();
    else { if (pausedRef.current) resumeWithFade(); else pauseWithFade(); }
  };

  // Avisa al control del celular el estado actual (play/pausa, segundos, AutoDJ).
  const broadcastJbState = () => {
    try { cmdChRef.current?.send({ type: 'broadcast', event: 'jbstate', payload: { playing: !pausedRef.current, seconds: maxSecondsRef.current, autodj: autoOnRef.current } }); } catch {}
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

  // Pasa a la siguiente. Prioridad: lo más votado. Si no hay votos y AutoDJ está activo,
  // elige de la playlist activa (el local nunca se queda en silencio).
  const advance = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
      if (!sb || !token || !venueId) { busyRef.current = false; return; }
      const { data } = await sb.from('queue').select('track_id')
        .eq('venue_id', venueId).eq('state', 'queued')
        .order('votes', { ascending: false }).order('created_at', { ascending: true }).limit(20);
      const voted = ((data as any[]) || []).find((r) => !deadRef.current.has(r.track_id));

      let trackId: string | null = null;
      let isAuto = false;
      if (voted) { trackId = voted.track_id; }
      else if (autoOnRef.current) { trackId = pickAuto(); isAuto = true; }

      if (!trackId) { playingRef.current = false; busyRef.current = false; return; }

      const track = tracksRef.current[trackId];
      nowTrackIdRef.current = trackId;
      await sb.rpc('console_set_now_playing', { p_token: token, p_track: trackId, p_position: 0 });
      setIsAutoNow(isAuto);
      await refreshNow();
      if (!track?.external_id) { busyRef.current = false; setTimeout(advance, 400); return; }
      pausedRef.current = false; setIsPaused(false);
      playingRef.current = true;
      transitionTo(track.external_id);
    } catch (e) { logError('console-advance', e); busyRef.current = false; }
  };

  // Carga el mapa de canciones + el pool del AutoDJ desde la PLAYLIST ACTIVA
  // (por playlist, no por local → así también suenan las de la biblioteca).
  const reloadActivePlaylist = async () => {
    const sb = supa(); const pid = activePlaylistRef.current;
    if (!sb || !pid) { tracksRef.current = {}; autoPoolRef.current = []; bagRef.current = []; return; }
    const { data } = await sb.from('catalog_track')
      .select('id,title,artist,external_id,enabled,is_embeddable').eq('playlist_id', pid);
    const map: Record<string, Track> = {};
    const pool: string[] = [];
    ((data as any[]) || []).forEach((tr) => {
      map[tr.id] = { id: tr.id, title: tr.title, artist: tr.artist, external_id: tr.external_id };
      if (tr.external_id && tr.enabled !== false && tr.is_embeddable !== false && !deadRef.current.has(tr.id)) pool.push(tr.id);
    });
    tracksRef.current = map;
    autoPoolRef.current = pool;
    bagRef.current = [];
  };

  // Canal realtime SOLO de la playlist activa. Se re-suscribe cuando cambiás de
  // playlist (porque el filtro de Supabase es por un único playlist_id).
  const subscribeTracks = (pid: string | null) => {
    const sb = supa(); if (!sb) return;
    if (tracksChannelRef.current) { tracksChannelRef.current.unsubscribe(); tracksChannelRef.current = null; }
    if (!pid) return;
    tracksChannelRef.current = sb.channel('console-tracks-' + pid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_track', filter: `playlist_id=eq.${pid}` }, async () => {
        await reloadActivePlaylist();
        await refreshQueue();
      })
      .subscribe();
  };

  // ¿Activaron otra playlist en el local? Comparamos la asignación activa contra
  // la que estamos tocando. Si es distinta, mostramos el aviso (NO cambiamos solos).
  const checkActiveChange = async () => {
    const sb = supa(); const venueId = venueRef.current; if (!sb || !venueId) return;
    const { data } = await sb.from('venue_playlist_assignment')
      .select('playlist_id').eq('venue_id', venueId).eq('is_active', true).maybeSingle();
    const newPid = (data as { playlist_id: string } | null)?.playlist_id ?? null;
    if (!newPid || newPid === activePlaylistRef.current) { setPending(null); return; }
    const { data: pl } = await sb.from('venue_playlist').select('name').eq('id', newPid).maybeSingle();
    setPending({ playlistId: newPid, name: (pl as { name: string } | null)?.name ?? 'Nueva playlist' });
  };

  // El operador acepta el cambio: cambiamos el pool. NO cortamos la canción en
  // curso — si algo suena, el cambio toma efecto en la próxima; si no, arranca ya.
  const switchToPending = async () => {
    if (!pending) return;
    activePlaylistRef.current = pending.playlistId;
    await reloadActivePlaylist();
    subscribeTracks(pending.playlistId);
    await refreshQueue();
    setPending(null);
    if (!playingRef.current && !busyRef.current && !pausedRef.current) advance();
  };

  const dismissPending = () => setPending(null);

  // ===== Motor JUKEBOX (decks, AutoDJ, votos). Se arranca y se destruye en caliente
  // para alternar con Karaoke sin recargar la página (así se conserva el gesto del
  // usuario y el audio puede seguir arrancando solo). =====
  const startJukeboxEngine = async () => {
    const sb = supa(); const venueId = venueRef.current; if (!sb || !venueId) return;
    currentRef.current = 'A'; // estado limpio de decks (importante al reiniciar tras karaoke)
    await reloadActivePlaylist();
    await refreshQueue();
    await refreshNow();
    const ch = sb.channel('console-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `venue_id=eq.${venueId}` }, async () => {
        await refreshQueue();
        if (!playingRef.current && !busyRef.current && !pausedRef.current) advance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `venue_id=eq.${venueId}` }, refreshNow);
    ch.subscribe();
    jbChannelRef.current = ch;
    // en vivo: si agregás/sacás canciones de la playlist activa, la consola se actualiza
    // sola (canal aparte porque se re-suscribe al cambiar de playlist).
    subscribeTracks(activePlaylistRef.current);

    // canal de comandos desde el celular (broadcast): saltear / pausa / segundos / AutoDJ
    const cmdCh = sb.channel('cmd-' + venueId);
    cmdCh.on('broadcast', { event: 'jbcmd' }, (p: any) => {
      const c = p.payload || {};
      if (c.cmd === 'skip') advance();
      else if (c.cmd === 'playpause') togglePlayPause();
      else if (c.cmd === 'seconds') { const n = Math.max(0, parseInt(c.value) || 0); setMaxSeconds(n); maxSecondsRef.current = n; broadcastJbState(); }
      else if (c.cmd === 'autodj') { const v = !!c.value; setAutoOn(v); autoOnRef.current = v; broadcastJbState(); }
      else if (c.cmd === 'hello') broadcastJbState();
    }).subscribe();
    cmdChRef.current = cmdCh;

    const onStateChange = (e: any) => {
      if (e.data === window.YT.PlayerState.PLAYING) { applyCC(e.target); }
      // Sincronizar la bandera de pausa con el reproductor real (evita que el botón
      // y los atajos queden desfasados si algo lo pausa por fuera).
      if (!busyRef.current && e.target === decksRef.current[currentRef.current]) {
        if (e.data === window.YT.PlayerState.PAUSED) { pausedRef.current = true; setIsPaused(true); broadcastJbState(); }
        else if (e.data === window.YT.PlayerState.PLAYING) { pausedRef.current = false; setIsPaused(false); broadcastJbState(); }
      }
      if (e.data === window.YT.PlayerState.ENDED && !busyRef.current && !pausedRef.current) {
        playingRef.current = false;
        advance();
      }
    };
    const onError = () => {
      if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
      const badId = nowTrackIdRef.current;
      if (badId) {
        const bad = tracksRef.current[badId];
        logError('console-reproduccion', new Error('Una canción no se pudo reproducir (jukebox)'), {
          trackId: badId, title: bad?.title, artist: bad?.artist, externalId: bad?.external_id,
        });
        deadRef.current.add(badId);
        const sb2 = supa(); const tk = tokenRef.current;
        if (sb2 && tk) { sb2.rpc('console_mark_unplayable', { p_token: tk, p_track: badId }).then(() => { refreshQueue(); }).catch(() => {}); }
      }
      try { decksRef.current[currentRef.current]?.setVolume(100); } catch {}
      const el = document.getElementById('wrap-' + currentRef.current); if (el) el.style.opacity = '1';
      busyRef.current = false;
      setTimeout(() => advance(), 600);
    };

    const YT = await loadYT();
    let ready = 0;
    const onReady = () => { ready++; if (ready === 2) advance(); };
    // controls:1 → el reproductor conserva sus controles nativos (mouse). disablekb:1
    // deja el teclado para nuestros atajos. Ambos conviven y el estado se sincroniza.
    const opts = (id: string) => ({
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 1, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, cc_load_policy: 0 },
      events: { onReady, onStateChange, onError },
    } as any);
    decksRef.current.A = new YT.Player('yt-A', opts('A'));
    decksRef.current.B = new YT.Player('yt-B', opts('B'));
    setTimeout(() => { try { stageRef.current?.focus(); } catch {} }, 600);

    // monitor: cuando la actual está por terminar, traer la siguiente fundida
    monitorRef.current = setInterval(() => {
      if (busyRef.current || !playingRef.current || pausedRef.current) return;
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

  // Destruye el motor jukebox (al pasar a Karaoke): para los reproductores, limpia
  // los intervalos y cierra los canales realtime. Es el opuesto de startJukeboxEngine.
  const teardownJukeboxEngine = () => {
    if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null; }
    if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
    if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; }
    try { decksRef.current.A?.destroy?.(); } catch {}
    try { decksRef.current.B?.destroy?.(); } catch {}
    decksRef.current = {};
    const sb = supa();
    if (sb && jbChannelRef.current) { try { sb.removeChannel(jbChannelRef.current); } catch {} jbChannelRef.current = null; }
    if (sb && cmdChRef.current) { try { sb.removeChannel(cmdChRef.current); } catch {} cmdChRef.current = null; }
    if (tracksChannelRef.current) { try { tracksChannelRef.current.unsubscribe(); } catch {} tracksChannelRef.current = null; }
    playingRef.current = false; pausedRef.current = false; busyRef.current = false;
    setIsPaused(false);
  };

  // Vigía persistente (corre en AMBOS modos). Si cambia la SECCIÓN activa del local
  // (jukebox ⇄ karaoke), alterna el motor sin recargar, con transición. Si solo
  // cambió la playlist dentro del mismo modo, conserva el comportamiento de siempre.
  const onModeWatch = async () => {
    const sb = supa(); const venueId = venueRef.current; if (!sb || !venueId) return;
    const { data } = await sb.from('venue_playlist_assignment')
      .select('playlist_id,section').eq('venue_id', venueId).eq('is_active', true).maybeSingle();
    const newPid = (data as { playlist_id: string } | null)?.playlist_id ?? null;
    const newSection: 'jukebox' | 'karaoke' = ((data as { section: string } | null)?.section === 'karaoke') ? 'karaoke' : 'jukebox';

    if (newSection !== currentSectionRef.current) {
      // ===== CAMBIO DE MODO → transición fluida, sin recargar =====
      currentSectionRef.current = newSection;
      activePlaylistRef.current = newPid;
      setActivePlaylistId(newPid);
      setPending(null);
      setSwitchingTo(newSection);
      setTimeout(() => setSwitchingTo(null), 1600);
      if (newSection === 'karaoke') {
        teardownJukeboxEngine();
        setKaraokeMode(true);
      } else {
        // karaoke → jukebox: el useEffect arranca el motor cuando los divs yt-A/yt-B
        // ya están en el DOM (después de re-renderizar a la vista jukebox).
        switchingToJukeboxRef.current = true;
        setKaraokeMode(false);
      }
      return;
    }

    // ===== Misma sección: cambio de playlist =====
    if (newSection === 'jukebox') {
      checkActiveChange(); // muestra el aviso "¿cambiar?" (no corta la canción en curso)
    } else if (newPid !== activePlaylistRef.current) {
      // karaoke: cambiar la prop hace que <KaraokeConsole/> se re-inicialice solo
      activePlaylistRef.current = newPid;
      setActivePlaylistId(newPid);
    }
  };

  const startConsole = async () => {
    const sb = supa(); const token = tokenRef.current; const venueId = venueRef.current;
    if (!sb || !token || !venueId) return;
    setStarted(true);

    // playlist activa del local (desde la ASIGNACIÓN) + sección (jukebox / karaoke)
    const { data: asg } = await sb.from('venue_playlist_assignment')
      .select('playlist_id,section').eq('venue_id', venueId).eq('is_active', true).maybeSingle();
    const pid = (asg as { playlist_id: string } | null)?.playlist_id ?? null;
    const section: 'jukebox' | 'karaoke' = ((asg as { section: string } | null)?.section === 'karaoke') ? 'karaoke' : 'jukebox';
    activePlaylistRef.current = pid;
    setActivePlaylistId(pid);
    currentSectionRef.current = section;

    await rotate();
    setInterval(rotate, 120000);

    // vigía persistente del modo (corre en jukebox Y en karaoke)
    sb.channel('console-mode-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_playlist_assignment', filter: `venue_id=eq.${venueId}` }, onModeWatch)
      .subscribe();

    // En modo KARAOKE la pantalla la maneja <KaraokeConsole/> (reproductor por turno).
    if (section === 'karaoke') { setKaraokeMode(true); return; }
    await startJukeboxEngine();
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
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
          <BrandMark size={150} />
          <div style={{ textAlign: 'center' }}>
            <h1 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 600 }}>Vinculá esta consola</h1>
            <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10 }}>Escribí este código en tu panel · sección “Vincular consola”</p>
          </div>
          {pairCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {pairCode.split('').map((d, i) => (
                  <div key={i} className="cv-wordmark" style={{ width: 60, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, background: 'var(--cv-bg-2)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: 'var(--cv-text)' }}>{d}</div>
                ))}
              </div>
              <button onClick={copyPairCode} className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 18px' }}>{copied ? '✓ Copiado' : '📋 Copiar código'}</button>
            </div>
          ) : (<p className="cv-mono" style={{ color: 'var(--cv-muted)' }}>generando código…</p>)}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button onClick={resetPairing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cv-font-body)', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline' }}>Generar un código nuevo</button>
            <a href="/panel" className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', textDecoration: 'none' }}>← Volver al panel</a>
          </div>
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
          <p style={{ maxWidth: 400, textAlign: 'center', fontSize: 12, color: 'var(--cv-mono)', lineHeight: 1.5 }}>
            Tocá el botón para desbloquear el audio. Con AutoDJ activo, la música arranca sola desde la playlist activa aunque todavía no haya votos. Para no mostrar avisos, logueá este navegador con tu cuenta de YouTube Premium.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button onClick={resetPairing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cv-font-body)', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline' }}>Vincular otra consola</button>
            <a href={status?.slug ? `/panel/venues/${status.slug}` : '/panel'} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', textDecoration: 'none' }}>← Volver al panel</a>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Consola en vivo ----------
  // Overlay de transición entre modos (se ve durante el cambio, sin recargar).
  const accent = switchingTo === 'karaoke' ? 'var(--cv-mint)' : 'var(--cv-cyan)';
  const switchOverlay = switchingTo ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: '#07060e' }}>
      <div style={{ fontSize: 66 }}>{switchingTo === 'karaoke' ? '🎤' : '🎵'}</div>
      <div className="cv-wordmark" style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 600, color: accent }}>
        {switchingTo === 'karaoke' ? 'Modo Karaoke' : 'Modo Rockola'}
      </div>
      <div className="cv-mono" style={{ fontSize: 13, letterSpacing: '.2em', color: 'var(--cv-muted)', textTransform: 'uppercase' }}>cambiando…</div>
      <div style={{ width: 64, height: 3, borderRadius: 2, background: accent, boxShadow: `0 0 18px ${accent}`, animation: 'cvBreathe 1.2s ease-in-out infinite' }} />
    </div>
  ) : null;

  if (karaokeMode) {
    return (
      <>
        <KaraokeConsole token={tokenRef.current || ''} venueId={venueRef.current || ''} slug={status?.slug || ''} roomCode={roomCode} playlistId={activePlaylistId} />
        {switchOverlay}
      </>
    );
  }

  const sk = getSkin(skin);
  const controlsOn = controlsVisible && !pending;

  return (
    <>
    {switchOverlay}
    <main
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: sk.bg, cursor: controlsVisible ? 'default' : 'none' }}
    >
      {/* ESCENARIO: el video lo más grande posible. Es el elemento que va a pantalla completa. */}
      <div
        ref={stageRef}
        tabIndex={-1}
        style={{
          position: 'absolute',
          ...(isFs
            ? { inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }
            : { inset: 'clamp(10px, 2.4vw, 28px)', borderRadius: 22, border: `1px solid ${sk.frameBorder}`, boxShadow: sk.frameGlow }),
          background: '#000', overflow: 'hidden', outline: 'none',
        }}
      >
        <div id="wrap-A" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1 }}><div id="yt-A" /></div>
        <div id="wrap-B" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }}><div id="yt-B" /></div>

        {/* velo para que el texto se lea sobre el video */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.42) 0%, transparent 16%, transparent 60%, rgba(0,0,0,.32) 80%, rgba(0,0,0,.62) 100%)' }} />

        {/* EN VIVO (arriba a la derecha, siempre) */}
        <div style={{ position: 'absolute', top: 18, right: 22, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,.4)', pointerEvents: 'none', transform: 'translateZ(0)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sk.liveColor, boxShadow: `0 0 10px ${sk.liveColor}`, animation: 'cvLive 1.4s ease-in-out infinite' }} />
          <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.18em', color: sk.liveColor, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>EN VIVO</span>
        </div>

        {/* BANDA INFERIOR tipo selector de rockola: código + onda + próximas (siempre visible) */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(40px, 7vh, 72px) clamp(20px, 3vw, 42px) clamp(16px, 2.4vh, 26px)', background: sk.panel, pointerEvents: 'none', transform: 'translateZ(0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 'clamp(8px, 1.6vh, 16px)' }}>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
              <span style={{ color: sk.textOnVideo, opacity: .65 }}>SONANDO AHORA</span>
              {isAutoNow && <span style={{ fontSize: 10, letterSpacing: '.14em', color: sk.accent2, border: `1px solid ${sk.accent2}`, borderRadius: 999, padding: '1px 8px', opacity: .9 }}>AUTODJ</span>}
              <span style={{ color: sk.accent, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {nowTitle}</span>
            </div>
            <div className="cv-mono" style={{ fontSize: 11, color: sk.textOnVideo, opacity: .5, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
              <span>suena en</span><BrandMark size={18} layout="row" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'clamp(20px, 4vw, 60px)' }}>
            <div style={{ minWidth: 0 }}>
              <div className="cv-mono" style={{ fontSize: 'clamp(10px, 1.3vw, 13px)', letterSpacing: '.24em', color: sk.labelColor, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>VOTÁ EN TU CELULAR · CÓDIGO</div>
              <div className="cv-wordmark" style={{ fontSize: 'clamp(56px, 11vw, 132px)', fontWeight: 700, lineHeight: .95, letterSpacing: '.04em', marginTop: 4, background: sk.codeGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', filter: `drop-shadow(${sk.codeGlow})` }}>{roomCode ?? '—'}</div>
              <div style={{ marginTop: 8, opacity: .92 }}><Waveform n={isFs ? 54 : 40} color={sk.waveColor} maxH={22} barW={3} gap={4} seed={7} /></div>
            </div>

            {queue.length > 0 && (
              <div style={{ flexShrink: 0, minWidth: 'clamp(170px, 22vw, 300px)', maxWidth: '42%' }}>
                <div className="cv-mono" style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', letterSpacing: '.2em', color: sk.textOnVideo, opacity: .55, marginBottom: 8, textAlign: 'right', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>PRÓXIMAS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {queue.slice(0, isFs ? 4 : 3).map((q) => {
                    const tr = tracksRef.current[q.track_id];
                    return (
                      <div key={q.track_id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
                        <span style={{ fontSize: 'clamp(12px, 1.3vw, 15px)', color: sk.textOnVideo, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: .92 }}>{tr?.title ?? '—'}</span>
                        <span className="cv-wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'clamp(12px, 1.3vw, 15px)', fontWeight: 600, color: sk.accent, flexShrink: 0 }}><span style={{ opacity: .8 }}>▲</span>{q.votes}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* aviso de cambio de lista DENTRO del escenario (se ve y se toca en pantalla completa) */}
        {pending && (
          <div style={{ position: 'absolute', top: 18, left: 22, maxWidth: 'min(560px, calc(100% - 44px))', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px', borderRadius: 16, border: `1px solid ${sk.panelBorder}`, background: 'rgba(7,6,14,.93)', boxShadow: '0 14px 44px -10px rgba(0,0,0,.75)', transform: 'translateZ(0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--cv-muted)', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>Activaron otra playlist</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>{pending.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={dismissPending}>Seguir</button>
              <button className="cv-btn cv-btn-cyan" style={{ fontSize: 12.5, padding: '8px 14px' }} onClick={switchToPending}>Cambiar</button>
            </div>
          </div>
        )}

      {/* CONTROLES dentro del escenario (para que se vean en pantalla completa) */}
      {/* zona-sensor arriba: mover el mouse acá revela los controles (el iframe se traga el mousemove) */}
      <div onMouseMove={pokeControls} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, zIndex: 2147483400 }} />

      {/* BARRA DE CONTROLES (se auto-esconde). Arriba a la izquierda, para no tapar el código de abajo. */}
      <div style={{ position: 'absolute', top: 18, left: 22, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 16, background: 'rgba(7,6,14,.82)', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: controlsOn ? 1 : 0, pointerEvents: controlsOn ? 'auto' : 'none', transform: `translateY(${controlsOn ? 0 : -8}px)`, transition: 'opacity .25s ease, transform .25s ease', zIndex: 2147483500 }}>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} onClick={togglePlayPause} title="Pausa/Reanudar (espacio)">{isPaused ? '▶' : '⏸'}</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => advance()} title="Saltear (→)">⏭</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} onClick={toggleFs} title="Pantalla completa (F)">⛶</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px', opacity: ccOn ? 1 : .55 }} onClick={toggleCC} title="Subtítulos (C)">CC</button>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)', margin: '0 2px' }} />
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => applySkin(skin === 'neon' ? 'retro' : 'neon')} title="Cambiar estilo">{skin === 'neon' ? '◐ Neón' : '◑ Retro'}</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => setShowSettings((v) => !v)} title="Ajustes">⚙</button>
      </div>

      {/* AJUSTES (popover) */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 72, left: 22, width: 320, maxWidth: 'calc(100% - 44px)', zIndex: 2147483550, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(10,10,18,.97)', boxShadow: '0 20px 60px -16px rgba(0,0,0,.8)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mono)' }}>AJUSTES</span>
            <button onClick={() => setShowSettings(false)} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>

          <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.14em', color: 'var(--cv-mono)', marginBottom: 8 }}>ESTILO DE LA ROCKOLA</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['neon', 'retro'] as SkinName[]).map((s) => (
              <button key={s} onClick={() => applySkin(s)} className="cv-mono" style={{ flex: 1, fontSize: 12.5, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: skin === s ? `1px solid ${getSkin(s).accent}` : '1px solid var(--cv-line)', background: skin === s ? 'rgba(255,255,255,.06)' : 'transparent', color: skin === s ? getSkin(s).accent : 'var(--cv-muted)' }}>{getSkin(s).label}</button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--cv-text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoOn} onChange={(e) => { setAutoOn(e.target.checked); autoOnRef.current = e.target.checked; }} style={{ width: 16, height: 16, accentColor: sk.accent }} />
            AutoDJ cuando no hay votos
          </label>
          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '12px 0' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--cv-muted)', flexWrap: 'wrap' }}>
            Segundos por canción (0 = completa):
            <input type="number" min={0} className="cv-input" style={{ width: 72, padding: '7px 10px' }} value={maxSeconds} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); setMaxSeconds(n); maxSecondsRef.current = n; }} />
          </label>
          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '12px 0' }} />
          <a href={status?.slug ? `/panel/venues/${status.slug}` : '/panel'} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', textDecoration: 'none' }}>← Volver al panel</a>
        </div>
      )}
      </div>
    </main>
    </>
  );
}
