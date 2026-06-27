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

type Template = { id: string; name: string; description: string | null; mood: string | null };

export default function VenuePanelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [venue, setVenue] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [embeddable, setEmbeddable] = useState(true);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [qr, setQr] = useState('');
  const [mesa, setMesa] = useState('1');
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const [plUrl, setPlUrl] = useState('');
  const [plMsg, setPlMsg] = useState<string | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [curated, setCurated] = useState<Template[]>([]);
  const [curatedCounts, setCuratedCounts] = useState<Record<string, number>>({});
  const [curatedMsg, setCuratedMsg] = useState<string | null>(null);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb || !venue) return;
    const trimmed = pairCode.trim();
    if (!trimmed) return;
    const { data, error } = await sb.rpc('console_confirm_pairing', { p_code: trimmed, p_venue: venue.id });
    if (error) { setPairMsg('❌ ' + error.message); return; }
    setPairMsg(data?.ok ? '✓ Consola vinculada. Mirá la pantalla del local.' : 'Hecho.');
    setPairCode('');
  };

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    const { data: v } = await sb.from('venue').select('*').eq('slug', slug).single();
    setVenue(v);
    const { data: t } = await sb.from('catalog_track').select('*').eq('venue_id', v.id);
    setTracks(t || []);
    const qrUrl = `/widget/${slug}?mesa=${mesa}`;
    QRCode.toDataURL(qrUrl, { width: 400 }).then(setQr);
  };

  const loadCurated = async () => {
    const sb = supa();
    if (!sb) return;
    const { data } = await sb.from('playlist_template').select('*').eq('published', true).order('sort').order('created_at');
    setCurated((data as Template[]) || []);
    const { data: trk } = await sb.from('playlist_template_track').select('template_id');
    const c: Record<string, number> = {};
    (trk as any[] | null)?.forEach((r) => { c[r.template_id] = (c[r.template_id] || 0) + 1; });
    setCuratedCounts(c);
  };

  useEffect(() => { load(); }, [slug, mesa]);
  useEffect(() => { loadCurated(); }, []);

  const fetchMeta = async () => {
    if (!url.trim()) return;
    setMetaLoading(true);
    setMetaMsg(null);
    try {
      const r = await fetch(`/api/youtube-meta?kind=video&url=${encodeURIComponent(url.trim())}`);
      const data = await r.json();
      if (!r.ok) { setMetaMsg('⚠️ ' + (data.error || 'No se pudo leer el video')); return; }
      setTitle(data.title || '');
      setArtist(data.artist || '');
      setEmbeddable(data.embeddable !== false);
      setMetaMsg(data.embeddable === false
        ? '⚠️ Datos cargados, pero este video NO permite reproducirse embebido.'
        : '✓ Datos cargados');
    } catch {
      setMetaMsg('⚠️ Error consultando YouTube');
    } finally {
      setMetaLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb || !venue) return;
    const videoId = getYouTubeId(url);
    if (!videoId) return alert('URL de YouTube inválida');
    const { error } = await sb.from('catalog_track').insert({
      venue_id: venue.id, source: 'youtube', external_id: videoId,
      title: title || 'Sin título', artist, is_embeddable: embeddable,
    });
    if (error) return alert(error.message);
    setUrl(''); setTitle(''); setArtist(''); setEmbeddable(true); setMetaMsg(null);
    load();
  };

  const importPlaylist = async () => {
    const sb = supa();
    if (!sb || !venue || !plUrl.trim()) return;
    setPlLoading(true);
    setPlMsg('Leyendo playlist…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=playlist&url=${encodeURIComponent(plUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setPlMsg('⚠️ ' + (data.error || 'No se pudo leer la playlist')); return; }
      const fetched: { videoId: string; title: string; artist: string }[] = data.tracks || [];
      const have = new Set(tracks.map((t) => t.external_id));
      const nuevas = fetched.filter((t) => !have.has(t.videoId));
      if (nuevas.length === 0) { setPlMsg('Todas esas canciones ya estaban en el catálogo.'); return; }
      const rows = nuevas.map((t) => ({
        venue_id: venue.id, source: 'youtube', external_id: t.videoId,
        title: t.title || 'Sin título', artist: t.artist || '', is_embeddable: true,
      }));
      const { error } = await sb.from('catalog_track').insert(rows);
      if (error) { setPlMsg('⚠️ ' + error.message); return; }
      setPlMsg(`✓ Importadas ${nuevas.length} canciones (${fetched.length - nuevas.length} ya estaban).`);
      setPlUrl('');
      load();
    } catch {
      setPlMsg('⚠️ Error consultando YouTube');
    } finally {
      setPlLoading(false);
    }
  };

  const importCurated = async (t: Template) => {
    const sb = supa();
    if (!sb || !venue) return;
    setCuratedMsg(`Importando "${t.name}"…`);
    const { data, error } = await sb.rpc('import_playlist', { p_template: t.id, p_venue: venue.id });
    if (error) { setCuratedMsg('⚠️ ' + error.message); return; }
    setCuratedMsg(`✓ "${t.name}": ${data?.imported ?? 0} canciones agregadas a tu catálogo.`);
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
          Abrí <b>/console</b> en la pantalla/PC del local. Te muestra un <b>código de 6 dígitos</b>. Escribilo acá para vincular esa pantalla a este local.
        </p>
        <form onSubmit={handlePair} className="flex flex-wrap gap-2">
          <input className="w-40 rounded border p-2 text-center text-xl tracking-widest" inputMode="numeric" maxLength={6} placeholder="000000" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
          <button className="rounded bg-blue-600 px-5 py-2 text-white" type="submit">Vincular</button>
        </form>
        {pairMsg && <p className="mt-2 text-sm font-medium text-blue-800">{pairMsg}</p>}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">2. Cargar canción YouTube</h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <input className="w-full border p-2" placeholder="Pegá la URL del video y soltá → se autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
          {metaLoading && <p className="text-sm text-gray-500">Buscando datos en YouTube…</p>}
          {metaMsg && <p className="text-sm text-gray-700">{metaMsg}</p>}
          <input className="w-full border p-2" placeholder="Título (se completa solo)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="w-full border p-2" placeholder="Artista (se completa solo)" value={artist} onChange={(e) => setArtist(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">Agregar</button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border border-gray-300 p-4">
        <h2 className="mb-1 text-xl font-semibold">2b. Importar playlist de YouTube</h2>
        <p className="mb-2 text-sm text-gray-600">Pegá la URL de una playlist de YouTube y se cargan todas las canciones de una (hasta 200), con título y artista.</p>
        <div className="flex flex-wrap gap-2">
          <input className="min-w-0 flex-1 border p-2" placeholder="https://www.youtube.com/playlist?list=..." value={plUrl} onChange={(e) => setPlUrl(e.target.value)} />
          <button className="rounded bg-gray-800 px-4 py-2 text-white disabled:opacity-50" onClick={importPlaylist} disabled={plLoading}>{plLoading ? 'Importando…' : 'Importar'}</button>
        </div>
        {plMsg && <p className="mt-2 text-sm text-gray-700">{plMsg}</p>}
      </section>

      <section className="mb-8 rounded-lg border border-purple-300 bg-purple-50 p-4">
        <h2 className="mb-1 text-xl font-semibold">2c. Importar una playlist curada</h2>
        <p className="mb-3 text-sm text-gray-600">Playlists armadas y pensadas por Carta Vibra. Importás una y queda en tu catálogo, lista para editar a tu gusto.</p>
        <ul className="space-y-2">
          {curated.length === 0 && <li className="text-sm text-gray-500">No hay playlists curadas disponibles por ahora.</li>}
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
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">3. QR para clientes</h2>
        <div className="flex items-center gap-4">
          <img src={qr} alt="QR" className="h-40 w-40" />
          <div>
            <p>Mesa:</p>
            <input className="w-20 border p-1" value={mesa} onChange={(e) => setMesa(e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Catálogo ({tracks.length})</h2>
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li key={t.id} className="rounded border p-2">{t.title} - {t.artist}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
