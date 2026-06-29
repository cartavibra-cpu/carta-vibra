'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import Waveform from '@/components/Waveform';
import BrandMark from '@/components/BrandMark';
import { getSkin, SKIN_STORAGE_KEY, VIEW_STORAGE_KEY, type SkinName, type ViewMode } from '@/lib/skins';

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
  const [viewMode, setViewMode] = useState<ViewMode>('marco');
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
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, cc_load_policy: 0, iv_load_policy: 3 },
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
      const v = localStorage.getItem(VIEW_STORAGE_KEY);
      if (v === 'marco' || v === 'limpio') setViewMode(v);
    } catch {}
  }, []);
  const applySkin = (s: SkinName) => {
    setSkin(s);
    try { localStorage.setItem(SKIN_STORAGE_KEY, s); } catch {}
  };
  const applyView = (v: ViewMode) => {
    setViewMode(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch {}
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
  const clean = isFs || viewMode === 'limpio';
  // Las "luces" del karaoke: glow del color del modo (mint en neón, oro en retro = accent2).
  const _l = sk.accent2.replace('#', '');
  const _lrgb = `${parseInt(_l.slice(0, 2), 16)},${parseInt(_l.slice(2, 4), 16)},${parseInt(_l.slice(4, 6), 16)}`;
  const videoBox: React.CSSProperties = clean
    ? { position: 'absolute', inset: 0, zIndex: 1, borderRadius: 0, border: 'none', boxShadow: 'none', background: '#000', overflow: 'hidden', containerType: 'size' }
    : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(90vw, calc(90vh * 16 / 9))', aspectRatio: '16 / 9', zIndex: 1, borderRadius: 'clamp(6px, .8vw, 14px)', border: `1px solid rgba(${_lrgb},.22)`, boxShadow: `0 0 0 1px rgba(${_lrgb},.18), 0 0 60px -14px rgba(${_lrgb},.5)`, background: '#000', overflow: 'hidden', containerType: 'size' };

  return (
    <main
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: clean ? '#000' : '#070611', cursor: controlsVisible ? 'default' : 'none' }}
    >
      {/* PANTALLA: el video (a pantalla completa o grande con sus luces) */}
      <div ref={stageRef} style={videoBox}>
          {/* pointerEvents:none → YouTube no muestra su nombre/compartir/más-videos al pasar el mouse */}
          <div id="yt-karaoke" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />

          {/* viñeta sutil */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(125% 125% at 50% 50%, transparent 56%, rgba(0,0,0,.42) 100%)' }} />

          {!current ? (
            /* SIN cantante: invitación + código grande al centro (no hay video que mirar) */
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.4cqh', textAlign: 'center', padding: 20, width: '92%' }}>
              <div style={{ fontSize: 'clamp(30px,6cqw,56px)' }}>🎤</div>
              <div className="cv-wordmark" style={{ fontSize: 'clamp(18px,3cqw,30px)', fontWeight: 600, color: sk.textOnVideo }}>Anotate para cantar</div>
              <div className="cv-mono" style={{ fontSize: 'clamp(10px,1.5cqw,14px)', letterSpacing: '.06em', color: sk.labelColor }}>escaneá el QR y poné el código</div>
              <div key={skin} className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(46px,11cqw,112px)', fontWeight: 700, letterSpacing: '.04em', lineHeight: .95, marginTop: 2, textShadow: sk.codeGlow }}>{roomCode ?? '—'}</div>
              <div style={{ opacity: .9 }}><Waveform n={24} color={ac} maxH={16} barW={3} gap={4} seed={11} /></div>
              {waiting.length > 0 && <div className="cv-mono" style={{ fontSize: 'clamp(10px,1.4cqw,14px)', color: ac }}>{waiting.length} en espera · tocá “Empezar”</div>}
            </div>
          ) : (
            <>
              {/* ARRIBA-IZQUIERDA: en escena */}
              <div style={{ position: 'absolute', top: '3.5cqh', left: '2.6cqw', maxWidth: '60%', padding: '.9cqh 1.4cqw', borderRadius: 10, background: sk.cardBg, border: `1px solid ${sk.cardBorder}`, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ac, boxShadow: `0 0 8px ${ac}`, animation: 'cvLive 1.4s ease-in-out infinite', flexShrink: 0 }} />
                  <span className="cv-mono" style={{ fontSize: 'clamp(8px,1.2cqw,13px)', letterSpacing: '.16em', color: ac, textShadow: '0 1px 4px rgba(0,0,0,.9)' }}>EN ESCENA</span>
                </div>
                <div className="cv-wordmark" style={{ fontSize: 'clamp(14px,2.3cqw,26px)', fontWeight: 700, color: sk.textOnVideo, lineHeight: 1.12, marginTop: 2, textShadow: '0 1px 8px rgba(0,0,0,.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.singer}</div>
                {current.title && <div className="cv-mono" style={{ fontSize: 'clamp(9px,1.1cqw,12px)', color: sk.textOnVideo, opacity: .7, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>{current.title}{current.artist ? ` — ${current.artist}` : ''}</div>}
              </div>

              {/* ABAJO-DERECHA: código (chico) */}
              <div style={{ position: 'absolute', bottom: '3.5cqh', right: '2.6cqw', textAlign: 'right', padding: '.9cqh 1.5cqw', borderRadius: 10, background: sk.cardBg, border: `1px solid ${sk.cardBorder}`, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', pointerEvents: 'none' }}>
                <div className="cv-mono" style={{ fontSize: 'clamp(8px,1.1cqw,12px)', letterSpacing: '.2em', color: sk.labelColor, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>ANOTATE EN TU CELULAR</div>
                <div key={skin} className={'cv-wordmark ' + sk.gradClass} style={{ fontSize: 'clamp(22px,5.4cqw,60px)', fontWeight: 700, lineHeight: 1, letterSpacing: '.04em', marginTop: 1, textShadow: sk.codeGlow }}>{roomCode ?? '—'}</div>
                <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end', opacity: .85 }}><Waveform n={18} color={ac} maxH={12} barW={2.5} gap={3} seed={11} /></div>
              </div>
            </>
          )}

          {/* ABAJO-IZQUIERDA: co-brand chiquito */}
          <div style={{ position: 'absolute', bottom: '3.5cqh', left: '2.6cqw', display: 'flex', alignItems: 'center', gap: 5, opacity: .5, pointerEvents: 'none' }}>
            <span className="cv-mono" style={{ fontSize: 'clamp(8px,1cqw,11px)', color: sk.textOnVideo, textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>suena en</span><BrandMark size={15} layout="row" />
          </div>

          {/* aviso de cambio de lista (dentro de la pantalla) */}
          {pendingPlaylist && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(94%, 520px)', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 13, border: `1px solid ${sk.cardBorder}`, background: 'rgba(7,6,14,.95)', boxShadow: '0 14px 44px -10px rgba(0,0,0,.75)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>🔄</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--cv-muted)' }}>Activaron otra playlist</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingPlaylist.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={dismissPlaylist}>Seguir</button>
                <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px', color: ac }} onClick={confirmPlaylist}>Cambiar</button>
              </div>
            </div>
          )}

          {/* zona-sensor arriba */}
          <div onMouseMove={pokeControls} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '22%', zIndex: 2147483400 }} />

          {/* barra de controles (auto-esconde), arriba-centro */}
          <div style={{ position: 'absolute', top: 10, left: '50%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 13, background: 'rgba(7,6,14,.85)', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: controlsOn ? 1 : 0, pointerEvents: controlsOn ? 'auto' : 'none', transform: `translateX(-50%) translateY(${controlsOn ? 0 : -8}px)`, transition: 'opacity .25s ease, transform .25s ease', zIndex: 2147483500, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '94%' }}>
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 9px', opacity: backAvailable ? 1 : .4 }} onClick={goBack} disabled={!backAvailable} title="Anterior (←)">◀</button>
            {current && <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 9px' }} onClick={togglePlayPause} title="Pausa/Reanudar (espacio)">{isPaused ? '▶' : '⏸'}</button>}
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px', color: ac, opacity: (!current && waiting.length === 0) ? .4 : 1 }} onClick={advance} disabled={!current && waiting.length === 0} title="Siguiente (→)">{current ? 'Siguiente ▶' : 'Empezar ▶'}</button>
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 9px' }} onClick={toggleFs} title="Pantalla completa (F)">⛶</button>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)', margin: '0 1px' }} />
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 9px' }} onClick={() => setShowAdd(true)} title="Agregar cantante">➕</button>
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11.5, padding: '6px 9px' }} onClick={() => setShowManage(true)} title="Gestionar la fila">☰ {waiting.length}</button>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)', margin: '0 1px' }} />
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11, padding: '6px 9px' }} onClick={() => applySkin(skin === 'neon' ? 'retro' : 'neon')} title="Cambiar estilo">{skin === 'neon' ? '◐ Neón' : '◑ Retro'}</button>
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 11, padding: '6px 9px' }} onClick={() => applyView(viewMode === 'marco' ? 'limpio' : 'marco')} title="Video con luces / a pantalla completa">{viewMode === 'marco' ? '▣ Luces' : '▢ Limpio'}</button>
            <button className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 9px' }} onClick={() => setShowSettings((v) => !v)} title="Ajustes">⚙</button>
          </div>

          {/* AGREGAR CANTANTE (modal) */}
          {showAdd && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2147483560, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.6)' }} onClick={() => setShowAdd(false)}>
              <div className="cv-card" style={{ width: 420, maxWidth: '100%', maxHeight: '92%', overflowY: 'auto', padding: '18px 20px', background: 'rgba(12,12,20,.98)' }} onClick={(e) => e.stopPropagation()}>
                {addFormBody}
              </div>
            </div>
          )}

          {/* GESTIONAR LA FILA (overlay) */}
          {showManage && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2147483560, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.6)' }} onClick={() => setShowManage(false)}>
              <div className="cv-card" style={{ width: 460, maxWidth: '100%', maxHeight: '88%', display: 'flex', flexDirection: 'column', padding: '18px 20px', background: 'rgba(12,12,20,.98)' }} onClick={(e) => e.stopPropagation()}>
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
            <div style={{ position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)', width: 300, maxWidth: '94%', zIndex: 2147483550, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(10,10,18,.97)', boxShadow: '0 20px 60px -16px rgba(0,0,0,.8)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mono)' }}>AJUSTES</span>
                <button onClick={() => setShowSettings(false)} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.14em', color: 'var(--cv-mono)', marginBottom: 8 }}>VISTA EN LA TV</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <button onClick={() => applyView('marco')} className="cv-mono" style={{ flex: 1, fontSize: 12.5, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: viewMode === 'marco' ? `1px solid ${ac}` : '1px solid var(--cv-line)', background: viewMode === 'marco' ? 'rgba(255,255,255,.06)' : 'transparent', color: viewMode === 'marco' ? ac : 'var(--cv-muted)' }}>▣ Luces</button>
                <button onClick={() => applyView('limpio')} className="cv-mono" style={{ flex: 1, fontSize: 12.5, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: viewMode === 'limpio' ? `1px solid ${ac}` : '1px solid var(--cv-line)', background: viewMode === 'limpio' ? 'rgba(255,255,255,.06)' : 'transparent', color: viewMode === 'limpio' ? ac : 'var(--cv-muted)' }}>▢ Limpio</button>
              </div>
              <div className="cv-mono" style={{ fontSize: 10.5, lineHeight: 1.4, color: 'var(--cv-mono-2)', marginBottom: 14 }}>{viewMode === 'marco' ? 'la rockola llena la pantalla, video en el centro' : 'el video llena toda la pantalla (más grande)'}</div>
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
