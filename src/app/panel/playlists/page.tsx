'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import { CvSelect } from '@/components/CvSelect';
import { useIsMobile } from '@/lib/useIsMobile';

function getYouTubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || '';
    return '';
  } catch { return ''; }
}

type Playlist = { id: string; name: string; type: string; mood: string | null; description: string | null };
type Track = { id: string; title: string; artist: string | null; external_id: string | null; is_embeddable: boolean; sort: number };

const TYPES: { key: string; label: string; color: string; sub: string }[] = [
  { key: 'jukebox', label: 'Jukebox', color: 'var(--cv-cyan)', sub: 'votos · YouTube' },
  { key: 'karaoke', label: 'Karaoke', color: 'var(--cv-mint)', sub: 'por turnos · YouTube' },
  { key: 'dj_pro', label: 'DJ Pro', color: 'var(--cv-violet-light)', sub: 'archivos propios · pronto' },
];

const PANEL_BG = 'radial-gradient(740px 520px at 50% -10%, rgba(var(--cv-accent-rgb),.09), transparent 60%), var(--cv-bg)';

export default function PlaylistsPage() {
  const isMobile = useIsMobile();
  const [uid, setUid] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ jukebox: true, karaoke: true, dj_pro: false });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  // crear playlist
  const [cName, setCName] = useState('');
  const [cType, setCType] = useState('jukebox');
  const [cMood, setCMood] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

  // editar metadata
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eMood, setEMood] = useState('');
  const [eDesc, setEDesc] = useState('');

  // agregar canción
  const [url, setUrl] = useState('');
  const [tTitle, setTTitle] = useState('');
  const [tArtist, setTArtist] = useState('');
  const [embeddable, setEmbeddable] = useState(true);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // importar playlist entera de YouTube (a la playlist abierta)
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytMsg, setYtMsg] = useState<string | null>(null);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const load = async () => {
    setLoading(true);
    const sb = supa(); if (!sb) { setLoading(false); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setUid(null); setLoading(false); return; }
    setUid(user.id);
    const { data } = await sb.from('venue_playlist').select('id,name,type,mood,description').eq('owner', user.id).order('created_at');
    const pls = (data as Playlist[]) || [];
    setPlaylists(pls);
    if (pls.length) {
      const ids = pls.map((p) => p.id);
      const { data: trk } = await sb.from('catalog_track').select('playlist_id').in('playlist_id', ids);
      const c: Record<string, number> = {};
      (trk as { playlist_id: string }[] | null)?.forEach((t) => { if (t.playlist_id) c[t.playlist_id] = (c[t.playlist_id] || 0) + 1; });
      setCounts(c);
    } else setCounts({});
    setLoading(false);
  };

  const loadTracks = async (pid: string) => {
    const sb = supa(); if (!sb) return;
    setTracksLoading(true);
    const { data } = await sb.from('catalog_track').select('id,title,artist,external_id,is_embeddable,sort').eq('playlist_id', pid).order('sort');
    setTracks((data as Track[]) || []);
    setTracksLoading(false);
  };

  const toggleExpand = async (p: Playlist) => {
    if (expanded === p.id) { setExpanded(null); setTracks([]); return; }
    setExpanded(p.id); setEditId(null); setTracks([]);
    setUrl(''); setTTitle(''); setTArtist(''); setEmbeddable(true); setMetaMsg(null);
    setYtUrl(''); setYtMsg(null);
    await loadTracks(p.id);
  };

  const createPlaylist = async (e: React.FormEvent) => {
    e.preventDefault(); setCErr(null);
    const sb = supa(); if (!sb) return;
    if (!cName.trim()) { setCErr('Poné un nombre.'); return; }
    setCreating(true);
    try {
      const { data, error } = await sb.rpc('create_playlist', { p_name: cName.trim(), p_type: cType, p_mood: cMood.trim() || null, p_description: cDesc.trim() || null });
      if (error) { setCErr(error.message); return; }
      setCName(''); setCMood(''); setCDesc('');
      setOpenSections((s) => ({ ...s, [cType]: true }));
      await load();
      const newId = (data as any)?.id;
      if (newId) { setExpanded(newId); await loadTracks(newId); }
    } catch (err: any) { setCErr(err?.message || 'No se pudo crear.'); }
    finally { setCreating(false); }
  };

  const startEdit = (p: Playlist) => { setEditId(p.id); setEName(p.name); setEMood(p.mood || ''); setEDesc(p.description || ''); };
  const saveEdit = async (p: Playlist) => {
    const sb = supa(); if (!sb) return;
    const { error } = await sb.rpc('update_playlist', { p_playlist: p.id, p_name: eName.trim(), p_mood: eMood.trim() || null, p_description: eDesc.trim() || null });
    if (error) return alert(error.message);
    setEditId(null); await load();
  };
  const removePlaylist = async (p: Playlist) => {
    if (!confirm(`¿Borrar la playlist "${p.name}" y todas sus canciones?`)) return;
    const sb = supa(); if (!sb) return;
    const { error } = await sb.rpc('delete_playlist', { p_playlist: p.id });
    if (error) return alert(error.message);
    if (expanded === p.id) { setExpanded(null); setTracks([]); }
    await load();
  };

  const fetchMeta = async () => {
    if (!url.trim()) return;
    setMetaLoading(true); setMetaMsg(null);
    try {
      const r = await fetch(`/api/youtube-meta?kind=video&url=${encodeURIComponent(url.trim())}`);
      const data = await r.json();
      if (!r.ok) { setMetaMsg('⚠️ ' + (data.error || 'No se pudo leer')); return; }
      const ok = (data.playable ?? data.embeddable) !== false;
      setTTitle(data.title || ''); setTArtist(data.artist || ''); setEmbeddable(ok);
      setMetaMsg(ok ? '✓ Datos cargados' : '⚠️ Este video no se reproduce embebido (edad/región). Probá otra versión.');
    } catch { setMetaMsg('⚠️ Error consultando YouTube'); } finally { setMetaLoading(false); }
  };

  const addSong = async (p: Playlist, e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa(); if (!sb) return;
    const videoId = getYouTubeId(url);
    if (!videoId) { setMetaMsg('⚠️ URL de YouTube inválida'); return; }
    if (!embeddable) { setMetaMsg('⚠️ Ese video no se puede reproducir embebido. Probá otra versión.'); return; }
    const nextSort = tracks.length ? Math.max(...tracks.map((t) => t.sort)) + 1 : 0;
    const { error } = await sb.from('catalog_track').insert({
      playlist_id: p.id, venue_id: null, source: 'youtube', external_id: videoId,
      title: tTitle || 'Sin título', artist: tArtist, is_embeddable: embeddable, sort: nextSort,
    });
    if (error) return alert(error.message);
    setUrl(''); setTTitle(''); setTArtist(''); setEmbeddable(true); setMetaMsg(null);
    await loadTracks(p.id);
    setCounts((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
  };

  const importPlaylistInto = async (p: Playlist) => {
    if (!ytUrl.trim()) return;
    const sb = supa(); if (!sb) return;
    setYtLoading(true); setYtMsg('Leyendo playlist…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=playlist&url=${encodeURIComponent(ytUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setYtMsg('⚠️ ' + (data.error || 'No se pudo leer')); return; }
      const all: { videoId: string; title: string; artist: string; embeddable?: boolean; playable?: boolean }[] = data.tracks || [];
      if (all.length === 0) { setYtMsg('La playlist no tiene canciones.'); return; }
      const playable = all.filter((t) => (t.playable ?? t.embeddable) !== false);
      const blocked = all.length - playable.length;
      if (playable.length === 0) { setYtMsg('⚠️ Ninguna de esas canciones se reproduce (embed bloqueado). Probá otra.'); return; }
      const base = tracks.length ? Math.max(...tracks.map((t) => t.sort)) + 1 : 0;
      const rows = playable.map((t, k) => ({
        playlist_id: p.id, venue_id: null, source: 'youtube', external_id: t.videoId,
        title: t.title || 'Sin título', artist: t.artist || '', is_embeddable: true, sort: base + k,
      }));
      const { error } = await sb.from('catalog_track').insert(rows);
      if (error) { setYtMsg('⚠️ ' + error.message); return; }
      setYtMsg(`✓ Agregué ${rows.length} canciones${blocked > 0 ? `. Omití ${blocked} que no se reproducen.` : '.'}`);
      setYtUrl('');
      await loadTracks(p.id);
      setCounts((c) => ({ ...c, [p.id]: (c[p.id] || 0) + rows.length }));
    } catch { setYtMsg('⚠️ Error consultando YouTube'); } finally { setYtLoading(false); }
  };

  const deleteSong = async (p: Playlist, trackId: string) => {
    const sb = supa(); if (!sb) return;
    const { error } = await sb.from('catalog_track').delete().eq('id', trackId);
    if (error) return alert(error.message);
    await loadTracks(p.id);
    setCounts((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 1) - 1) }));
  };

  const moveSong = async (p: Playlist, idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= tracks.length) return;
    const a = tracks[idx], b = tracks[j];
    const sb = supa(); if (!sb) return;
    await sb.from('catalog_track').update({ sort: b.sort }).eq('id', a.id);
    await sb.from('catalog_track').update({ sort: a.sort }).eq('id', b.id);
    await loadTracks(p.id);
  };

  // ---------- estados de carga / sesión ----------
  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: PANEL_BG }}>
        <TopNav />
        <div className="cv-mono" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--cv-muted)' }}>cargando tu biblioteca…</div>
      </main>
    );
  }
  if (!uid) {
    return (
      <main style={{ minHeight: '100vh', background: PANEL_BG }}>
        <TopNav />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ color: 'var(--cv-text-2)', marginBottom: 16 }}>Iniciá sesión para ver tus playlists.</p>
          <a href="/" className="cv-btn cv-btn-cyan" style={{ fontSize: 15, padding: '11px 22px', textDecoration: 'none' }}>Ir al inicio</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '20px 14px 64px' : '28px 20px 80px' }}>

        {/* encabezado */}
        <div style={{ marginBottom: 22 }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 600 }}>Mis playlists</h1>
          <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 6 }}>Tu biblioteca · las canciones viven acá y después las asignás a tus locales</p>
        </div>

        {/* crear playlist */}
        <section className="cv-card" style={{ padding: '18px 20px', marginBottom: 26 }}>
          <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-cyan-light)', marginBottom: 14 }}>NUEVA PLAYLIST</div>
          <form onSubmit={createPlaylist} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input className="cv-input" style={{ flex: '2 1 240px', padding: '11px 14px' }} placeholder="Nombre de la playlist" value={cName} onChange={(e) => setCName(e.target.value)} />
              <CvSelect
                value={cType}
                onChange={setCType}
                ariaLabel="Tipo de playlist"
                style={{ flex: '1 1 160px' }}
                options={[
                  { value: 'jukebox', label: 'Jukebox (YouTube)' },
                  { value: 'karaoke', label: 'Karaoke (YouTube)' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input className="cv-input" style={{ flex: '1 1 160px', padding: '11px 14px' }} placeholder="Mood (ej: Fiesta, Cena)" value={cMood} onChange={(e) => setCMood(e.target.value)} />
              <input className="cv-input" style={{ flex: '2 1 240px', padding: '11px 14px' }} placeholder="Descripción (opcional)" value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button type="submit" disabled={creating} className="cv-btn cv-btn-cyan" style={{ fontSize: 15, padding: '11px 22px', opacity: creating ? 0.6 : 1 }}>{creating ? 'Creando…' : 'Crear playlist'}</button>
              {cErr && <span className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-warm)' }}>{cErr}</span>}
              <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono-2)' }}>DJ Pro (archivos propios) llega más adelante.</span>
            </div>
          </form>
        </section>

        {/* secciones por tipo → grilla de tarjetas (estilo curadas) */}
        {TYPES.map((t) => {
          const pls = playlists.filter((p) => p.type === t.key);
          return (
            <section key={t.key} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px 12px', borderBottom: '1px solid var(--cv-line)', marginBottom: 16 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 600, color: 'var(--cv-text)' }}>{t.label}</span>
                <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)' }}>· {t.sub}</span>
                <span className="cv-mono" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cv-muted-2)' }}>{pls.length} {pls.length === 1 ? 'playlist' : 'playlists'}</span>
              </div>

              {t.key === 'dj_pro' ? (
                <div className="cv-card" style={{ padding: '16px 18px', borderStyle: 'dashed' }}>
                  <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', lineHeight: 1.6 }}>
                    Pronto — acá vas a poder armar playlists con <b style={{ color: 'var(--cv-text-2)' }}>tus propios archivos de audio</b> (no YouTube). Más adelante, importaciones de Beatport / Tidal y similares.
                  </p>
                </div>
              ) : pls.length === 0 ? (
                <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)', padding: '4px 2px' }}>Todavía no tenés playlists de {t.label}. Creá una arriba ↑</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(238px, 1fr))', gap: 14 }}>
                  {pls.map((p) => {
                    const n = counts[p.id] ?? 0;
                    return (
                      <div key={p.id} className="cv-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: 4, background: t.color, boxShadow: `0 0 18px ${t.color}` }} />
                        <div style={{ padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          <div className="cv-wordmark" style={{ fontSize: 17.5, fontWeight: 600, color: 'var(--cv-text)', lineHeight: 1.2, wordBreak: 'break-word' }}>{p.name}</div>
                          {p.mood && (
                            <span style={{ alignSelf: 'flex-start', fontSize: 11, fontFamily: 'var(--cv-font-body)', letterSpacing: '.06em', color: t.color, border: `1px solid ${t.color}`, borderRadius: 999, padding: '2px 10px', textTransform: 'lowercase' }}>{p.mood}</span>
                          )}
                          {p.description && (
                            <p style={{ fontSize: 12.5, color: 'var(--cv-text-2)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                          )}
                          <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 'auto' }}>{n} {n === 1 ? 'canción' : 'canciones'}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            <button className="cv-btn cv-btn-cyan" onClick={() => toggleExpand(p)} style={{ fontSize: 12.5, padding: '8px 13px' }}>Gestionar</button>
                            <button onClick={() => removePlaylist(p)} className="cv-btn cv-btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px', color: 'var(--cv-warm)' }}>Borrar</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* MODAL de gestión de la playlist */}
      {expanded && (() => {
        const p = playlists.find((x) => x.id === expanded);
        if (!p) return null;
        return (
          <div onClick={() => toggleExpand(p)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,3,10,.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 10 : 18 }}>
            <div onClick={(e) => e.stopPropagation()} className="cv-card" style={{ width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              {/* header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--cv-line)', flexShrink: 0 }}>
                {editId === p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input className="cv-input" style={{ flex: '2 1 220px', padding: '10px 12px' }} placeholder="Nombre" value={eName} onChange={(e) => setEName(e.target.value)} />
                      <input className="cv-input" style={{ flex: '1 1 140px', padding: '10px 12px' }} placeholder="Mood" value={eMood} onChange={(e) => setEMood(e.target.value)} />
                    </div>
                    <input className="cv-input" style={{ padding: '10px 12px' }} placeholder="Descripción" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => saveEdit(p)} className="cv-btn cv-btn-cyan" style={{ fontSize: 13, padding: '8px 16px' }}>Guardar</button>
                      <button onClick={() => setEditId(null)} className="cv-btn cv-btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="cv-wordmark" style={{ fontSize: 20, fontWeight: 600, color: 'var(--cv-text)', wordBreak: 'break-word' }}>{p.name}</div>
                      {p.mood && <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted-2)', marginTop: 3 }}>{p.mood}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => startEdit(p)} className="cv-btn cv-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Editar</button>
                      <button onClick={() => toggleExpand(p)} className="cv-mono" aria-label="Cerrar" style={{ fontSize: 15, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {/* agregar canción */}
                <form onSubmit={(e) => addSong(p, e)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  <input className="cv-input" style={{ padding: '10px 12px' }} placeholder="Pegá un link de YouTube y soltá (Tab) → autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input className="cv-input" style={{ flex: '2 1 200px', padding: '10px 12px' }} placeholder="Título" value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
                    <input className="cv-input" style={{ flex: '1 1 140px', padding: '10px 12px' }} placeholder="Artista" value={tArtist} onChange={(e) => setTArtist(e.target.value)} />
                    <button type="submit" className="cv-btn cv-btn-cyan" style={{ fontSize: 14, padding: '10px 18px' }}>Agregar</button>
                  </div>
                  {(metaMsg || metaLoading) && (
                    <span className="cv-mono" style={{ fontSize: 12, color: metaLoading ? 'var(--cv-muted)' : (metaMsg?.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)') }}>
                      {metaLoading ? 'Leyendo…' : metaMsg}
                    </span>
                  )}
                </form>

                {/* importar playlist entera */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(var(--cv-accent-rgb),.04)', border: '1px dashed rgba(var(--cv-accent-rgb),.22)' }}>
                  <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--cv-cyan-light)', width: '100%' }}>¿UNA PLAYLIST ENTERA? PEGÁ EL LINK DE LA PLAYLIST DE YOUTUBE</span>
                  <input className="cv-input" style={{ flex: '2 1 220px', padding: '10px 12px' }} placeholder="https://youtube.com/playlist?list=…" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} />
                  <button type="button" onClick={() => importPlaylistInto(p)} disabled={ytLoading} className="cv-btn cv-btn-cyan" style={{ fontSize: 14, padding: '10px 18px', opacity: ytLoading ? 0.6 : 1 }}>{ytLoading ? 'Importando…' : 'Importar todas'}</button>
                  {ytMsg && <span className="cv-mono" style={{ fontSize: 12, width: '100%', color: ytMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{ytMsg}</span>}
                </div>

                {/* lista de canciones */}
                {tracksLoading ? (
                  <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>cargando canciones…</p>
                ) : tracks.length === 0 ? (
                  <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>Sin canciones aún · pegá un link de YouTube arriba.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tracks.map((tr, i) => (
                      <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
                        <span className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)', width: 22 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tr.title}{!tr.is_embeddable && <span title="No se reproduce embebido" style={{ color: 'var(--cv-warm)', marginLeft: 6 }}>⚠</span>}
                          </div>
                          {tr.artist && <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.artist}</div>}
                        </div>
                        <button onClick={() => moveSong(p, i, -1)} disabled={i === 0} title="Subir" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 14, padding: '2px 4px' }}>↑</button>
                        <button onClick={() => moveSong(p, i, 1)} disabled={i === tracks.length - 1} title="Bajar" style={{ background: 'none', border: 'none', cursor: i === tracks.length - 1 ? 'default' : 'pointer', color: i === tracks.length - 1 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 14, padding: '2px 4px' }}>↓</button>
                        <button onClick={() => deleteSong(p, tr.id)} className="cv-mono" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 12, padding: '2px 6px' }}>quitar</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
