'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import Waveform from '@/components/Waveform';
import BrandMark from '@/components/BrandMark';
import { getSkin, SKIN_STORAGE_KEY, type SkinName } from '@/lib/skins';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: (() => void) | undefined }
}

type Signup = { id: string; singer: string; title: string | null; artist: string | null; external_id: string | null; state: string; sort: number };
type Track = { id: string; title: string; artist: string | null; external_id: string | null };
type Picked = { external_id: string; title: string; artist: string; is_embeddable: boolean };

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

function getYouTubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || '';
    return '';
  } catch { return ''; }
}

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(94,46,255,.2), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(110,243,178,.10), transparent 60%), #07060e';

export default function KaraokeConsole({ token, venueId, slug, roomCode, playlistId }: { token: string; venueId: string; slug: string; roomCode: string | null; playlistId: string | null }) {
  const [queue, setQueue] = useState<Signup[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [backAvailable, setBackAvailable] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [pendingPlaylist, setPendingPlaylist] = useState<{ id: string; name: string } | null>(null);

  // Vista ambiente (la rockola que se proyecta) — mismo sistema que el jukebox
  const [skin, setSkin] = useState<SkinName>('neon');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOverlayRef = useRef(false); // settings|add|manage abierto => no esconder controles

  const [showAdd, setShowAdd] = useState(false);
  const [addSinger, setAddSinger] = useState('');
  const [addPickMode, setAddPickMode] = useState<'catalog' | 'paste'>('catalog');
  const [addPicked, setAddPicked] = useState<Picked | null>(null);
  const [addFilter, setAddFilter] = useState('');
  const [addPasteUrl, setAddPasteUrl] = useState('');
  const [addPasteMsg, setAddPasteMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const advancingRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const wantRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cmdChRef = useRef<any>(null);
  // La playlist (catálogo) realmente en uso. La prop es la "ofrecida" — no la
  // aplicamos sola: preguntamos primero (a prueba de errores), igual que el jukebox.
  const appliedPidRef = useRef<string | null>(playlistId);

  const current = queue.find((s) => s.state === 'singing') || null;
  const waiting = queue.filter((s) => s.state === 'waiting');
  const addMatches = addFilter.trim()
    ? tracks.filter((t) => (t.title + ' ' + (t.artist || '')).toLowerCase().includes(addFilter.trim().toLowerCase()))
    : tracks;

  const loadQueue = async () => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('karaoke_signup')
      .select('id,singer,title,artist,external_id,state,sort')
      .eq('venue_id', venueId).in('state', ['waiting', 'singing']).order('sort');
    setQueue((data as Signup[]) || []);
    const { count } = await sb.from('karaoke_signup')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId).eq('state', 'done');
    setBackAvailable((count ?? 0) > 0);
  };

  const loadCatalog = async () => {
    const sb = supa(); const pid = appliedPidRef.current; if (!sb || !pid) return;
    const { data } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('playlist_id', pid).eq('enabled', true).neq('is_embeddable', false).not('external_id', 'is', null);
    setTracks((data as Track[]) || []);
  };

  const advance = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const sb = supa();
    try { if (sb) await sb.rpc('karaoke_advance', { p_token: token }); }
    finally { advancingRef.current = false; }
  };

  const goBack = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const sb = supa();
    try { if (sb) await sb.rpc('karaoke_back', { p_token: token }); }
    finally { advancingRef.current = false; }
  };

  const removeOne = async (id: string) => {
    const sb = supa(); if (!sb) return;
    await sb.rpc('karaoke_remove', { p_token: token, p_id: id });
  };

  const moveOne = async (id: string, dir: -1 | 1) => {
    const sb = supa(); if (!sb) return;
    await sb.rpc('karaoke_move', { p_token: token, p_id: id, p_dir: dir });
  };

  const fetchAddPaste = async () => {
    if (!addPasteUrl.trim()) return;
    const id = getYouTubeId(addPasteUrl.trim());
    if (!id) { setAddPasteMsg('⚠️ Link inválido.'); setAddPicked(null); return; }
    setAddPasteMsg('Buscando…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=video&url=${encodeURIComponent(addPasteUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setAddPasteMsg('⚠️ ' + (data.error || 'No se pudo leer')); setAddPicked(null); return; }
      if (data.embeddable === false) { setAddPasteMsg('⚠️ No se puede reproducir.'); setAddPicked(null); return; }
      setAddPicked({ external_id: id, title: data.title || 'Sin título', artist: data.artist || '', is_embeddable: true });
      setAddPasteMsg('✓ ' + (data.title || 'cargada'));
    } catch { setAddPasteMsg('⚠️ Error consultando YouTube'); setAddPicked(null); }
  };

  const doAdd = async () => {
    const sb = supa(); if (!sb || !addPicked || !addSinger.trim()) return;
    setAdding(true);
    const { error } = await sb.rpc('karaoke_add', {
      p_token: token, p_singer: addSinger.trim(), p_external_id: addPicked.external_id,
      p_title: addPicked.title, p_artist: addPicked.artist, p_is_embeddable: addPicked.is_embeddable,
    });
    setAdding(false);
    if (error) { alert('No se pudo agregar: ' + error.message); return; }
    setAddSinger(''); setAddPicked(null); setAddFilter(''); setAddPasteUrl(''); setAddPasteMsg(null); setShowAdd(false);
  };

  const syncPlayer = () => {
    if (!readyRef.current) return;
    const id = wantRef.current;
    if (id && id !== loadedIdRef.current) {
      loadedIdRef.current = id;
      try { playerRef.current.loadVideoById(id); } catch {}
    }
  };

  const togglePlayPause = () => {
    const p = playerRef.current; if (!p || !readyRef.current) return;
    try {
      const st = p.getPlayerState();
      if (st === window.YT.PlayerState.PLAYING) p.pauseVideo();
      else p.playVideo();
    } catch {}
  };

  const toggleFs = () => {
    const el = stageRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  };

  // El operador acepta el cambio de lista: recargamos SOLO el catálogo (no tocamos
  // al que está cantando). Si lo rechaza, seguimos con la lista actual.
  const confirmPlaylist = () => {
    if (!pendingPlaylist) return;
    appliedPidRef.current = pendingPlaylist.id;
    setPendingPlaylist(null);
    loadCatalog();
  };
  const dismissPlaylist = () => setPendingPlaylist(null);

  useEffect(() => {
    let cancelled = false;
    loadQueue();
    loadCatalog();
    const sb = supa();
    const ch = sb?.channel('karaoke-' + venueId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karaoke_signup', filter: `venue_id=eq.${venueId}` }, () => loadQueue())
      .subscribe();

    // canal de comandos desde el celular (broadcast): pausar/reanudar
    const cmdCh = sb?.channel('cmd-' + venueId);
    cmdCh?.on('broadcast', { event: 'playpause' }, () => togglePlayPause()).subscribe();
    cmdChRef.current = cmdCh || null;

    loadYT().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player('yt-karaoke', {
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 1, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, cc_load_policy: 0 },
        events: {
          onReady: () => { readyRef.current = true; syncPlayer(); },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) advance();
            else if (e.data === window.YT.PlayerState.PAUSED) { setIsPaused(true); try { cmdChRef.current?.send({ type: 'broadcast', event: 'state', payload: { playing: false } }); } catch {} }
            else if (e.data === window.YT.PlayerState.PLAYING) { setIsPaused(false); try { cmdChRef.current?.send({ type: 'broadcast', event: 'state', payload: { playing: true } }); } catch {} }
          },
          onError: () => { logError('karaoke-reproduccion', new Error('Un video de karaoke no se pudo reproducir'), { externalId: loadedIdRef.current }); advance(); },
        },
      });
    });

    return () => { cancelled = true; if (sb && ch) sb.removeChannel(ch); if (sb && cmdCh) sb.removeChannel(cmdCh); try { playerRef.current?.destroy?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // Cambio de playlist activa (la consola actualiza la prop). A prueba de errores:
  // NO cambiamos el catálogo solos — preguntamos. La primera vez se aplica directo.
  useEffect(() => {
    if (playlistId === appliedPidRef.current) return;
    if (appliedPidRef.current === null) { appliedPidRef.current = playlistId; loadCatalog(); return; }
    let cancelled = false;
    (async () => {
      const sb = supa();
      let name = 'Nueva playlist';
      if (sb && playlistId) {
        const { data } = await sb.from('venue_playlist').select('name').eq('id', playlistId).maybeSingle();
        const n = (data as { name: string } | null)?.name;
        if (n) name = n;
      }
      if (!cancelled) setPendingPlaylist(playlistId ? { id: playlistId, name } : null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  useEffect(() => {
    wantRef.current = current?.external_id || null;
    syncPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.external_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      pokeControls();
      const k = e.key.toLowerCase();
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); togglePlayPause(); }
      else if (e.key === 'ArrowRight' || k === 'n') { e.preventDefault(); advance(); }
      else if (e.key === 'ArrowLeft' || k === 'p') { e.preventDefault(); goBack(); }
      else if (k === 'f') { e.preventDefault(); toggleFs(); }
      else if (e.key === 'Escape') { if (document.fullscreenElement) document.exitFullscreen?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Skin de la vista ambiente: recordada por dispositivo (Fase B: por local).
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

  // Controles que se auto-esconden (aparecen al mover el mouse / tocar).
  const pokeControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => { if (!showOverlayRef.current) setControlsVisible(false); }, 3200);
  };
  useEffect(() => {
    const t = setTimeout(() => { if (!showOverlayRef.current) setControlsVisible(false); }, 3800);
    return () => { clearTimeout(t); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);
  useEffect(() => {
    showOverlayRef.current = showSettings || showAdd || showManage;
    if (showSettings || showAdd || showManage) setControlsVisible(true);
  }, [showSettings, showAdd, showManage]);

  // formulario de "agregar cantante" (reutilizado en panel y en overlay de pantalla completa)
  const addFormBody = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>AGREGAR CANTANTE</span>
        <button onClick={() => setShowAdd(false)} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
      <input className="cv-input" placeholder="Nombre o apodo" value={addSinger} onChange={(e) => setAddSinger(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => { setAddPickMode('catalog'); setAddPicked(null); setAddPasteMsg(null); }} className="cv-mono" style={{ flex: 1, fontSize: 12, padding: '7px 0', borderRadius: 10, cursor: 'pointer', border: addPickMode === 'catalog' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: addPickMode === 'catalog' ? 'rgba(110,243,178,.10)' : 'transparent', color: addPickMode === 'catalog' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Catálogo</button>
        <button onClick={() => { setAddPickMode('paste'); setAddPicked(null); }} className="cv-mono" style={{ flex: 1, fontSize: 12, padding: '7px 0', borderRadius: 10, cursor: 'pointer', border: addPickMode === 'paste' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: addPickMode === 'paste' ? 'rgba(110,243,178,.10)' : 'transparent', color: addPickMode === 'paste' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Link</button>
      </div>
      {addPickMode === 'catalog' ? (
        <>
          <input className="cv-input" placeholder="Buscá en el catálogo…" value={addFilter} onChange={(e) => setAddFilter(e.target.value)} style={{ width: '100%', marginBottom: 8, fontSize: 13 }} />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {addMatches.length === 0 && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)' }}>sin resultados.</div>}
            {addMatches.map((t) => {
              const sel = addPicked?.external_id === t.external_id;
              return (
                <button key={t.id} onClick={() => setAddPicked({ external_id: t.external_id || '', title: t.title, artist: t.artist || '', is_embeddable: true })} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 10, cursor: 'pointer', border: sel ? '1px solid var(--cv-mint)' : '1px solid transparent', background: sel ? 'rgba(110,243,178,.10)' : 'rgba(255,255,255,.03)' }}>
                  <div style={{ fontSize: 13.5, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  {t.artist && <div className="cv-mono" style={{ fontSize: 10.5, color: 'var(--cv-mono)' }}>{t.artist}</div>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <input className="cv-input" placeholder="Pegá el link de YouTube y soltá" value={addPasteUrl} onChange={(e) => setAddPasteUrl(e.target.value)} onBlur={fetchAddPaste} style={{ width: '100%', fontSize: 13 }} />
          {addPasteMsg && <p className="cv-mono" style={{ marginTop: 8, fontSize: 12, color: addPasteMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{addPasteMsg}</p>}
        </>
      )}
      {addPicked && <div className="cv-mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--cv-text-2)' }}>→ {addPicked.title}{addPicked.artist ? ` — ${addPicked.artist}` : ''}</div>}
      <button className="cv-btn cv-btn-mint" onClick={doAdd} disabled={adding || !addSinger.trim() || !addPicked} style={{ width: '100%', marginTop: 12, fontSize: 14, padding: '10px 0', opacity: adding || !addSinger.trim() || !addPicked ? 0.5 : 1 }}>{adding ? 'Agregando…' : 'Agregar a la fila'}</button>
    </>
  );

  const sk = getSkin(skin);
  const ac = sk.accent2; // karaoke = color "caliente" del skin (menta en neón, dorado en retro)
  const controlsOn = controlsVisible && !pendingPlaylist;

  return (
    <main
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: sk.bg, cursor: controlsVisible ? 'default' : 'none' }}
    >
      {/* ESCENARIO: el video lo más grande posible. Va a pantalla completa. */}
      <div
        ref={stageRef}
        style={{
          position: 'absolute',
          ...(isFs
            ? { inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }
            : { inset: 'clamp(10px, 2.4vw, 28px)', borderRadius: 22, border: `1px solid ${sk.frameBorder}`, boxShadow: sk.frameGlow }),
          background: '#000', overflow: 'hidden',
        }}
      >
        <div id="yt-karaoke" style={{ width: '100%', height: '100%' }} />

        {current && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.4) 0%, transparent 15%, transparent 58%, rgba(0,0,0,.34) 80%, rgba(0,0,0,.64) 100%)' }} />}

        {/* SIN cantante: anotate para cantar (código gigante al centro) */}
        {!current && (
          <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 'clamp(40px, 6vw, 60px)' }}>🎤</div>
            <div className="cv-wordmark" style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 600, color: sk.textOnVideo }}>Anotate para cantar</div>
            <div className="cv-mono" style={{ fontSize: 13, letterSpacing: '.06em', color: sk.labelColor }}>escaneá el QR y poné el código</div>
            <div className="cv-wordmark" style={{ fontSize: 'clamp(60px, 11vw, 132px)', fontWeight: 700, letterSpacing: '.04em', lineHeight: .95, marginTop: 6, background: sk.codeGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', filter: `drop-shadow(${sk.codeGlow})` }}>{roomCode ?? '—'}</div>
            <div style={{ marginTop: 4, opacity: .92 }}><Waveform n={isFs ? 54 : 40} color={ac} maxH={22} barW={3} gap={4} seed={11} /></div>
            {waiting.length > 0 && <div className="cv-mono" style={{ fontSize: 13, color: ac, marginTop: 8 }}>{waiting.length} en espera · tocá “Empezar”</div>}
          </div>
        )}

        {/* EN VIVO (arriba a la derecha) */}
        <div style={{ position: 'absolute', top: 18, right: 22, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,.4)', pointerEvents: 'none', transform: 'translateZ(0)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ac, boxShadow: `0 0 10px ${ac}`, animation: 'cvLive 1.4s ease-in-out infinite' }} />
          <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.18em', color: ac, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>KARAOKE EN VIVO</span>
        </div>

        {/* BANDA INFERIOR (con alguien cantando): en escena + código + próximos */}
        {current && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(40px, 7vh, 72px) clamp(20px, 3vw, 42px) clamp(16px, 2.4vh, 26px)', background: sk.panel, pointerEvents: 'none', transform: 'translateZ(0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 'clamp(8px, 1.6vh, 16px)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.2em', color: ac, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>EN ESCENA</div>
                <div className="cv-wordmark" style={{ fontSize: 'clamp(22px, 3.4vw, 40px)', fontWeight: 700, color: sk.textOnVideo, lineHeight: 1.05, textShadow: '0 1px 10px rgba(0,0,0,.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.singer}</div>
                {current.title && <div className="cv-mono" style={{ fontSize: 'clamp(11px, 1.3vw, 14px)', color: sk.textOnVideo, opacity: .7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>{current.title}{current.artist ? ` — ${current.artist}` : ''}</div>}
              </div>
              <div className="cv-mono" style={{ fontSize: 11, color: sk.textOnVideo, opacity: .5, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
                <span>suena en</span><BrandMark size={18} layout="row" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'clamp(20px, 4vw, 60px)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="cv-mono" style={{ fontSize: 'clamp(10px, 1.3vw, 13px)', letterSpacing: '.24em', color: sk.labelColor, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>ANOTATE EN TU CELULAR · CÓDIGO</div>
                <div className="cv-wordmark" style={{ fontSize: 'clamp(48px, 9vw, 108px)', fontWeight: 700, lineHeight: .95, letterSpacing: '.04em', marginTop: 4, background: sk.codeGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', filter: `drop-shadow(${sk.codeGlow})` }}>{roomCode ?? '—'}</div>
                <div style={{ marginTop: 8, opacity: .92 }}><Waveform n={isFs ? 50 : 36} color={ac} maxH={20} barW={3} gap={4} seed={11} /></div>
              </div>

              {waiting.length > 0 && (
                <div style={{ flexShrink: 0, minWidth: 'clamp(170px, 22vw, 300px)', maxWidth: '42%' }}>
                  <div className="cv-mono" style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', letterSpacing: '.2em', color: sk.textOnVideo, opacity: .55, marginBottom: 8, textAlign: 'right', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>PRÓXIMOS TURNOS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {waiting.slice(0, isFs ? 4 : 3).map((s, i) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>
                        <span style={{ fontSize: 'clamp(12px, 1.3vw, 15px)', color: sk.textOnVideo, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: .92 }}>{s.singer}</span>
                        <span className="cv-wordmark" style={{ fontSize: 'clamp(12px, 1.3vw, 15px)', fontWeight: 700, color: ac, flexShrink: 0, width: 18, textAlign: 'right' }}>{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* aviso de cambio de lista DENTRO del escenario */}
        {pendingPlaylist && (
          <div style={{ position: 'absolute', top: 18, left: 22, maxWidth: 'min(560px, calc(100% - 44px))', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px', borderRadius: 16, border: `1px solid ${sk.panelBorder}`, background: 'rgba(7,6,14,.93)', boxShadow: '0 14px 44px -10px rgba(0,0,0,.75)', transform: 'translateZ(0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--cv-muted)', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>Activaron otra playlist</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>{pendingPlaylist.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={dismissPlaylist}>Seguir</button>
              <button className="cv-btn cv-btn-mint" style={{ fontSize: 12.5, padding: '8px 14px' }} onClick={confirmPlaylist}>Cambiar</button>
            </div>
          </div>
        )}

      {/* CONTROLES dentro del escenario (para que se vean en pantalla completa) */}
      {/* zona-sensor arriba para revelar los controles */}
      <div onMouseMove={pokeControls} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, zIndex: 2147483400 }} />

      {/* BARRA DE CONTROLES (se auto-esconde) */}
      <div style={{ position: 'absolute', top: 18, left: 22, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 16, background: 'rgba(7,6,14,.82)', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: controlsOn ? 1 : 0, pointerEvents: controlsOn ? 'auto' : 'none', transform: `translateY(${controlsOn ? 0 : -8}px)`, transition: 'opacity .25s ease, transform .25s ease', zIndex: 2147483500, flexWrap: 'wrap', maxWidth: 'calc(100% - 44px)' }}>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 11px', opacity: backAvailable ? 1 : .4 }} onClick={goBack} disabled={!backAvailable} title="Anterior (←)">◀</button>
        {current && <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 11px' }} onClick={togglePlayPause} title="Pausa/Reanudar (espacio)">{isPaused ? '▶' : '⏸'}</button>}
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px', color: ac, opacity: (!current && waiting.length === 0) ? .4 : 1 }} onClick={advance} disabled={!current && waiting.length === 0} title="Siguiente (→)">{current ? 'Siguiente ▶' : 'Empezar ▶'}</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 11px' }} onClick={toggleFs} title="Pantalla completa (F)">⛶</button>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)', margin: '0 2px' }} />
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => setShowAdd(true)} title="Agregar cantante">➕</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => setShowManage(true)} title="Gestionar la fila">☰ {waiting.length}</button>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)', margin: '0 2px' }} />
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => applySkin(skin === 'neon' ? 'retro' : 'neon')} title="Cambiar estilo">{skin === 'neon' ? '◐ Neón' : '◑ Retro'}</button>
        <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => setShowSettings((v) => !v)} title="Ajustes">⚙</button>
      </div>

      {/* AGREGAR CANTANTE (modal) */}
      {showAdd && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2147483560, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,.55)' }} onClick={() => setShowAdd(false)}>
          <div className="cv-card" style={{ width: 420, maxWidth: '100%', padding: '18px 20px', background: 'rgba(12,12,20,.98)' }} onClick={(e) => e.stopPropagation()}>
            {addFormBody}
          </div>
        </div>
      )}

      {/* GESTIONAR LA FILA (overlay) */}
      {showManage && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2147483560, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,.55)' }} onClick={() => setShowManage(false)}>
          <div className="cv-card" style={{ width: 460, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '18px 20px', background: 'rgba(12,12,20,.98)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: ac }}>FILA DE CANTANTES ({waiting.length})</span>
              <button onClick={() => setShowManage(false)} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {waiting.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>nadie en espera. Cuando se anoten, aparecen acá.</div>}
              {waiting.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid var(--cv-line)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveOne(s.id, -1)} disabled={i === 0} title="Subir" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 11, lineHeight: 1, padding: 0, opacity: i === 0 ? 0.4 : 1 }}>▲</button>
                    <button onClick={() => moveOne(s.id, 1)} disabled={i === waiting.length - 1} title="Bajar" style={{ background: 'none', border: 'none', cursor: i === waiting.length - 1 ? 'default' : 'pointer', color: i === waiting.length - 1 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 11, lineHeight: 1, padding: 0, opacity: i === waiting.length - 1 ? 0.4 : 1 }}>▼</button>
                  </div>
                  <span className="cv-wordmark" style={{ fontSize: 16, fontWeight: 700, color: 'var(--cv-muted)', width: 20, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.singer}</div>
                    <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}{s.artist ? ` — ${s.artist}` : ''}</div>
                  </div>
                  <button onClick={() => removeOne(s.id)} title="Sacar de la fila" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AJUSTES (popover) */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 72, left: 22, width: 300, maxWidth: 'calc(100% - 44px)', zIndex: 2147483550, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(10,10,18,.97)', boxShadow: '0 20px 60px -16px rgba(0,0,0,.8)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mono)' }}>AJUSTES</span>
            <button onClick={() => setShowSettings(false)} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.14em', color: 'var(--cv-mono)', marginBottom: 8 }}>ESTILO DE LA ROCKOLA</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['neon', 'retro'] as SkinName[]).map((s) => (
              <button key={s} onClick={() => applySkin(s)} className="cv-mono" style={{ flex: 1, fontSize: 12.5, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: skin === s ? `1px solid ${getSkin(s).accent2}` : '1px solid var(--cv-line)', background: skin === s ? 'rgba(255,255,255,.06)' : 'transparent', color: skin === s ? getSkin(s).accent2 : 'var(--cv-muted)' }}>{getSkin(s).label}</button>
            ))}
          </div>
          <a href={slug ? `/panel/venues/${slug}` : '/panel'} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', textDecoration: 'none' }}>← Volver al panel</a>
        </div>
      )}
      </div>
    </main>
  );
}
