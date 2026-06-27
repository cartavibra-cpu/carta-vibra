'use client';
import { useEffect, useState, use } from 'react';
import { supa } from '@/lib/supabaseClient';
import QRCode from 'qrcode';

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
    setPlaylists((pls as Playlist[]) || []);
    const { data: trk } = await sb.from('catalog_track').select('id,playlist_id').eq('venue_id', v.id);
    const c: Record<string, number> = {};
    (trk as any[] | null)?.forEach((r) => { if (r.playlist_id) c[r.playlist_id] = (c[r.playlist_id] || 0) + 1; });
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
    setUrl(''); setTitle(''); setArtist(''); setMetaMsg(null);
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('catalog_track').select('*').eq('playlist_id', p.id).order('created_at');
    setPlTracks(data || []);
  };

  const reloadSelected = async () => { if (selected) await selectPlaylist(selected); };

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
      setTitle(data.title || ''); setArtist(data.artist || ''); setEmbeddable(data.embeddable !== false);
      setMetaMsg(data.embeddable === false ? '⚠️ No permite reproducirse embebido' : '✓ Datos cargados');
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
      const tracks: { videoId: string; title: string; artist: string; embeddable?: boolean }[] = data.tracks || [];
      if (tracks.length === 0) { setYtMsg('La playlist no tiene canciones.'); return; }
      const playable = tracks.filter((t) => t.embeddable !== false);
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
      setYtMsg(`✓ Playlist "${name}" creada con ${rows.length} canciones${blocked > 0 ? `. Omití ${blocked} que no se pueden reproducir.` : '.'}`);
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

  if (!venue) return <div className="p-6">Cargando local...</div>;
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-bold">{venue.name}</h1>
      <p className="mb-4 text-sm text-gray-600">Modo: {venue.mode}</p>

      <section className="mb-8 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
        <h2 className="mb-1 text-xl font-semibold">1. Vincular consola</h2>
        <p className="mb-3 text-sm text-gray-700">
          Abrí <b>/console</b> en la pantalla/PC del local. Te muestra un <b>código de 6 dígitos</b>. Escribilo acá.
        </p>
        <form onSubmit={handlePair} className="flex flex-wrap gap-2">
          <input className="w-40 rounded border p-2 text-center text-xl tracking-widest" inputMode="numeric" maxLength={6} placeholder="000000" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
          <button className="rounded bg-blue-600 px-5 py-2 text-white" type="submit">Vincular</button>
        </form>
        {pairMsg && <p className="mt-2 text-sm font-medium text-blue-800">{pairMsg}</p>}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-xl font-semibold">2. Mis playlists</h2>
        <p className="mb-3 text-sm text-gray-600">Los clientes votan solo la playlist <b>activa</b>. Podés tener varias y cambiar cuál suena.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="min-w-0 flex-1 border p-2" placeholder="Nombre de una playlist nueva vacía" value={newPlName} onChange={(e) => setNewPlName(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={createEmpty}>Crear vacía</button>
        </div>
        <ul className="space-y-2">
          {playlists.length === 0 && <li className="text-sm text-gray-500">Todavía no tenés playlists.</li>}
          {playlists.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 ${p.is_active ? 'border-green-500 bg-green-50' : ''}`}>
              <div>
                <span className="font-semibold">{p.name}</span>
                {p.mood && <span className="ml-2 text-sm text-gray-500">· {p.mood}</span>}
                <span className="ml-2 text-sm text-gray-500">· {counts[p.id] || 0} temas</span>
                {p.is_active && <span className="ml-2 text-xs font-bold text-green-700">● SONANDO</span>}
              </div>
              <div className="flex gap-2">
                {!p.is_active && <button className="rounded bg-green-600 px-3 py-1 text-sm text-white" onClick={() => activate(p)}>Activar</button>}
                <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white" onClick={() => selectPlaylist(p)}>Editar</button>
                <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => deletePlaylist(p)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 rounded-lg border border-purple-300 bg-purple-50 p-4">
        <h2 className="mb-1 text-xl font-semibold">3. Importar playlists (crean una playlist nueva)</h2>

        <h3 className="mb-1 mt-2 font-semibold">Curadas de Carta Vibra</h3>
        <ul className="space-y-2">
          {curated.length === 0 && <li className="text-sm text-gray-500">No hay playlists curadas disponibles.</li>}
          {curated.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-3">
              <div>
                <span className="font-semibold">{t.name}</span>
                {t.mood && <span className="ml-2 text-sm text-gray-500">· {t.mood}</span>}
                <span className="ml-2 text-sm text-gray-500">· {curatedCounts[t.id] || 0} temas</span>
                {t.description && <p className="text-sm text-gray-600">{t.description}</p>}
              </div>
              <button className="rounded bg-purple-600 px-4 py-2 text-white" onClick={() => importCurated(t)}>Importar</button>
            </li>
          ))}
        </ul>
        {curatedMsg && <p className="mt-2 text-sm text-gray-700">{curatedMsg}</p>}

        <h3 className="mb-1 mt-4 font-semibold">Desde una playlist de YouTube</h3>
        <div className="space-y-2">
          <input className="w-full border p-2" placeholder="Nombre de la playlist (ej: Rock de los 2000)" value={ytName} onChange={(e) => setYtName(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <input className="min-w-0 flex-1 border p-2" placeholder="https://www.youtube.com/playlist?list=..." value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} />
            <button className="rounded bg-gray-800 px-4 py-2 text-white disabled:opacity-50" onClick={importYouTube} disabled={ytLoading}>{ytLoading ? 'Importando…' : 'Importar'}</button>
          </div>
        </div>
        {ytMsg && <p className="mt-2 text-sm text-gray-700">{ytMsg}</p>}
      </section>

      {selected && (
        <section className="mb-8 rounded-lg border-2 border-gray-400 p-4">
          <h2 className="text-xl font-semibold">Editando: {selected.name}{selected.is_active && <span className="ml-2 text-sm text-green-700">(activa)</span>}</h2>

          <h3 className="mb-1 mt-3 font-semibold">Agregar canción</h3>
          <form onSubmit={addSong} className="space-y-2">
            <input className="w-full border p-2" placeholder="Pegá URL de YouTube y soltá → autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
            {metaLoading && <p className="text-sm text-gray-500">Buscando…</p>}
            {metaMsg && <p className="text-sm text-gray-700">{metaMsg}</p>}
            <input className="w-full border p-2" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="w-full border p-2" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">Agregar a esta playlist</button>
          </form>

          <h3 className="mb-1 mt-5 font-semibold">Canciones ({plTracks.length})</h3>
          <ul className="space-y-1">
            {plTracks.length === 0 && <li className="text-sm text-gray-500">Sin canciones todavía.</li>}
            {plTracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{t.title}{t.artist ? <span className="text-gray-500"> — {t.artist}</span> : null}{t.is_embeddable === false ? <span className="ml-2 text-xs text-amber-600">⚠️ no embebible</span> : null}</span>
                <button className="text-red-600 underline" onClick={() => deleteSong(t.id)}>quitar</button>
              </li>
            ))}
          </ul>
          <button className="mt-4 text-sm text-gray-500 underline" onClick={() => { setSelected(null); setPlTracks([]); }}>Cerrar editor</button>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xl font-semibold">QR para clientes</h2>
        <div className="flex items-center gap-4">
          <img src={qr} alt="QR" className="h-40 w-40" />
          <div>
            <p>Mesa:</p>
            <input className="w-20 border p-1" value={mesa} onChange={(e) => setMesa(e.target.value)} />
          </div>
        </div>
      </section>
    </div>
  );
}
