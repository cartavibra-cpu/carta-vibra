'use client';
import { useEffect, useRef, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import Waveform from '@/components/Waveform';
import BrandMark from '@/components/BrandMark';

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

  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
      <div style={{ position: 'relative', minHeight: '100vh', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>

        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <BrandMark size={36} layout="row" />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-mint)', boxShadow: '0 0 12px var(--cv-mint)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>KARAOKE EN VIVO</span>
          </span>
        </div>

        {/* aviso de cambio de lista (versión normal, fuera de pantalla completa) */}
        {pendingPlaylist && !isFs && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            marginBottom: 18, padding: '14px 18px', borderRadius: 16,
            border: '1px solid rgba(110,243,178,.4)', background: 'rgba(110,243,178,.08)',
            boxShadow: '0 0 40px -12px rgba(110,243,178,.45)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🔄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--cv-muted)' }}>Activaron otra playlist en el local</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingPlaylist.name}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
              <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '9px 14px' }} onClick={dismissPlaylist}>Seguir con la actual</button>
              <button className="cv-btn cv-btn-mint" style={{ fontSize: 13, padding: '9px 16px' }} onClick={confirmPlaylist}>Cambiar ahora</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>

          {/* escenario */}
          <div>
            <div ref={stageRef} style={{ position: 'relative', background: '#000', borderRadius: isFs ? 0 : 18, overflow: 'hidden', aspectRatio: isFs ? 'auto' : '16 / 9', height: isFs ? '100vh' : undefined, border: isFs ? 'none' : '1px solid rgba(255,255,255,.08)' }}>
              <div id="yt-karaoke" style={{ width: '100%', height: '100%' }} />

              {!current && (
                <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 46 }}>🎤</div>
                  <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, color: 'var(--cv-text)' }}>Anotate para cantar</div>
                  <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>escaneá el QR y poné el código</div>
                  <div className="cv-wordmark cv-grad-code" style={{ fontSize: 'clamp(48px, 7vw, 80px)', fontWeight: 700, letterSpacing: '.05em', marginTop: 6, textShadow: '0 0 50px rgba(0,212,255,.3)' }}>{roomCode ?? '—'}</div>
                </div>
              )}

              {/* nombre del que canta (arriba izq) */}
              {current && (
                <div style={{ position: 'absolute', left: 16, top: 14, padding: '6px 12px', borderRadius: 999, background: 'rgba(7,6,14,.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cv-mint)', boxShadow: '0 0 8px var(--cv-mint)' }} />
                  <span className="cv-wordmark" style={{ fontSize: 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.8)' }}>{current.singer}</span>
                </div>
              )}

              {/* CÓDIGO en el video: solo en PANTALLA COMPLETA (igual que jukebox) */}
              {isFs && current && (
                <div style={{ position: 'absolute', bottom: 80, right: 28, pointerEvents: 'none', textAlign: 'right', background: 'rgba(7,6,14,.42)', border: '1px solid rgba(0,212,255,.3)', borderRadius: 18, padding: '14px 22px', boxShadow: '0 10px 34px -12px rgba(0,0,0,.6)' }}>
                  <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.2em', color: 'var(--cv-cyan-light)', textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>ANOTATE EN TU CELULAR · CÓDIGO</div>
                  <div className="cv-wordmark cv-grad-code" style={{ fontSize: 58, fontWeight: 700, lineHeight: 1, letterSpacing: '.05em', marginTop: 4, textShadow: '0 2px 18px rgba(0,0,0,.85)' }}>{roomCode ?? '—'}</div>
                </div>
              )}

              {/* aviso de cambio de lista DENTRO del escenario: visible y clickeable en pantalla completa */}
              {isFs && pendingPlaylist && (
                <div
                  style={{
                    position: 'absolute', top: 22, left: 22, right: 22, zIndex: 2147483600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    padding: '14px 18px', borderRadius: 16,
                    border: '1px solid rgba(110,243,178,.5)', background: 'rgba(7,6,14,.92)',
                    boxShadow: '0 14px 44px -10px rgba(0,0,0,.75)',
                    transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)', willChange: 'transform',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🔄</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--cv-muted)', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>Activaron otra playlist en el local</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>
                        {pendingPlaylist.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
                    <button className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '9px 14px' }} onClick={dismissPlaylist}>Seguir con la actual</button>
                    <button className="cv-btn cv-btn-mint" style={{ fontSize: 13, padding: '9px 16px' }} onClick={confirmPlaylist}>Cambiar ahora</button>
                  </div>
                </div>
              )}

            </div>

            {/* cantando ahora + controles */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>CANTANDO AHORA</div>
                <div className="cv-wordmark" style={{ fontSize: 28, fontWeight: 700, color: 'var(--cv-text)', lineHeight: 1.1, marginTop: 2 }}>{current ? current.singer : '—'}</div>
                {current && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{current.title}{current.artist ? ` — ${current.artist}` : ''}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="cv-btn cv-btn-ghost" onClick={goBack} disabled={!backAvailable} style={{ fontSize: 14, padding: '10px 16px', opacity: !backAvailable ? 0.4 : 1 }}>◀ Anterior</button>
                {current && <button className="cv-btn cv-btn-ghost" onClick={togglePlayPause} style={{ fontSize: 14, padding: '10px 16px' }}>{isPaused ? '▶ Reanudar' : '⏸ Pausa'}</button>}
                <button className="cv-btn cv-btn-mint" onClick={advance} disabled={!current && waiting.length === 0} style={{ fontSize: 14, padding: '10px 18px', opacity: !current && waiting.length === 0 ? 0.4 : 1 }}>{current ? 'Siguiente ▶' : 'Empezar ▶'}</button>
                <button className="cv-btn cv-btn-ghost" onClick={toggleFs} style={{ fontSize: 14, padding: '10px 16px' }}>{isFs ? '⤢ Salir' : '⛶ Pantalla'}</button>
              </div>
            </div>
            <div className="cv-mono" style={{ fontSize: 10.5, color: 'var(--cv-mono-2)', marginTop: 10 }}>
              atajos: espacio = play/pausa · → siguiente · ← anterior · F pantalla completa
            </div>
          </div>

          {/* columna derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* código para cantar (héroe en gradiente, igual que jukebox) */}
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(110,243,178,.16)', background: 'radial-gradient(400px 240px at 50% 0%, rgba(110,243,178,.12), transparent 60%), var(--cv-bg-2)', padding: '22px 20px', textAlign: 'center' }}>
              <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.24em', color: 'var(--cv-mint)' }}>CÓDIGO PARA CANTAR</div>
              <div className="cv-wordmark cv-grad-code" style={{ fontSize: 'clamp(56px, 7vw, 92px)', fontWeight: 700, lineHeight: 1, letterSpacing: '.04em', margin: '8px 0', textShadow: '0 0 50px rgba(110,243,178,.3)' }}>{roomCode ?? '—'}</div>
              <div style={{ marginTop: 6 }}><Waveform n={40} color="#6EF3B2" maxH={26} barW={3} gap={3} seed={11} /></div>
              <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 10 }}>Los clientes se anotan en su celular · cambia cada pocos minutos</div>
            </div>

            {/* agregar cantante (fuera de pantalla completa) */}
            {!isFs && (
              <div className="cv-card" style={{ padding: showAdd ? '16px 18px' : '12px 18px' }}>
                {!showAdd ? (
                  <button className="cv-btn cv-btn-ghost" onClick={() => setShowAdd(true)} style={{ fontSize: 13, padding: '9px 14px', width: '100%' }}>➕ Agregar cantante</button>
                ) : addFormBody}
              </div>
            )}

            {/* fila */}
            <div className="cv-card" style={{ padding: '18px 18px' }}>
              <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)', marginBottom: 14 }}>PRÓXIMOS TURNOS ({waiting.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
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
        </div>

        <div style={{ marginTop: 18 }}>
          <a href={slug ? `/panel/venues/${slug}` : '/panel'} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', textDecoration: 'none' }}>← Volver al panel</a>
        </div>
      </div>
    </main>
  );
}
