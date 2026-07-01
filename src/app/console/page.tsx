'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import BrandMark from '@/components/BrandMark';
import { Ic } from '@/components/Ic';
import Waveform from '@/components/Waveform';
import KaraokeConsole from '@/components/KaraokeConsole';
import { applyCvTheme, CV_THEME_META, CV_LIGHT_THEMES } from '@/lib/theme';
import QRCode from 'qrcode';

// Aplica el tema ANTES del primer pintado en el cliente (evita el flash del default).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

const CROSSFADE_SECONDS = 4;
const STEP_MS = 100;

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(var(--cv-accent-rgb),.18), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(var(--cv-accent-rgb),.10), transparent 60%), var(--cv-bg)';

/** Vinilo de la consola: gira (anillo de color + brillo que barre se notan) con el
 *  nombre del local QUIETO en el centro, con la tipografía/gradiente de Carta Vibra.
 *  Es el co-brand integrado: el logo de CV reinterpretado por el nombre del local. */
function ConsoleVinyl({ size, label, fill, light }: { size?: number; label: string; fill?: boolean; light?: boolean }) {
  const words = (label || 'esperando votos').trim().split(/\s+/).slice(0, 3);
  const longest = Math.max(...words.map((w) => w.length), 1);
  const px = size ?? 140;
  // La letra va POR SOBRE el vinilo (capa superior). En modo fill escala con el
  // ancho del contenedor (cqw) para acompañar al QR; si no, en px según el tamaño.
  const labelFs = fill
    ? `${Math.min(11, Math.round(48 / (longest * 0.62)))}cqw`
    : `${Math.max(12, Math.min(Math.round(px * 0.2), Math.floor((px * 0.92) / (longest * 0.7))))}px`;
  const outer: React.CSSProperties = fill
    ? { position: 'relative', width: '100%', aspectRatio: '1 / 1', flexShrink: 0 }
    : { position: 'relative', width: px, height: px, flexShrink: 0 };
  // El disco BLANCO (surcos del color del tema) es SOLO para los temas CLAROS;
  // en los temas oscuros va el vinilo oscuro de siempre.
  if (light) {
    // MISMO vinilo que el oscuro: solo el disco negro pasa a BLANCO y los surcos a OSCUROS.
    // Todo lo demás (giro, anillo, brillo, pozo, tipografía con su gradiente) queda IGUAL.
    return (
      <div style={outer}>
        {/* disco BLANCO que gira — surcos oscuros */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', animation: 'cvSpin 7s linear infinite',
          background: 'repeating-radial-gradient(circle at center, rgba(0,0,0,.055) 0 1px, transparent 1px 5px), radial-gradient(circle, #ffffff, #f0ecf6 74%)',
          boxShadow: 'inset 0 0 34px rgba(0,0,0,.10), 0 0 70px -16px rgba(var(--cv-accent-rgb),.55), 0 0 0 1px rgba(0,0,0,.14)' }}>
          <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%',
            background: 'conic-gradient(from 210deg, rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.88), rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.88), rgba(var(--cv-accent-rgb),1))',
            filter: 'saturate(1.9) brightness(.8) drop-shadow(0 0 4px rgba(var(--cv-accent-rgb),.95)) drop-shadow(0 0 11px rgba(var(--cv-accent-rgb),.6))',
            WebkitMask: 'radial-gradient(circle, transparent 56%, #000 59%, #000 66%, transparent 69%)',
            mask: 'radial-gradient(circle, transparent 56%, #000 59%, #000 66%, transparent 69%)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'linear-gradient(118deg, transparent 30%, rgba(var(--cv-accent-rgb),.30) 46%, rgba(var(--cv-accent-rgb),.08) 53%, transparent 65%), linear-gradient(118deg, transparent 66%, rgba(var(--cv-accent-rgb),.14) 77%, transparent 86%)' }} />
        </div>
        {/* pozo central (agujero del vinilo) */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '4.5%', aspectRatio: '1 / 1', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#05040a', boxShadow: '0 0 0 2px rgba(0,0,0,.55)' }} />
        {/* TEXTO por SOBRE el vinilo — capa superior, grande, completa, NO gira */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.02em', pointerEvents: 'none' }}>
          {/* velo claro para que el texto se lea sobre los surcos (en el original es oscuro) */}
          <div style={{ position: 'absolute', inset: '11%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.9) 42%, rgba(255,255,255,.5) 63%, transparent 78%)' }} />
          {words.map((w, i) => (
            <span key={i} className="cv-wordmark cv-grad-theme" style={{ position: 'relative', fontSize: labelFs, fontWeight: 800, lineHeight: 1.05, textAlign: 'center', letterSpacing: '-.02em', whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,.75)' }}>{w}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={outer}>
      {/* disco OSCURO que gira (temas oscuros) */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', animation: 'cvSpin 7s linear infinite',
        background: 'repeating-radial-gradient(circle at center, rgba(255,255,255,.045) 0 1px, transparent 1px 5px), radial-gradient(circle, #19141f, #0b0a14 74%)',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,.85), 0 0 70px -16px rgba(var(--cv-accent-rgb),.55), 0 0 0 1px var(--cv-hair)' }}>
        <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%',
          background: 'conic-gradient(from 210deg, rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.45), rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.45), rgba(var(--cv-accent-rgb),1))',
          WebkitMask: 'radial-gradient(circle, transparent 56%, #000 59%, #000 66%, transparent 69%)',
          mask: 'radial-gradient(circle, transparent 56%, #000 59%, #000 66%, transparent 69%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(120deg, transparent 38%, rgba(255,255,255,.13) 50%, transparent 62%)' }} />
      </div>
      {/* pozo central (agujero del vinilo) */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '4.5%', aspectRatio: '1 / 1', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#05040a', boxShadow: '0 0 0 2px rgba(0,0,0,.55)' }} />
      {/* TEXTO por SOBRE el vinilo — capa superior, grande, completa, NO gira */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.02em', pointerEvents: 'none' }}>
        {/* velo oscuro para que el texto se lea sobre los surcos */}
        <div style={{ position: 'absolute', inset: '11%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,5,12,.72) 42%, rgba(6,5,12,.38) 63%, transparent 78%)' }} />
        {words.map((w, i) => (
          <span key={i} className="cv-wordmark cv-grad-theme" style={{ position: 'relative', fontSize: labelFs, fontWeight: 800, lineHeight: 1.05, textAlign: 'center', letterSpacing: '-.02em', whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,.75)' }}>{w}</span>
        ))}
      </div>
    </div>
  );
}

/** Termómetro de energía con dos modos:
 *  - 'eq': ecualizador animado. SOLO en pausa (no hay música, así que no miente sobre ir a su ritmo).
 *  - 'bar': barra de NIVEL honesta que se llena con el ritmo de votos. En sonando. Llena todo el alto. */
function EnergyMeter({ pct, rate, mode }: { pct: number; rate: number; mode: 'bar' | 'eq' }) {
  const word = pct > 66 ? 'caliente' : pct > 33 ? 'sube' : 'tranqui';
  const fillPct = Math.max(3, Math.min(100, pct));
  const card: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--cv-surf) 90%, transparent)',
    border: '1px solid color-mix(in srgb, var(--cv-accent) 26%, transparent)',
    borderRadius: 18, padding: 'clamp(16px,1.3vw,22px)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  };
  const title = (
    <div className="cv-mono" style={{ fontSize: 'clamp(8px,.7vw,11px)', letterSpacing: '.16em', color: 'color-mix(in srgb, var(--cv-accent) 70%, #ffffff)', textTransform: 'uppercase' }}>Energía de la sala</div>
  );
  const labelsRow = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '9px 0 13px' }}>
      <span className="cv-wordmark" style={{ fontSize: 'clamp(22px,2vw,34px)', fontWeight: 700, color: 'var(--cv-accent)', lineHeight: 1 }}>{rate}</span>
      <span style={{ fontSize: 'clamp(7px,.6vw,9px)', fontWeight: 700, letterSpacing: '.13em', color: 'color-mix(in srgb, var(--cv-ink) 55%, transparent)', textTransform: 'uppercase' }}>votos/min</span>
      <span style={{ marginLeft: 'auto', fontSize: 'clamp(8px,.7vw,11px)', fontWeight: 700, letterSpacing: '.12em', color: 'var(--cv-accent)', textTransform: 'uppercase' }}>{word}</span>
    </div>
  );

  if (mode === 'eq') {
    const profile = [0.5, 0.78, 1.0, 0.62, 0.88, 0.54, 0.96, 0.68, 0.82, 0.58];
    const amp = 0.6 + 0.4 * Math.min(1, pct / 100);
    return (
      <div style={card}>
        {title}
        {labelsRow}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'clamp(4px,.5vw,7px)', height: 'clamp(56px,8vh,92px)' }}>
          {profile.map((b, i) => (
            <div key={i} style={{
              flex: 1, height: Math.round((0.26 + 0.74 * b) * 100 * amp) + '%', minHeight: 8, borderRadius: 999,
              backgroundImage: 'var(--cv-theme-grad)', backgroundSize: '900% 100%', backgroundPosition: `${Math.round((i / (profile.length - 1)) * 100)}% 0`, backgroundRepeat: 'no-repeat',
              transformOrigin: 'bottom', animation: `cvEq ${(0.85 + (i % 4) * 0.24).toFixed(2)}s ease-in-out infinite`, animationDelay: `${(i * 0.08).toFixed(2)}s`,
              boxShadow: '0 0 12px rgba(var(--cv-accent-rgb),.45)', opacity: 0.95,
            }} />
          ))}
        </div>
      </div>
    );
  }

  // mode === 'bar': termómetro GORDO de nivel, con presencia, que llena la columna y se ve de lejos
  return (
    <div style={{ ...card, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {title}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '8px 0 16px' }}>
        <span className="cv-wordmark" style={{ fontSize: 'clamp(40px,4.6vw,80px)', fontWeight: 700, color: 'var(--cv-accent)', lineHeight: 0.85 }}>{rate}</span>
        <div>
          <div style={{ fontSize: 'clamp(8px,.64vw,11px)', fontWeight: 700, letterSpacing: '.13em', color: 'color-mix(in srgb, var(--cv-ink) 50%, transparent)', textTransform: 'uppercase' }}>votos/min</div>
          <div style={{ fontSize: 'clamp(11px,.85vw,15px)', fontWeight: 700, letterSpacing: '.1em', color: 'var(--cv-accent)', textTransform: 'uppercase', marginTop: 3 }}>{word}</div>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 18, background: 'color-mix(in srgb, var(--cv-ink) 8%, transparent)', border: '1px solid var(--cv-hair)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fillPct + '%', background: 'var(--cv-theme-grad)', boxShadow: '0 0 38px rgba(var(--cv-accent-rgb),.55)', transition: 'height 1.6s cubic-bezier(.4,0,.2,1)' }} />
        <span style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', fontSize: 'clamp(9px,.72vw,13px)', fontWeight: 700, letterSpacing: '.16em', color: 'color-mix(in srgb, var(--cv-ink) 50%, transparent)', textTransform: 'uppercase' }}>caliente</span>
        <span style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 'clamp(9px,.72vw,13px)', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(255,255,255,.78)', textShadow: '0 1px 6px rgba(0,0,0,.5)', textTransform: 'uppercase' }}>tranqui</span>
      </div>
    </div>
  );
}

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
  const [widgetQr, setWidgetQr] = useState('');
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [queue, setQueue] = useState<{ track_id: string; votes: number }[]>([]);
  const [nowTitle, setNowTitle] = useState('—');
  const [nowTrackId, setNowTrackId] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState<string>('');
  const [volume, setVolumeState] = useState(100);
  const volumeRef = useRef(100);
  // Arranca en TRUE: la consola entra directo a la sala de espera (stop). Así no se ve
  // la "finta" a play ni el fundido raro al cargar (el overlay ya está visible de una).
  const [stopped, setStopped] = useState(true);
  const historyRef = useRef<string[]>([]);
  const lastVoteAtRef = useRef(0);
  const [quietVinyl, setQuietVinyl] = useState(false);
  const [videoW, setVideoW] = useState(0);
  const [tracksTick, setTracksTick] = useState(0);
  const stoppedRef = useRef(true);
  const pendingRef = useRef<{ playlistId: string; name: string } | null>(null);
  const [ticker, setTicker] = useState<{ name: string | null; title: string } | null>(null);
  const [votantes, setVotantes] = useState<{ id: number; name: string | null; title: string; born: number }[]>([]);
  const votanteIdRef = useRef(0);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVotesRef = useRef<string[]>([]);
  const tickerSeededRef = useRef(false);
  // Termómetro de energía: on/off (lo elige el local en settings) + nivel por ritmo de votos.
  const [energyOn, setEnergyOn] = useState(true);
  const [energyPct, setEnergyPct] = useState(0);
  const [voteRate, setVoteRate] = useState(0);
  const voteTimesRef = useRef<number[]>([]);
  // Tema actual del local (pa el selector en consola y pa sincronizar con el control).
  const [curTheme, setCurTheme] = useState<string>('vibra');
  const themeRef = useRef<string>('vibra');
  const energyOnRef = useRef(true);
  const applyEnergy = (v: boolean) => { energyOnRef.current = v; setEnergyOn(v); };
  const [maxSeconds, setMaxSeconds] = useState(0);
  const [isAutoNow, setIsAutoNow] = useState(false);
  const [autoOn, setAutoOn] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [exitingFs, setExitingFs] = useState(false);
  const prevFsRef = useRef(false);
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [cycleOn, setCycleOn] = useState(false);   // modo auto-paleta (rota temas oscuros)
  const [cycleSecs, setCycleSecs] = useState(15);
  const cycleOnRef = useRef(false);
  const cycleSecsRef = useRef(15);
  // Reacciones en vivo que mandan los usuarios desde el widget (saltan bajo el panel de nav).
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number; y: number; size: number }[]>([]);
  const reactSeqRef = useRef(0);
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

  // Aplica el tema guardado del local ANTES del primer pintado (desde caché local), así
  // no parpadea el default mientras vuelve la consulta async. Al volver console_status se
  // confirma/actualiza y se re-cachea.
  useIsoLayoutEffect(() => {
    try {
      const t = localStorage.getItem('cv_console_theme');
      if (t) { applyCvTheme(t); themeRef.current = t; setCurTheme(t); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('console_device_token') : null;
    if (token) resumeSession(token);
    else startPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pantalla completa: refleja el estado real del navegador + fade al salir
  useEffect(() => {
    const onFs = () => {
      const nowFs = !!document.fullscreenElement;
      if (prevFsRef.current && !nowFs) { setExitingFs(true); setTimeout(() => setExitingFs(false), 900); }
      prevFsRef.current = nowFs;
      setIsFs(nowFs);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // QR escaneable que lleva al widget del local (votar desde el cel).
  useEffect(() => {
    const slug = status?.slug;
    if (!slug || typeof window === 'undefined') { setWidgetQr(''); return; }
    const url = `${window.location.origin}/widget/${slug}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0b0a12', light: '#ffffff' } })
      .then(setWidgetQr)
      .catch(() => setWidgetQr(''));
  }, [status?.slug]);

  // Ticker social EFÍMERO: detecta el voto nuevo y lo muestra unos segundos; después
  // desaparece (no cicla). Compara la lectura actual con la previa (diff de
  // multiconjunto) — robusto sin importar el orden que devuelva recent_votes.
  useEffect(() => {
    const slug = status?.slug;
    if (!slug) { setTicker(null); prevVotesRef.current = []; tickerSeededRef.current = false; return; }
    const sb = supa(); if (!sb) return;
    let alive = true;
    const pull = async () => {
      const { data } = await sb.rpc('recent_votes', { p_slug: slug, p_limit: 14 });
      if (!alive || !Array.isArray(data)) return;
      const rows = (data as { id: string; name: string | null; title: string }[])
        .filter((r) => tracksRef.current[r.id]);
      const sigs = rows.map((r) => `${r.name || ''}|${r.title}`);
      // primera lectura: solo fija la base, no muestra los votos viejos de golpe
      if (!tickerSeededRef.current) { prevVotesRef.current = sigs; tickerSeededRef.current = true; return; }
      const prevCount: Record<string, number> = {};
      prevVotesRef.current.forEach((x) => { prevCount[x] = (prevCount[x] || 0) + 1; });
      let newIdx = -1; let newCount = 0;
      const newRows: { id: string; name: string | null; title: string }[] = [];
      for (let i = 0; i < sigs.length; i++) {
        if ((prevCount[sigs[i]] || 0) > 0) prevCount[sigs[i]]--;
        else { if (newIdx < 0) newIdx = i; newCount++; newRows.push(rows[i]); }
      }
      prevVotesRef.current = sigs;
      if (newCount > 0) { const t = Date.now(); for (let k = 0; k < newCount; k++) voteTimesRef.current.push(t); lastVoteAtRef.current = t; }
      if (newIdx >= 0) {
        setTicker({ name: rows[newIdx].name || null, title: rows[newIdx].title });
        if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = setTimeout(() => setTicker(null), 6000);
        const born = Date.now();
        setVotantes((prev) => {
          const added = newRows.map((r) => ({ id: ++votanteIdRef.current, name: r.name || null, title: r.title, born }));
          return [...added.reverse(), ...prev].slice(0, 5);
        });
      }
    };
    pull();
    const id = setInterval(pull, 3500);
    return () => { alive = false; clearInterval(id); if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current); };
  }, [status?.slug]);

  // Energía de la sala = ritmo de votos en los últimos 3 min (no necesita SQL nueva).
  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const WIN = 180000; // 3 min
      voteTimesRef.current = voteTimesRef.current.filter((t) => now - t < WIN);
      const n = voteTimesRef.current.length;
      setVoteRate(Math.round((n / (WIN / 60000)) * 10) / 10);
      setEnergyPct(Math.min(100, Math.round((n / 12) * 100)));
      // sin votos por ~90s → aparece el vinilo del local (modo tranqui)
      setQuietVinyl(now - lastVoteAtRef.current > 90000);
    };
    calc();
    const id = setInterval(calc, 2500);
    return () => clearInterval(id);
  }, []);

  // Los votos quedan en la lista ~16s (duran más, en orden), después se van.
  useEffect(() => {
    const id = setInterval(() => {
      setVotantes((prev) => {
        const now = Date.now();
        const next = prev.filter((v) => now - v.born < 16000);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Mide el ancho REAL del video → las barras (medidor + controles) miden exactamente lo mismo.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (!document.fullscreenElement) setVideoW(el.clientWidth); });
    ro.observe(el);
    setVideoW(el.clientWidth);
    return () => ro.disconnect();
  }, []);


  // El termómetro vive en el local (settings.energy, default sí). Lo prende/apaga la consola o el control.
  useEffect(() => {
    const vid = (status as { venue_id?: string } | null)?.venue_id;
    if (!vid) return;
    const sb = supa(); if (!sb) return;
    (async () => {
      const { data } = await sb.from('venue').select('settings').eq('id', vid).single();
      const s = (data as { settings?: { energy?: boolean } } | null)?.settings;
      applyEnergy(s?.energy !== false);
    })();
  }, [status]);

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
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (stoppedRef.current) resumeFromStop(); else togglePlayPause(); }
      else if (k === 's') { e.preventDefault(); if (!stoppedRef.current) stop(); } // S = detener (pantalla de espera)
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
        applyCvTheme(data.theme);
        themeRef.current = data.theme || 'vibra'; setCurTheme(data.theme || 'vibra');
        try { localStorage.setItem('cv_console_theme', data.theme || 'vibra'); } catch {}
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
      if (data.paired) { venueRef.current = data.venue_id; applyCvTheme(data.theme); themeRef.current = data.theme || 'vibra'; setCurTheme(data.theme || 'vibra'); try { localStorage.setItem('cv_console_theme', data.theme || 'vibra'); } catch {} localStorage.removeItem('console_pairing_code'); }
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
    const tid = (data as any)?.track_id ?? null;
    const tr = tid ? tracksRef.current[tid] : null;
    setNowTrackId(tid);
    setNowTitle(tr ? `${tr.title}${tr.artist ? ' — ' + tr.artist : ''}` : '—');
  };

  // Nombre de la playlist activa (para el ranking de la izquierda).
  const refreshPlaylistName = async (pid: string | null) => {
    const sb = supa(); if (!sb || !pid) { setPlaylistName(''); return; }
    try {
      const { data } = await sb.from('venue_playlist').select('name').eq('id', pid).maybeSingle();
      setPlaylistName((data as { name?: string } | null)?.name || '');
    } catch { setPlaylistName(''); }
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
    let v = volumeRef.current;
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
      const target = volumeRef.current;
      try { p.setVolume(Math.min(target, v)); } catch {}
      if (v >= target) { if (fadeRampRef.current) { clearInterval(fadeRampRef.current); fadeRampRef.current = null; } }
    }, 60);
  };
  // Control de volumen manual (aplica al reproductor actual si está sonando).
  const changeVolume = (val: number) => {
    const nv = Math.max(0, Math.min(100, Math.round(val)));
    setVolumeState(nv); volumeRef.current = nv;
    if (!pausedRef.current) { try { decksRef.current[currentRef.current]?.setVolume(nv); } catch {} }
    broadcastJbState();
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
    try { cmdChRef.current?.send({ type: 'broadcast', event: 'jbstate', payload: { playing: !pausedRef.current, seconds: maxSecondsRef.current, autodj: autoOnRef.current, theme: themeRef.current, energy: energyOnRef.current, volume: volumeRef.current, stopped: stoppedRef.current, pendingName: pendingRef.current?.name ?? null, cycle: cycleOnRef.current, cyclesecs: cycleSecsRef.current } }); } catch {}
  };
  // Cuando aparece/desaparece el aviso de cambio de playlist, lo reflejamos al control.
  useEffect(() => { pendingRef.current = pending; broadcastJbState(); }, [pending]);

  // Cambiar la paleta desde la consola: aplica al toque, guarda en el local y avisa al control.
  const changeTheme = (t: string) => {
    applyCvTheme(t); themeRef.current = t; setCurTheme(t); broadcastJbState();
    try { localStorage.setItem('cv_console_theme', t); } catch {}
    const sb = supa(); const vid = venueRef.current;
    if (sb && vid) (async () => { try { await sb.rpc('set_venue_theme', { p_venue: vid, p_theme: t }); } catch {} })();
  };

  // Igual que changeTheme pero SIN persistir (el auto-paleta no ensucia la DB en cada salto).
  const applyThemeLive = (t: string) => { applyCvTheme(t); themeRef.current = t; setCurTheme(t); broadcastJbState(); };

  // Un usuario reaccionó desde el widget: aparece un emoji en posición aleatoria, hace pop y se va.
  const addReaction = (emoji: string) => {
    const id = ++reactSeqRef.current;
    const x = 3 + Math.random() * 90;                 // % horizontal
    const y = Math.random() * 60;                      // % vertical dentro del espacio
    const size = 26 + Math.round(Math.random() * 18);  // px
    setReactions((rs) => [...rs.slice(-28), { id, emoji, x, y, size }]);
    setTimeout(() => setReactions((rs) => rs.filter((r) => r.id !== id)), 1150);
  };

  // Modo auto-paleta: cada N segundos salta al siguiente tema OSCURO (nunca a los claros).
  // Cada salto se transmite al celular vía broadcastJbState → el control sigue el color.
  useEffect(() => {
    const wasOff = !cycleOnRef.current;
    cycleOnRef.current = cycleOn;
    cycleSecsRef.current = cycleSecs;
    broadcastJbState();  // refleja el estado (on/off + segundos) al celular
    if (!cycleOn) return;
    const darks: string[] = CV_THEME_META.filter((t) => !t.light).map((t) => t.id);
    if (darks.length < 2) return;
    const step = () => {
      const i = darks.indexOf(themeRef.current);
      applyThemeLive(darks[i < 0 ? 0 : (i + 1) % darks.length]);
    };
    if (wasOff) step(); // salto inmediato SOLO al prender (feedback al toque en PC y celular)
    const id = setInterval(step, Math.max(3, cycleSecs) * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleOn, cycleSecs]);

  // Prender/apagar el termómetro: guarda en el local y avisa al control.
  const toggleEnergy = (v: boolean) => {
    applyEnergy(v); broadcastJbState();
    const sb = supa(); const vid = venueRef.current;
    if (sb && vid) (async () => { try { await sb.rpc('set_venue_energy', { p_venue: vid, p_on: v }); } catch {} })();
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
      const target = volumeRef.current;
      try { to.setVolume(Math.round(f * target)); } catch {}
      try { if (from) from.setVolume(Math.round((1 - f) * target)); } catch {}
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
      if (nowTrackIdRef.current && nowTrackIdRef.current !== trackId) {
        historyRef.current.push(nowTrackIdRef.current);
        if (historyRef.current.length > 25) historyRef.current.shift();
      }
      nowTrackIdRef.current = trackId;
      await sb.rpc('console_set_now_playing', { p_token: token, p_track: trackId, p_position: 0 });
      setIsAutoNow(isAuto);
      await refreshNow();
      if (!track?.external_id) { busyRef.current = false; setTimeout(advance, 400); return; }
      pausedRef.current = false; setIsPaused(false); setStopped(false); stoppedRef.current = false;
      playingRef.current = true;
      transitionTo(track.external_id);
    } catch (e) { logError('console-advance', e); busyRef.current = false; }
  };

  // Retroceder: vuelve a la canción anterior (por si saltaste una sin querer).
  const goBack = async () => {
    if (busyRef.current) return;
    const prev = historyRef.current.pop();
    if (!prev) return;
    const track = tracksRef.current[prev];
    if (!track?.external_id) return;
    busyRef.current = true;
    try {
      const sb = supa(); const token = tokenRef.current;
      nowTrackIdRef.current = prev;
      if (sb && token) await sb.rpc('console_set_now_playing', { p_token: token, p_track: prev, p_position: 0 });
      setIsAutoNow(false);
      await refreshNow();
      pausedRef.current = false; setIsPaused(false); setStopped(false); stoppedRef.current = false;
      playingRef.current = true;
      transitionTo(track.external_id);
    } catch (e) { logError('console-goback', e); busyRef.current = false; }
  };

  // STOP: manda a la pantalla de espera (sin video). PAUSA (togglePlayPause) solo congela el video.
  const stop = () => { setStopped(true); stoppedRef.current = true; pauseWithFade(); broadcastJbState(); };
  const resumeFromStop = () => {
    // Si nunca cargamos nada (arranque en stop) o no hay deck sonando, "reanudar" = PRIMERA
    // reproducción: advance() trae la más votada / AutoDJ y saca el stop solo. Si ya venía
    // sonando (stop en medio de la sesión), reanudamos el deck pausado con fundido.
    if (!playingRef.current) { advance(); return; }
    setStopped(false); stoppedRef.current = false; resumeWithFade(); broadcastJbState();
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
    setTracksTick((t) => t + 1);
  };

  // Canal realtime SOLO de la playlist activa. Se re-suscribe cuando cambiás de
  // playlist (porque el filtro de Supabase es por un único playlist_id).
  const subscribeTracks = (pid: string | null) => {
    const sb = supa(); if (!sb) return;
    refreshPlaylistName(pid);
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
    const pend = pendingRef.current;
    if (!pend) return;
    activePlaylistRef.current = pend.playlistId;
    await reloadActivePlaylist();
    subscribeTracks(pend.playlistId);
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
    // ARRANCAMOS EN MODO STOP: la consola entra a la sala de espera (a votar), NO a un
    // video con play. El operador (o el celular) reanuda cuando quiere que suene música.
    setStopped(true); stoppedRef.current = true;
    await reloadActivePlaylist();
    await refreshQueue();
    await refreshNow();
    const ch = sb.channel('console-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `venue_id=eq.${venueId}` }, async () => {
        await refreshQueue();
        if (!playingRef.current && !busyRef.current && !pausedRef.current && !stoppedRef.current) advance();
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
      else if (c.cmd === 'back') goBack();
      else if (c.cmd === 'playpause') { if (stoppedRef.current) resumeFromStop(); else togglePlayPause(); }
      else if (c.cmd === 'stop') stop();
      else if (c.cmd === 'resume') resumeFromStop();
      else if (c.cmd === 'volume') { changeVolume(parseInt(c.value)); broadcastJbState(); }
      else if (c.cmd === 'cc') { toggleCC(); }
      else if (c.cmd === 'switchplaylist') switchToPending();
      else if (c.cmd === 'seconds') { const n = Math.max(0, parseInt(c.value) || 0); setMaxSeconds(n); maxSecondsRef.current = n; broadcastJbState(); }
      else if (c.cmd === 'autodj') { const v = !!c.value; setAutoOn(v); autoOnRef.current = v; broadcastJbState(); }
      else if (c.cmd === 'theme') { const t = String(c.value || 'vibra'); applyCvTheme(t); themeRef.current = t; setCurTheme(t); broadcastJbState(); }
      else if (c.cmd === 'energy') { applyEnergy(!!c.value); }
      else if (c.cmd === 'cyclepalette') { setCycleOn(!!c.value); }
      else if (c.cmd === 'cyclesecs') { setCycleSecs(Math.max(3, parseInt(c.value) || 15)); }
      else if (c.cmd === 'hello') broadcastJbState();
    }).on('broadcast', { event: 'reaction' }, (p: any) => { const e = p?.payload?.emoji; if (typeof e === 'string') addReaction(e); }).subscribe();
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
    const onReady = () => { ready++; if (ready === 2 && !stoppedRef.current) advance(); };
    // controls:0 → sin la barra nativa de YouTube (usamos la nuestra), proyección limpia. disablekb:1
    // deja el teclado para nuestros atajos. Ambos conviven y el estado se sincroniza.
    const opts = (id: string) => ({
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, cc_load_policy: 0, iv_load_policy: 3 },
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
          <BrandMark size={150} light={CV_LIGHT_THEMES.has(curTheme)} />
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
          <BrandMark size={150} light={CV_LIGHT_THEMES.has(curTheme)} />
          <div style={{ textAlign: 'center' }}>
            <h1 className="cv-wordmark" style={{ fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 600 }}>{status.name}</h1>
            <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10 }}>Consola lista para {status.slug}</p>
          </div>
          <button className="cv-btn cv-btn-mint" style={{ fontSize: 20, padding: '18px 40px', boxShadow: '0 0 50px -8px rgba(var(--cv-accent-rgb),.5)', display: 'inline-flex', alignItems: 'center', gap: 12 }} onClick={startConsole}>
            <Ic name="play" size={20} />Iniciar sesión musical
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: 'var(--cv-bg)' }}>
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

  // sk deriva del TEMA del local (variables CSS de globals.css), no de un skin fijo.
  // Así el tema elegido en Supabase pinta toda la consola.
  const sk = {
    gradClass: 'cv-grad-theme',
    cardBg: 'rgba(8,7,16,.42)',
    cardBorder: 'color-mix(in srgb, var(--cv-accent) 26%, transparent)',
    accent: 'var(--cv-accent)',
    accent2: 'var(--cv-accent)',
    liveColor: 'var(--cv-accent)',
    waveColor: 'var(--cv-accent)',
    labelColor: 'color-mix(in srgb, var(--cv-accent) 70%, #ffffff)',
    textOnVideo: '#ffffff',
    codeGlow: '0 2px 26px rgba(var(--cv-accent-rgb), .5)',
    frameBorder: 'color-mix(in srgb, var(--cv-accent) 22%, transparent)',
    frameGlow: '0 0 0 1px color-mix(in srgb, var(--cv-accent) 16%, transparent), 0 0 70px -16px rgba(var(--cv-accent-rgb), .5)',
  };
  const controlsOn = controlsVisible && !pending;
  // "clean" = video a pantalla completa: SOLO cuando el botón ⛶ activa el fullscreen real del navegador.
  const clean = isFs;
  // Las "luces": el color del TEMA se desvanece desde el centro hacia los bordes.
  const ambientBg = 'repeating-radial-gradient(circle at 50% 46%, rgba(150,150,170,.05) 0 1px, transparent 1px 13px), radial-gradient(80% 95% at 50% -8%, rgba(var(--cv-accent-rgb),.40), transparent 56%), radial-gradient(64% 82% at 50% 110%, rgba(var(--cv-accent-rgb),.34), transparent 56%), var(--cv-bg)';
  const tickerItem = ticker;
  // Pastilla de votante flotante (se usa a la izquierda y a la derecha, intercaladas).
  const votantePill = (v: { id: number; name: string | null; title: string }) => (
    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%', background: 'rgba(var(--cv-accent-rgb),.12)', border: '1px solid rgba(var(--cv-accent-rgb),.26)', borderRadius: 999, padding: '8px 13px', fontSize: 13.5, color: 'var(--cv-ink)', whiteSpace: 'nowrap', animation: 'cvVotante 16s ease forwards' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 8px var(--cv-accent)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name ? <><b style={{ color: 'var(--cv-accent)', fontWeight: 700 }}>{v.name}</b> votó {v.title}</> : <>alguien votó <b style={{ color: 'var(--cv-accent)', fontWeight: 700 }}>{v.title}</b></>}</span>
    </div>
  );
  // El video: a pantalla completa (clean) o achicado y centrado con su GLOW de color por tema.
  const videoBox: React.CSSProperties = clean
    ? { position: 'relative', width: '100%', height: '100%', borderRadius: 0, border: 'none', boxShadow: 'none', background: '#000', overflow: 'hidden', outline: 'none', containerType: 'size' }
    : { position: 'relative', width: '100%', maxHeight: '70vh', aspectRatio: '16 / 9', borderRadius: 10, border: '1px solid var(--cv-hair)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.5), 0 30px 70px -34px rgba(var(--cv-accent-rgb),.4)', background: '#000', overflow: 'hidden', outline: 'none', containerType: 'size', flexShrink: 0 };

  return (
    <>
    {switchOverlay}
    <main
      data-cv-console
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: clean ? '#000' : ambientBg, cursor: (clean && !controlsVisible) ? 'none' : 'default' }}
    >
      <style>{`
        @keyframes cvVotante{0%{opacity:0;transform:translateY(9px)}9%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-5px)}}
        @keyframes cvReact{0%{opacity:0;transform:scale(.2) translateY(6px)}22%{opacity:1;transform:scale(1.25) translateY(0)}52%{transform:scale(1) translateY(-4px)}100%{opacity:0;transform:scale(.85) translateY(-16px)}}
        @keyframes cvFsFade{from{opacity:1}to{opacity:0}}
        .cv-scroll{scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--cv-accent) 45%, transparent) transparent}
        .cv-scroll::-webkit-scrollbar{width:9px}
        .cv-scroll::-webkit-scrollbar-track{background:transparent}
        .cv-scroll::-webkit-scrollbar-thumb{background:color-mix(in srgb, var(--cv-accent) 42%, transparent);border-radius:999px;border:2px solid transparent;background-clip:padding-box}
        .cv-scroll::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb, var(--cv-accent) 65%, transparent);background-clip:padding-box}
      `}</style>

      {/* al SALIR de pantalla completa: velo negro a pantalla entera que se desvanece (misma transición suave) */}
      {exitingFs && <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2147483646, pointerEvents: 'none', animation: 'cvFsFade .85s ease-in-out forwards' }} />}

      {/* ESCENARIO: UN SOLO MARCO sólido que contiene TODO (medidor · video · código+QR+votantes) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: clean ? 0 : 'clamp(10px,2vh,22px) clamp(16px,2.6vw,38px)' }}>
        <div style={clean ? { width: '100%', height: '100%' } : {
          position: 'relative', width: '100%', maxWidth: 1720, borderRadius: 26, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          border: '1px solid color-mix(in srgb, var(--cv-accent) 22%, var(--cv-hair))',
          background: 'linear-gradient(rgba(255,255,255,.055), rgba(255,255,255,.055)), repeating-radial-gradient(circle at 50% 20%, rgba(185,185,210,.05) 0 1px, transparent 1px 15px), radial-gradient(160% 150% at 50% -14%, color-mix(in srgb, var(--cv-accent) 20%, var(--cv-surf)), var(--cv-surf))',
          boxShadow: '0 50px 130px -44px #000, inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 0 1px rgba(var(--cv-accent-rgb),.12)',
          padding: 'clamp(16px,1.8vw,30px)',
        }}>

          {/* barra de identidad DENTRO del marco */}
          {!clean && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'clamp(16px,1.8vw,26px)', position: 'relative', zIndex: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 10px var(--cv-accent)' }} />
              <span className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(16px,1.5vw,23px)', fontWeight: 700, letterSpacing: '-.01em', paddingBottom: '.04em' }}>{status?.name || 'Tu local'}</span>
              <span className="cv-mono" style={{ fontSize: 'clamp(8px,.7vw,11px)', letterSpacing: '.04em', color: 'var(--cv-faint)', marginLeft: 2 }}>sonando con <span className="cv-wordmark" style={{ fontWeight: 700, color: CV_LIGHT_THEMES.has(curTheme) ? 'var(--cv-ink)' : '#ffffff' }}>carta <span className="cv-grad-theme">vibra</span></span></span>
            </div>
          )}

          {/* GRILLA: playlist | video+medidor+controles | código+QR+votos */}
          <div style={clean
            ? { width: '100%', height: '100%' }
            : { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(156px,182px) minmax(0,1fr) minmax(244px,300px)', gap: 'clamp(14px,1.7vw,28px)', alignItems: 'stretch', position: 'relative', zIndex: 2 }}>

          {/* IZQUIERDA: votos en vivo / vinilo (arriba) → código → QR (abajo, mismo ancho) */}
          {!clean && (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--cv-hair)', paddingRight: 'clamp(11px,1.1vw,16px)', gap: 'clamp(12px,1.6vh,20px)', containerType: 'inline-size' }}>
              {/* zona votos → vinilo "esperando votos": crossfade suave en ambos sentidos */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {/* capa VINILO (aparece con suavidad cuando se deja de votar) */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', opacity: votantes.length === 0 ? 1 : 0, transform: votantes.length === 0 ? 'scale(1)' : 'scale(.93)', transition: 'opacity .6s ease, transform .6s ease', pointerEvents: votantes.length === 0 ? 'auto' : 'none' }}>
                  <ConsoleVinyl fill label="esperando votos" light={CV_LIGHT_THEMES.has(curTheme)} />
                </div>
                {/* capa VOTOS (aparece con suavidad cuando llega el primer voto) */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: votantes.length === 0 ? 0 : 1, transform: votantes.length === 0 ? 'translateY(10px)' : 'translateY(0)', transition: 'opacity .5s ease, transform .5s ease', pointerEvents: votantes.length === 0 ? 'none' : 'auto' }}>
                  <div className="cv-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'var(--cv-faint)', textTransform: 'uppercase', marginBottom: 10, flexShrink: 0 }}>Votando ahora</div>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start', overflow: 'hidden' }}>
                    {votantes.map(votantePill)}
                  </div>
                </div>
              </div>
              {/* CÓDIGO + QR (abajo, mismo borde izquierdo y mismo ancho de la franja) */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ height: 1, background: 'var(--cv-hair)', marginBottom: 'clamp(13px,1.7vh,20px)' }} />
                <div>
                  <div className="cv-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'var(--cv-faint)', textTransform: 'uppercase', marginBottom: 4 }}>Código de sala</div>
                  <div className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(42px,3.6vw,58px)', fontWeight: 700, lineHeight: 0.95, letterSpacing: '-.01em', textShadow: sk.codeGlow, paddingBottom: '.04em' }}>{roomCode ?? '—'}</div>
                </div>
                {widgetQr && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 6, background: '#fff', padding: 3, lineHeight: 0, overflow: 'hidden' }}>
                      <img src={widgetQr} alt="QR para votar" style={{ width: '100%', height: '100%', display: 'block' }} />
                    </div>
                    <div style={{ width: '100%', marginTop: 9 }}>
                      <div className="cv-mono" style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--cv-mut)', textTransform: 'uppercase', lineHeight: 1.5 }}>Votá la próxima</div>
                      <div className="cv-mono" style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--cv-mut)', textTransform: 'uppercase', lineHeight: 1.5 }}>desde tu celular</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CENTRO: video (ancho completo, arriba) + medidor + panel; abajo queda espacio para desplegar ajustes */}
          <div style={clean ? { width: '100%', height: '100%' } : { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 'clamp(9px,1.3vh,17px)', minHeight: 0, position: 'relative' }}>

          {/* el video va arriba, a todo el ancho de la columna */}
          <div style={clean ? { width: '100%', height: '100%' } : { width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {/* PANTALLA: el video */}
          <div ref={stageRef} tabIndex={-1} style={videoBox}>
          {/* pointerEvents:none → YouTube no muestra su nombre/compartir/más-videos al pasar el mouse */}
          <div id="wrap-A" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1, pointerEvents: 'none' }}><div id="yt-A" /></div>
          <div id="wrap-B" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}><div id="yt-B" /></div>

          {/* al entrar a pantalla completa: velo negro que se desvanece (transición suave, no abrupta) */}
          {clean && <div style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 2147483600, pointerEvents: 'none', animation: 'cvFsFade .85s ease-in-out forwards' }} />}

          {/* viñeta sutil para legibilidad */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(125% 125% at 50% 50%, transparent 56%, rgba(0,0,0,.42) 100%)' }} />


          {/* ARRIBA-IZQUIERDA: sonando ahora */}
          <div style={{ position: 'absolute', top: '3.5cqh', left: '2.6cqw', maxWidth: '42%', padding: '.9cqh 1.4cqw', borderRadius: 10, background: 'rgba(8,7,16,.82)', border: `1px solid ${sk.cardBorder}`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 6px 20px -8px rgba(0,0,0,.7)', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sk.liveColor, boxShadow: `0 0 8px ${sk.liveColor}`, animation: 'cvLive 1.4s ease-in-out infinite', flexShrink: 0 }} />
              <span className="cv-mono" style={{ fontSize: 'clamp(8px,1.2cqw,13px)', letterSpacing: '.16em', color: sk.labelColor }}>SONANDO AHORA</span>
              {isAutoNow && <span style={{ fontSize: 'clamp(6px,.9cqw,10px)', letterSpacing: '.1em', color: 'color-mix(in srgb, var(--cv-accent) 65%, transparent)', border: '1px solid color-mix(in srgb, var(--cv-accent) 38%, transparent)', borderRadius: 999, padding: '1px 6px', opacity: .85 }}>AUTODJ</span>}
            </div>
            <div className="cv-wordmark" style={{ fontSize: 'clamp(13px,2.2cqw,26px)', fontWeight: 700, color: sk.textOnVideo, lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nowTitle}</div>
          </div>

          {/* ABAJO-CENTRO: ticker social (solo en pantalla completa; en vista normal va al costado) */}
          {clean && tickerItem && (
            <div style={{ position: 'absolute', bottom: '3.6cqh', left: '50%', transform: 'translateX(-50%)', maxWidth: '36%', display: 'flex', alignItems: 'center', gap: '.7cqw', padding: '.7cqh 1.3cqw', borderRadius: 999, background: sk.cardBg, border: `1px solid ${sk.cardBorder}`, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sk.accent, boxShadow: `0 0 8px ${sk.accent}`, flexShrink: 0 }} />
              <span key={(ticker?.name || '') + (ticker?.title || '')} className="cv-mono" style={{ fontSize: 'clamp(9px,1.25cqw,15px)', color: sk.textOnVideo, textShadow: '0 1px 6px rgba(0,0,0,.9)', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'cvFadeIn .55s ease' }}>
                {tickerItem.name
                  ? <><b style={{ color: sk.accent, fontWeight: 700 }}>{tickerItem.name}</b> votó {tickerItem.title}</>
                  : <>alguien votó <b style={{ fontWeight: 600 }}>{tickerItem.title}</b></>}
              </span>
            </div>
          )}

          {/* ABAJO-DERECHA: invitación — QR + código (solo en pantalla completa; en vista normal va al costado) */}
          {clean && (
          <div style={{ position: 'absolute', bottom: '3.5cqh', right: '2.6cqw', display: 'flex', alignItems: 'center', gap: '1cqw', padding: '.9cqh 1.4cqw', borderRadius: 12, background: sk.cardBg, border: `1px solid ${sk.cardBorder}`, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', pointerEvents: 'none' }}>
            {widgetQr && (
              <div style={{ background: '#fff', padding: '.55cqh', borderRadius: 8, lineHeight: 0, flexShrink: 0 }}>
                <img src={widgetQr} alt="QR para votar" style={{ width: 'clamp(38px,5.6cqw,72px)', height: 'clamp(38px,5.6cqw,72px)', display: 'block' }} />
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div className="cv-mono" style={{ fontSize: 'clamp(8px,1.1cqw,12px)', letterSpacing: '.2em', color: sk.labelColor, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>VOTÁ EN TU CELULAR</div>
              <div className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(22px,5.4cqw,60px)', fontWeight: 700, lineHeight: 1, letterSpacing: '.04em', marginTop: 1, textShadow: sk.codeGlow }}>{roomCode ?? '—'}</div>
              <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end', opacity: .85 }}><Waveform n={18} color={sk.waveColor} maxH={12} barW={2.5} gap={3} seed={7} /></div>
            </div>
          </div>
          )}

          {/* ABAJO-IZQUIERDA: marca chiquita (sin "sonando con") */}
          <div style={{ position: 'absolute', bottom: '3.5cqh', left: '2.6cqw', display: 'flex', alignItems: 'center', gap: 5, opacity: .5, pointerEvents: 'none' }}>
            <BrandMark size={16} layout="row" light={CV_LIGHT_THEMES.has(curTheme)} />
          </div>

          {/* aviso de cambio de lista (dentro de la pantalla, se ve en fullscreen) */}
          {pending && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(94%, 520px)', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 13, border: `1px solid ${sk.cardBorder}`, background: 'rgba(7,6,14,.95)', boxShadow: '0 14px 44px -10px rgba(0,0,0,.75)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ flexShrink: 0, color: sk.accent, display: 'inline-flex' }}><Ic name="refresh" size={17} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Activaron otra playlist</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px', color: '#fff' }} onClick={dismissPending}>Seguir</button>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px', color: sk.accent }} onClick={switchToPending}>Cambiar</button>
              </div>
            </div>
          )}

          {/* zona-sensor + barra flotante: SOLO en pantalla completa (en modo normal los controles van fijos a la derecha) */}
          {clean && (
            <>
              <div onMouseMove={pokeControls} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '22%', zIndex: 2147483400 }} />
              <div style={{ position: 'absolute', top: 10, left: '50%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 13, background: 'rgba(7,6,14,.85)', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: controlsOn ? 1 : 0, pointerEvents: controlsOn ? 'auto' : 'none', transform: `translateX(-50%) translateY(${controlsOn ? 0 : -8}px)`, transition: 'opacity .25s ease, transform .25s ease', zIndex: 2147483500 }}>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={togglePlayPause} title="Pausa/Reanudar (espacio)">{isPaused ? <Ic name="play" size={15} /> : <Ic name="pause" size={15} />}</button>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => advance()} title="Saltear (→)"><Ic name="next" size={15} /></button>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={toggleFs} title="Salir de pantalla completa (F)"><Ic name="fullscreen" size={15} /></button>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', opacity: ccOn ? 1 : .55, color: '#fff' }} onClick={toggleCC} title="Subtítulos (C)">CC</button>
              </div>
            </>
          )}

          {/* (en modo normal: el panel de navegación va abajo, en esta columna central) */}
        </div>{/* fin video */}
          </div>{/* fin wrapper video (alto sobrante) */}

          {/* MEDIDOR DE VOTOS — protagonista, ancho completo */}
          {!clean && energyOn && (
            <div style={{ width: '100%', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.13em', color: 'var(--cv-faint)', textTransform: 'uppercase' }}>tranqui</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(23px,2.1vw,32px)', fontWeight: 700, lineHeight: 1, paddingBottom: '.05em' }}>{voteRate}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--cv-mut)', textTransform: 'uppercase' }}>votos/min</span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.13em', color: 'var(--cv-mut)', textTransform: 'uppercase' }}>caliente</span>
              </div>
              <div style={{ height: 22, borderRadius: 999, background: 'var(--cv-surf)', border: '1px solid var(--cv-hair)', overflow: 'hidden', boxShadow: 'inset 0 2px 7px rgba(0,0,0,.45)' }}>
                <div style={{ height: '100%', width: Math.max(3, Math.min(100, energyPct)) + '%', background: 'var(--cv-theme-grad)', boxShadow: '0 0 22px rgba(var(--cv-accent-rgb),.65)', borderRadius: 999, transition: 'width 1.7s cubic-bezier(.4,0,.2,1)' }} />
              </div>
            </div>
          )}

          {/* PANEL DE NAVEGACIÓN — ancho completo. Los AJUSTES se despliegan HACIA ABAJO, a lo ancho (en el espacio libre). */}
          {!clean && (
            <div style={{ width: '100%', flexShrink: 0, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 14px', borderRadius: 14, background: 'var(--cv-bg)', border: '1px solid var(--cv-hair)', boxShadow: '0 10px 30px -16px #000' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '7px 11px', color: 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={goBack} title="Anterior (deshacer salto)"><Ic name="prev" size={16} /></button>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '7px 12px', color: 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={togglePlayPause} title="Pausa (congela el video)">{isPaused && !stopped ? <Ic name="play" size={16} /> : <Ic name="pause" size={16} />}</button>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '7px 11px', color: 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={stop} title="Detener (pantalla de espera)"><Ic name="stop" size={15} /></button>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '7px 11px', color: 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => advance()} title="Saltar (→)"><Ic name="next" size={16} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '7px 11px', color: 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={toggleFs} title="Pantalla completa (F)"><Ic name="fullscreen" size={16} /></button>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '7px 11px', color: 'var(--cv-ink)', opacity: ccOn ? 1 : .5 }} onClick={toggleCC} title="Subtítulos (C)">CC</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title="Volumen">
                    <span style={{ color: 'var(--cv-mut)', width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic name={volume === 0 ? 'mute' : 'volume'} size={17} /></span>
                    <input type="range" min={0} max={100} value={volume} onChange={(e) => changeVolume(parseInt(e.target.value))} style={{ width: 'clamp(80px,8vw,130px)', accentColor: 'var(--cv-accent)', cursor: 'pointer' }} />
                  </div>
                  <button className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '7px 11px', color: showSettings ? 'var(--cv-accent)' : 'var(--cv-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSettings((v) => !v)} title="Ajustes"><Ic name="gear" size={16} /></button>
                </div>
              </div>
              {showSettings && (
                <div className="cv-scroll" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, maxHeight: 'clamp(108px,20vh,220px)', overflowY: 'auto', zIndex: 40, borderRadius: 14, border: '1px solid var(--cv-hair)', background: 'var(--cv-surf)', boxShadow: '0 26px 66px -18px #000', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--cv-ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={autoOn} onChange={(e) => { setAutoOn(e.target.checked); autoOnRef.current = e.target.checked; }} style={{ width: 16, height: 16, accentColor: sk.accent }} />
                    AutoDJ sin votos
                  </label>
                  <div style={{ width: 1, height: 24, background: 'var(--cv-hair)' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--cv-ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={energyOn} onChange={(e) => toggleEnergy(e.target.checked)} style={{ width: 16, height: 16, accentColor: sk.accent }} />
                    Medidor de votos
                  </label>
                  <div style={{ width: 1, height: 24, background: 'var(--cv-hair)' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--cv-mut)', whiteSpace: 'nowrap' }}>
                    Segundos/canción
                    <input type="number" min={0} className="cv-input" style={{ width: 62, padding: '5px 8px' }} value={maxSeconds} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); setMaxSeconds(n); maxSecondsRef.current = n; }} />
                  </label>
                  <div style={{ width: 1, height: 24, background: 'var(--cv-hair)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--cv-ink)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cycleOn} onChange={(e) => setCycleOn(e.target.checked)} style={{ width: 16, height: 16, accentColor: sk.accent }} />
                      Auto-paleta
                    </label>
                    <input type="number" min={3} className="cv-input" style={{ width: 52, padding: '5px 7px' }} value={cycleSecs} onChange={(e) => setCycleSecs(Math.max(3, parseInt(e.target.value) || 15))} title="Segundos entre paletas" />
                    <span className="cv-mono" style={{ fontSize: 10, color: 'var(--cv-mut)' }}>seg</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: 'var(--cv-hair)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '1 1 auto', minWidth: 210 }}>
                    <span className="cv-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cv-mut)', textTransform: 'uppercase', flexShrink: 0 }}>Paleta</span>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {CV_THEME_META.map((t) => (
                        <button key={t.id} onClick={() => changeTheme(t.id)} title={t.name} style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: t.grad, border: curTheme === t.id ? '2px solid var(--cv-ink)' : '2px solid var(--cv-hair)', boxShadow: curTheme === t.id ? '0 0 8px rgba(var(--cv-accent-rgb),.4)' : 'none', flexShrink: 0 }} />
                      ))}
                    </div>
                  </div>
                  <a href={status?.slug ? `/panel/venues/${status.slug}` : '/panel'} className="cv-mono" style={{ fontSize: 11.5, color: 'var(--cv-mut)', textDecoration: 'none', whiteSpace: 'nowrap' }}>← Panel</a>
                  <button onClick={() => setShowSettings(false)} className="cv-mono" style={{ fontSize: 14, color: 'var(--cv-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              )}
              {!showSettings && reactions.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, height: 'clamp(64px,13vh,140px)', pointerEvents: 'none', overflow: 'visible', zIndex: 35 }}>
                  {reactions.map((r) => (
                    <span key={r.id} style={{ position: 'absolute', left: `${r.x}%`, top: `${r.y}%`, fontSize: r.size, lineHeight: 1, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))', animation: 'cvReact 1.1s ease-out forwards', willChange: 'transform, opacity' }}>{r.emoji}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>{/* fin columna central */}

          {/* DERECHA: PLAYLIST completa — nombre real + votados arriba (con conteo) + el resto, con scroll acotado */}
          {!clean && (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: '1px solid var(--cv-hair)', paddingLeft: 'clamp(14px,1.6vw,26px)' }}>
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <div className="cv-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'var(--cv-faint)', textTransform: 'uppercase', marginBottom: 3 }}>♫ Sonando la playlist</div>
                <div className="cv-wordmark" style={{ fontSize: 'clamp(16px,1.5vw,22px)', fontWeight: 700, color: 'var(--cv-ink)', lineHeight: 1.15, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlistName || 'Mi playlist'}</div>
              </div>
              <div className="cv-scroll" data-tt={tracksTick} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 5, maskImage: 'linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 16px), transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 16px), transparent 100%)' }}>
                {(() => {
                  const shown = new Set<string>();
                  if (nowTrackId) shown.add(nowTrackId);
                  queue.forEach((q) => shown.add(q.track_id));
                  const now = nowTrackId ? tracksRef.current[nowTrackId] : null;
                  const rest = Object.values(tracksRef.current).filter((t) => !shown.has(t.id));
                  const empty = !now && queue.length === 0 && rest.length === 0;
                  return (
                    <>
                      {now && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 11, background: 'rgba(var(--cv-accent-rgb),.14)', border: '1px solid rgba(var(--cv-accent-rgb),.32)', flexShrink: 0 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 9px var(--cv-accent)', flexShrink: 0, animation: 'cvLive 1.4s ease-in-out infinite' }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--cv-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{now.title}</span>
                          <span className="cv-mono" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--cv-accent)', flexShrink: 0 }}>SONANDO</span>
                        </div>
                      )}
                      {queue.map((q, i) => {
                        const tr = tracksRef.current[q.track_id];
                        if (!tr) return null;
                        return (
                          <div key={q.track_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 9, flexShrink: 0 }}>
                            <span className="cv-wordmark" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cv-accent)', width: 17, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cv-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.title}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--cv-accent)' }}>
                              <span style={{ fontSize: 9 }}>▲</span>{q.votes}
                            </span>
                          </div>
                        );
                      })}
                      {rest.length > 0 && (queue.length > 0 || now) && (
                        <div className="cv-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cv-faint)', textTransform: 'uppercase', margin: '8px 0 2px 11px', flexShrink: 0 }}>Resto de la playlist</div>
                      )}
                      {rest.map((tr) => (
                        <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 11px', borderRadius: 9, flexShrink: 0 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cv-hair)', flexShrink: 0, marginLeft: 6 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--cv-mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.title}</span>
                        </div>
                      ))}
                      {empty && (
                        <div style={{ fontSize: 12.5, color: 'var(--cv-faint)', padding: '8px 11px', lineHeight: 1.5 }}>Cargando la playlist…</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          </div>{/* grilla dentro del marco */}
        </div>{/* MARCO */}
      </div>{/* escenario */}

        {/* PANTALLA DE ESPERA (STOP) — Opción A (lados cambiados): a la IZQUIERDA el ingreso
            (código + QR, como en la pantalla en vivo), a la DERECHA el vinilo grande que llena
            el alto. Medidor reinventado: barra de energía delgada full-width abajo (no tarjeta).
            Todo en UNA tarjeta grande. La consola arranca acá; la pausa (⏸) solo congela. */}
        <div onClick={stopped ? resumeFromStop : undefined} style={{ position: 'absolute', inset: 0, zIndex: 2147483300, cursor: stopped ? 'pointer' : 'default',
            opacity: stopped ? 1 : 0, pointerEvents: stopped ? 'auto' : 'none', transition: 'opacity .54s ease',
            background: ambientBg,
            display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 'clamp(10px,2vh,22px) clamp(16px,2.6vw,38px)' }}>

          {/* TARJETA GRANDE contenedora */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 1720, borderRadius: 26, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            border: '1px solid color-mix(in srgb, var(--cv-accent) 22%, var(--cv-hair))',
            background: 'linear-gradient(rgba(255,255,255,.055), rgba(255,255,255,.055)), repeating-radial-gradient(circle at 50% 20%, rgba(185,185,210,.05) 0 1px, transparent 1px 15px), radial-gradient(160% 150% at 50% -14%, color-mix(in srgb, var(--cv-accent) 20%, var(--cv-surf)), var(--cv-surf))',
            boxShadow: '0 50px 130px -44px #000, inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 0 1px rgba(var(--cv-accent-rgb),.12)',
            padding: 'clamp(20px,2.6vw,42px) clamp(22px,3.2vw,56px)',
          }}>

            {/* nombre del local (arriba, centro) */}
            <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, marginBottom: 'clamp(8px,1.4vh,16px)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: 'rgba(8,7,16,.42)', border: '1px solid color-mix(in srgb, var(--cv-accent) 26%, transparent)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 10px var(--cv-accent)' }} />
                <span className="cv-mono" style={{ fontSize: 'clamp(9px,.9vw,12px)', letterSpacing: '.18em', color: 'color-mix(in srgb, var(--cv-accent) 78%, #ffffff)' }}>{status?.name || 'CARTA VIBRA'}</span>
              </div>
            </div>

            {/* CUERPO: IZQUIERDA ingreso (código + QR) · DERECHA vinilo grande */}
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(360px,440px) minmax(0,1fr)', gap: 'clamp(24px,3vw,56px)', alignItems: 'stretch' }}>

              {/* IZQUIERDA: ingreso — código de sala + QR, repartidos para llenar el alto */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', borderRight: '1px solid var(--cv-hair)', paddingRight: 'clamp(24px,3vw,56px)', minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="cv-mono" style={{ fontSize: 'clamp(10px,1vw,14px)', letterSpacing: '.24em', color: sk.labelColor, marginBottom: 'clamp(6px,.9vh,12px)' }}>CÓDIGO DE SALA</div>
                  <div className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(78px,11vw,150px)', fontWeight: 700, lineHeight: .9, letterSpacing: '.01em', textShadow: sk.codeGlow, paddingBottom: '.04em' }}>{roomCode ?? '—'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(11px,1.5vh,18px)' }}>
                  <div className="cv-mono" style={{ fontSize: 'clamp(9px,.8vw,12px)', letterSpacing: '.2em', color: 'var(--cv-faint)', display: 'flex', alignItems: 'center', gap: 12, width: 'clamp(200px,16vw,270px)', justifyContent: 'center' }}>
                    <span style={{ height: 1, flex: 1, background: 'var(--cv-hair)' }} />O ESCANEÁ<span style={{ height: 1, flex: 1, background: 'var(--cv-hair)' }} />
                  </div>
                  {widgetQr
                    ? <div style={{ background: '#fff', padding: 'clamp(7px,.7vw,11px)', borderRadius: 14, lineHeight: 0, boxShadow: '0 0 44px -14px rgba(var(--cv-accent-rgb),.6)' }}><img src={widgetQr} alt="QR para votar" style={{ width: 'clamp(116px,11.5vw,156px)', height: 'clamp(116px,11.5vw,156px)', display: 'block' }} /></div>
                    : <div style={{ width: 'clamp(116px,11.5vw,156px)', height: 'clamp(116px,11.5vw,156px)', borderRadius: 14, border: '1px dashed var(--cv-hair)' }} />}
                  <span className="cv-wordmark" style={{ fontSize: 'clamp(16px,1.6vw,24px)', fontWeight: 700, color: '#ffffff' }}>votá desde tu celular</span>
                </div>
              </div>

              {/* DERECHA: vinilo "esperando votos" — llena el alto */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, paddingLeft: 'clamp(18px,2.4vw,48px)' }}>
                <div style={{ height: '100%', aspectRatio: '1 / 1', maxWidth: '100%', containerType: 'inline-size' }}>
                  <ConsoleVinyl fill label="esperando votos" light={CV_LIGHT_THEMES.has(curTheme)} />
                </div>
              </div>
            </div>

            {/* PIE: barra de energía (delgada, full-width) + ticker (pill) + hint reanudar */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(10px,1.4vh,16px)', marginTop: 'clamp(12px,1.8vh,22px)' }}>
              {energyOn && (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'clamp(6px,.9vh,10px)' }}>
                    <span className="cv-mono" style={{ fontSize: 'clamp(9px,.8vw,12px)', letterSpacing: '.18em', color: 'color-mix(in srgb, var(--cv-accent) 72%, #ffffff)', textTransform: 'uppercase' }}>Energía de la sala</span>
                    <span className="cv-mono" style={{ fontSize: 'clamp(9px,.85vw,13px)', letterSpacing: '.05em', color: 'rgba(255,255,255,.6)' }}><b style={{ color: 'var(--cv-accent)', fontWeight: 700 }}>{voteRate}</b> votos/min · <b style={{ color: 'var(--cv-accent)', fontWeight: 700 }}>{energyPct > 66 ? 'CALIENTE' : energyPct > 33 ? 'SUBE' : 'TRANQUI'}</b></span>
                  </div>
                  <div style={{ height: 'clamp(10px,1.1vh,15px)', borderRadius: 999, background: 'rgba(255,255,255,.07)', border: '1px solid var(--cv-hair)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: Math.max(3, Math.min(100, energyPct)) + '%', background: 'var(--cv-theme-grad)', boxShadow: '0 0 26px rgba(var(--cv-accent-rgb),.6)', borderRadius: 999, transition: 'width 1.6s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                </div>
              )}
              {tickerItem && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(var(--cv-accent-rgb),.12)', border: '1px solid rgba(var(--cv-accent-rgb),.26)', borderRadius: 999, padding: '9px 18px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 8px var(--cv-accent)', flexShrink: 0 }} />
                  <span key={(ticker?.name || '') + (ticker?.title || '')} className="cv-mono" style={{ fontSize: 'clamp(11px,.95vw,15px)', color: '#ffffff', animation: 'cvFadeIn .55s ease' }}>
                    {tickerItem.name ? <><b style={{ color: 'var(--cv-accent)', fontWeight: 700 }}>{tickerItem.name}</b> votó {tickerItem.title}</> : <>alguien votó <b>{tickerItem.title}</b></>}
                  </span>
                </div>
              )}
              <div className="cv-mono" style={{ fontSize: 'clamp(8px,.72vw,11px)', letterSpacing: '.14em', color: 'rgba(255,255,255,.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ic name="play" size={10} />TOCÁ PARA REANUDAR</div>
            </div>
          </div>
        </div>
    </main>
    </>
  );
}
