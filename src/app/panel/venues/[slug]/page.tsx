'use client';
import { useEffect, useState, use, useRef } from 'react';
import { supa } from '@/lib/supabaseClient';
import QRCode from 'qrcode';
import TopNav from '@/components/TopNav';

const MODE_LABELS: Record<string, string> = { youtube_jukebox: 'YouTube Jukebox', youtube_karaoke: 'YouTube Karaoke', local_pro: 'Local Pro' };
const modeLabel = (m: string) => MODE_LABELS[m] || m;

function getYouTubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || '';
    return '';
  } catch {
    return '';
  }
}

type Playlist = { id: string; name: string; mood: string | null; description: string | null; is_active: boolean };
type Curated = { id: string; name: string; mood: string | null; description: string | null };

export default function VenuePanelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [venue, setVenue] = useState<any>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [plTracks, setPlTracks] = useState<any[]>([]);
  const [editName, setEditName] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [newPlName, setNewPlName] = useState('');

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [embeddable, setEmbeddable] = useState(true);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [ytName, setYtName] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytMsg, setYtMsg] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const [curated, setCurated] = useState<Curated[]>([]);
  const [curatedCounts, setCuratedCounts] = useState<Record<string, number>>({});
  const [curatedMsg, setCuratedMsg] = useState<string | null>(null);

  const [qr, setQr] = useState('');
  const [mesa, setMesa] = useState('1');
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa(); if (!sb || !venue) return;
    const trimmed = pairCode.trim(); if (!trimmed) return;
    const { data, error } = await sb.rpc('console_confirm_pairing', { p_code: trimmed, p_venue: venue.id });
    if (error) { setPairMsg('❌ ' + error.message); return; }
    setPairMsg(data?.ok ? '✓ Consola vinculada. Mirá la pantalla del local.' : 'Hecho.');
    setPairCode('');
  };

  const load = async () => {
    const sb = supa(); if (!sb) return;
    const { data: v } = await sb.from('venue').select('*').eq('slug', slug).single();
    setVenue(v); if (!v) return;
    const { data: pls } = await sb.from('venue_playlist').select('*').eq('venue_id', v.id).order('sort').order('created_at');
    const plList = (pls as Playlist[]) || [];
    setPlaylists(plList);
    const ids = plList.map((p) => p.id);
    const c: Record<string, number> = {};
    if (ids.length) {
      const { data: trk } = await sb.from('catalog_track').select('id,playlist_id').in('playlist_id', ids);
      (trk as any[] | null)?.forEach((r) => { if (r.playlist_id) c[r.playlist_id] = (c[r.playlist_id] || 0) + 1; });
    }
    setCounts(c);
    QRCode.toDataURL(`/widget/${slug}?mesa=${mesa}`, { width: 400 }).then(setQr);
  };

  const loadCurated = async () => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('playlist_template').select('*').eq('published', true).order('sort').order('created_at');
    setCurated((data as Curated[]) || []);
    const { data: trk } = await sb.from('playlist_template_track').select('template_id');
    const c: Record<string, number> = {};
    (trk as any[] | null)?.forEach((r) => { c[r.template_id] = (c[r.template_id] || 0) + 1; });
    setCuratedCounts(c);
  };

  useEffect(() => { load(); }, [slug, mesa]);
  useEffect(() => { loadCurated(); }, []);

  const selectPlaylist = async (p: Playlist) => {
    setSelected(p);
    setEditName(p.name); setEditMood(p.mood || ''); setEditDesc(p.description || '');
    setUrl(''); setTitle(''); setArtist(''); setMetaMsg(null);
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('catalog_track').select('*').eq('playlist_id', p.id).order('created_at');
    setPlTracks(data || []);
    setTimeout(() => { editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  };

  const reloadSelected = async () => { if (selected) await selectPlaylist(selected); };

  const saveDetails = async () => {
    const sb = supa(); if (!sb || !selected) return;
    const nm = editName.trim() || selected.name;
    const md = editMood.trim() || null;
    const ds = editDesc.trim() || null;
    const { error } = await sb.from('venue_playlist').update({ name: nm, mood: md, description: ds }).eq('id', selected.id);
    if (error) return alert(error.message);
    setSelected({ ...selected, name: nm, mood: md, description: ds });
    load();
  };

  const createEmpty = async () => {
    const sb = supa(); if (!sb || !venue || !newPlName.trim()) return;
    const { error } = await sb.rpc('create_venue_playlist', { p_venue: venue.id, p_name: newPlName.trim() });
    if (error) return alert(error.message);
    setNewPlName(''); load();
  };

  const activate = async (p: Playlist) => {
    const sb = supa(); if (!sb) return;
    const { error } = await sb.rpc('set_active_playlist', { p_playlist: p.id });
    if (error) return alert(error.message);
    load();
  };

  const deletePlaylist = async (p: Playlist) => {
    if (!confirm(`¿Borrar la playlist "${p.name}" y todas sus canciones?`)) return;
    const sb = supa(); if (!sb) return;
    const { error } = await sb.rpc('delete_venue_playlist', { p_playlist: p.id });
    if (error) return alert(error.message);
    if (selected?.id === p.id) { setSelected(null); setPlTracks([]); }
    load();
  };

  const fetchMeta = async () => {
    if (!url.trim()) return;
    setMetaLoading(true); setMetaMsg(null);
    try {
      const r = await fetch(`/api/youtube-meta?kind=video&url=${encodeURIComponent(url.trim())}`);
      const data = await r.json();
      if (!r.ok) { setMetaMsg('⚠️ ' + (data.error || 'No se pudo leer')); return; }
      const ok = (data.playable ?? data.embeddable) !== false;
      setTitle(data.title || ''); setArtist(data.artist || ''); setEmbeddable(ok);
      setMetaMsg(ok ? '✓ Datos cargados' : '⚠️ Este video no se reproduce embebido (restricción de edad o región). Probá otra versión de la canción.');
    } catch { setMetaMsg('⚠️ Error consultando YouTube'); } finally { setMetaLoading(false); }
  };

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa(); if (!sb || !venue || !selected) return;
    const videoId = getYouTubeId(url);
    if (!videoId) return alert('URL de YouTube inválida');
    if (!embeddable) { setMetaMsg('⚠️ Este video no se puede reproducir embebido. Buscá otra versión de la canción.'); return; }
    const { error } = await sb.from('catalog_track').insert({
      venue_id: venue.id, playlist_id: selected.id, source: 'youtube', external_id: videoId,
      title: title || 'Sin título', artist, is_embeddable: embeddable,
    });
    if (error) return alert(error.message);
    setUrl(''); setTitle(''); setArtist(''); setEmbeddable(true); setMetaMsg(null);
    reloadSelected(); load();
  };

  const deleteSong = async (trackId: string) => {
    const sb = supa(); if (!sb) return;
    const { error } = await sb.from('catalog_track').delete().eq('id', trackId);
    if (error) return alert(error.message);
    reloadSelected(); load();
  };

  const importYouTube = async () => {
    const sb = supa(); if (!sb || !venue || !ytUrl.trim()) return;
    setYtLoading(true); setYtMsg('Leyendo playlist…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=playlist&url=${encodeURIComponent(ytUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setYtMsg('⚠️ ' + (data.error || 'No se pudo leer')); return; }
      const tracks: { videoId: string; title: string; artist: string; embeddable?: boolean; playable?: boolean }[] = data.tracks || [];
      if (tracks.length === 0) { setYtMsg('La playlist no tiene canciones.'); return; }
      const playable = tracks.filter((t) => (t.playable ?? t.embeddable) !== false);
      const blocked = tracks.length - playable.length;
      if (playable.length === 0) { setYtMsg('⚠️ Ninguna de esas canciones se puede reproducir (embed bloqueado). Probá otra playlist.'); return; }
      const name = ytName.trim() || 'Playlist de YouTube';
      const { data: plId, error: e1 } = await sb.rpc('create_venue_playlist', { p_venue: venue.id, p_name: name });
      if (e1) { setYtMsg('⚠️ ' + e1.message); return; }
      const rows = playable.map((t) => ({
        venue_id: venue.id, playlist_id: plId, source: 'youtube', external_id: t.videoId,
        title: t.title || 'Sin título', artist: t.artist || '', is_embeddable: true,
      }));
      const { error: e2 } = await sb.from('catalog_track').insert(rows);
      if (e2) { setYtMsg('⚠️ ' + e2.message); return; }
      setYtMsg(`✓ Playlist "${name}" creada con ${rows.length} canciones${blocked > 0 ? `. Omití ${blocked} que no se pueden reproducir.` : ' (todas reproducibles ✓).'}`);
      setYtUrl(''); setYtName('');
      load();
    } catch { setYtMsg('⚠️ Error consultando YouTube'); } finally { setYtLoading(false); }
  };

  const importCurated = async (t: Curated) => {
    const sb = supa(); if (!sb || !venue) return;
    setCuratedMsg(`Importando "${t.name}"…`);
    const { data, error } = await sb.rpc('import_playlist', { p_template: t.id, p_venue: venue.id });
    if (error) { setCuratedMsg('⚠️ ' + error.message); return; }
    setCuratedMsg(`✓ Playlist "${t.name}" creada con ${data?.imported ?? 0} canciones. Activала cuando quieras usarla.`);
    load();
  };

  if (!venue) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e' }}>
      <div className="cv-mono" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.18em', color: 'var(--cv-muted)' }}>cargando local…</div>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e' }}>
      <TopNav />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* header */}
        <div style={{ marginBottom: 26 }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>{venue.name}</h1>
          <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', marginTop: 6 }}>MODO · {modeLabel(venue.mode)}</div>
        </div>

        {/* 1. Vincular consola */}
        <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-cyan)' }}>1</span>
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)' }}>VINCULAR CONSOLA</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--cv-text-2)', lineHeight: 1.55, margin: '4px 0 14px' }}>
            Abrí <b style={{ color: 'var(--cv-text)' }}>/console</b> en la pantalla del local. Te muestra un código de 6 dígitos. Escribilo acá.
          </p>
          <form onSubmit={handlePair} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input className="cv-input" inputMode="numeric" maxLength={6} placeholder="000000" value={pairCode} onChange={(e) => setPairCode(e.target.value)} style={{ width: 160, textAlign: 'center', fontSize: 20, letterSpacing: '.25em', fontFamily: 'var(--cv-font-display)' }} />
            <button className="cv-btn cv-btn-cyan" type="submit" style={{ fontSize: 15, padding: '0 24px' }}>Vincular</button>
          </form>
          {pairMsg && <p className="cv-mono" style={{ marginTop: 12, fontSize: 13, color: 'var(--cv-cyan-light)' }}>{pairMsg}</p>}
        </section>

        {/* 2. Mis playlists */}
        <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-cyan)' }}>2</span>
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)' }}>MIS PLAYLISTS</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--cv-text-2)', lineHeight: 1.55, margin: '4px 0 14px' }}>Los clientes votan solo la playlist <b style={{ color: 'var(--cv-mint)' }}>activa</b>. Podés tener varias y cambiar cuál suena.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <input className="cv-input" placeholder="Nombre de una playlist nueva vacía" value={newPlName} onChange={(e) => setNewPlName(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="cv-btn cv-btn-ghost" onClick={createEmpty} style={{ fontSize: 14, padding: '0 18px' }}>Crear vacía</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {playlists.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>todavía no tenés playlists.</div>}
            {playlists.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 15px', borderRadius: 13, background: p.is_active ? 'rgba(110,243,178,.07)' : 'rgba(255,255,255,.03)', border: p.is_active ? '1px solid rgba(110,243,178,.4)' : '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="cv-wordmark" style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                  {p.mood && <span className="cv-mono" style={{ marginLeft: 8, fontSize: 12, color: 'var(--cv-muted-2)' }}>· {p.mood}</span>}
                  <span className="cv-mono" style={{ marginLeft: 8, fontSize: 12, color: 'var(--cv-muted-2)' }}>· {counts[p.id] || 0} temas</span>
                  {p.is_active && <span className="cv-mono" style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--cv-mint)' }}>● SONANDO</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!p.is_active && <button className="cv-btn cv-btn-mint" onClick={() => activate(p)} style={{ fontSize: 13, padding: '7px 14px' }}>Activar</button>}
                  <button className="cv-btn cv-btn-ghost" onClick={() => selectPlaylist(p)} style={{ fontSize: 13, padding: '7px 14px' }}>Editar</button>
                  <button onClick={() => deletePlaylist(p)} style={{ fontSize: 13, padding: '7px 12px', background: 'none', border: '1px solid rgba(204,153,119,.3)', borderRadius: 10, color: 'var(--cv-warm)', cursor: 'pointer', fontFamily: 'var(--cv-font-body)' }}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Importar */}
        <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-cyan)' }}>3</span>
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)' }}>IMPORTAR PLAYLISTS</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--cv-muted-2)', margin: '4px 0 16px' }}>Cada importación crea una playlist nueva.</p>

          <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--cv-violet-light)', marginBottom: 10 }}>CURADAS DE CARTA VIBRA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            {curated.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>no hay playlists curadas disponibles.</div>}
            {curated.map((t) => (
              <div key={t.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 15px', borderRadius: 13, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="cv-wordmark" style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</span>
                  {t.mood && <span className="cv-mono" style={{ marginLeft: 8, fontSize: 12, color: 'var(--cv-muted-2)' }}>· {t.mood}</span>}
                  <span className="cv-mono" style={{ marginLeft: 8, fontSize: 12, color: 'var(--cv-muted-2)' }}>· {curatedCounts[t.id] || 0} temas</span>
                  {t.description && <p style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 3 }}>{t.description}</p>}
                </div>
                <button className="cv-btn cv-btn-ghost" onClick={() => importCurated(t)} style={{ fontSize: 13, padding: '8px 16px' }}>Importar</button>
              </div>
            ))}
          </div>
          {curatedMsg && <p className="cv-mono" style={{ marginTop: 10, fontSize: 13, color: 'var(--cv-text-2)' }}>{curatedMsg}</p>}

          <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--cv-cyan-light)', margin: '18px 0 10px' }}>DESDE UNA PLAYLIST DE YOUTUBE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="cv-input" placeholder="Nombre de la playlist (ej: Rock de los 2000)" value={ytName} onChange={(e) => setYtName(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <input className="cv-input" placeholder="https://www.youtube.com/playlist?list=..." value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <button className="cv-btn cv-btn-ghost" onClick={importYouTube} disabled={ytLoading} style={{ fontSize: 14, padding: '0 18px', opacity: ytLoading ? 0.6 : 1 }}>{ytLoading ? 'Importando…' : 'Importar'}</button>
            </div>
          </div>
          {ytMsg && <p className="cv-mono" style={{ marginTop: 10, fontSize: 13, color: 'var(--cv-text-2)' }}>{ytMsg}</p>}
        </section>

        {/* 4. Editor */}
        {selected && (
          <section ref={editorRef} className="cv-card" style={{ padding: '20px 22px', marginBottom: 18, border: '1px solid rgba(0,212,255,.25)', scrollMarginTop: 80 }}>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-cyan)', marginBottom: 14 }}>
              EDITANDO · {selected.name}{selected.is_active && <span style={{ color: 'var(--cv-mint)' }}> (activa)</span>}
            </div>

            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 13, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--cv-mono)' }}>NOMBRE Y DATOS</div>
              <input className="cv-input" placeholder="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input className="cv-input" placeholder="Mood (ej: Fiesta)" value={editMood} onChange={(e) => setEditMood(e.target.value)} />
              <input className="cv-input" placeholder="Descripción (opcional)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              <button className="cv-btn cv-btn-cyan" onClick={saveDetails} style={{ fontSize: 14, padding: '9px 18px', alignSelf: 'flex-start' }}>Guardar datos</button>
            </div>

            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--cv-mono)', margin: '18px 0 10px' }}>AGREGAR CANCIÓN</div>
            <form onSubmit={addSong} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input className="cv-input" placeholder="Pegá URL de YouTube y soltá → autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
              {metaLoading && <p className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)' }}>buscando…</p>}
              {metaMsg && <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-text-2)' }}>{metaMsg}</p>}
              <input className="cv-input" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="cv-input" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
              <button className="cv-btn cv-btn-ghost" type="submit" style={{ fontSize: 14, padding: '9px 18px', alignSelf: 'flex-start' }}>Agregar a esta playlist</button>
            </form>

            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--cv-mono)', margin: '18px 0 10px' }}>CANCIONES ({plTracks.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {plTracks.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>sin canciones todavía.</div>}
              {plTracks.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 13px', borderRadius: 11, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.title}{t.artist ? <span style={{ color: 'var(--cv-muted-2)' }}> — {t.artist}</span> : null}
                    {t.is_embeddable === false ? <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--cv-warm)' }}>⚠️ no reproducible</span> : null}
                  </span>
                  <button onClick={() => deleteSong(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--cv-warm)', textDecoration: 'underline', fontFamily: 'var(--cv-font-body)' }}>quitar</button>
                </div>
              ))}
            </div>
            <button onClick={() => { setSelected(null); setPlTracks([]); }} style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline', fontFamily: 'var(--cv-font-body)' }}>Cerrar editor</button>
          </section>
        )}

        {/* 5. QR */}
        <section className="cv-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-cyan)' }}>4</span>
            <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)' }}>QR PARA CLIENTES</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {qr && <img src={qr} alt="QR" style={{ width: 150, height: 150, borderRadius: 12, background: '#fff', padding: 8 }} />}
            <div>
              <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)', marginBottom: 6 }}>MESA</div>
              <input className="cv-input" value={mesa} onChange={(e) => setMesa(e.target.value)} style={{ width: 90 }} />
              <p className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono-2)', marginTop: 10, maxWidth: 240, lineHeight: 1.5 }}>El QR lleva al widget de este local con el número de mesa.</p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
