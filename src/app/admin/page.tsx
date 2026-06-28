'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

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

type Template = { id: string; name: string; description: string | null; mood: string | null; published: boolean };

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Template | null>(null);
  const [tplTracks, setTplTracks] = useState<any[]>([]);
  const [editName, setEditName] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMood, setNewMood] = useState('');

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [embeddable, setEmbeddable] = useState(true);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [plUrl, setPlUrl] = useState('');
  const [plMsg, setPlMsg] = useState<string | null>(null);
  const [plLoading, setPlLoading] = useState(false);

  useEffect(() => { checkAdmin(); }, []);

  const checkAdmin = async () => {
    const sb = supa();
    if (!sb) { setIsAdmin(false); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setIsAdmin(false); return; }
    const { data, error } = await sb.rpc('is_admin');
    if (error) { setIsAdmin(false); return; }
    setIsAdmin(data === true);
    if (data === true) loadTemplates();
  };

  const loadTemplates = async () => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('playlist_template').select('*').order('sort').order('created_at');
    setTemplates((data as Template[]) || []);
    const { data: trk } = await sb.from('playlist_template_track').select('template_id');
    const c: Record<string, number> = {};
    (trk as any[] | null)?.forEach((r) => { c[r.template_id] = (c[r.template_id] || 0) + 1; });
    setCounts(c);
  };

  const createTemplate = async () => {
    const sb = supa(); if (!sb || !newName.trim()) return;
    const { error } = await sb.from('playlist_template').insert({
      name: newName.trim(), description: newDesc.trim() || null, mood: newMood.trim() || null,
    });
    if (error) return alert(error.message);
    setNewName(''); setNewDesc(''); setNewMood('');
    loadTemplates();
  };

  const selectTemplate = async (t: Template) => {
    setSelected(t);
    setEditName(t.name); setEditMood(t.mood || ''); setEditDesc(t.description || '');
    setMetaMsg(null); setPlMsg(null); setUrl(''); setTitle(''); setArtist('');
    loadTplTracks(t.id);
  };

  const saveDetails = async () => {
    const sb = supa(); if (!sb || !selected) return;
    const nm = editName.trim() || selected.name;
    const md = editMood.trim() || null;
    const ds = editDesc.trim() || null;
    const { error } = await sb.from('playlist_template').update({ name: nm, mood: md, description: ds }).eq('id', selected.id);
    if (error) return alert(error.message);
    setSelected({ ...selected, name: nm, mood: md, description: ds });
    loadTemplates();
  };

  const loadTplTracks = async (templateId: string) => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('playlist_template_track').select('*').eq('template_id', templateId).order('sort').order('created_at');
    setTplTracks(data || []);
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

  const addSong = async () => {
    const sb = supa(); if (!sb || !selected) return;
    const videoId = getYouTubeId(url);
    if (!videoId) return alert('URL de YouTube inválida');
    if (!embeddable) { setMetaMsg('⚠️ Este video no se puede reproducir embebido. Buscá otra versión.'); return; }
    const { error } = await sb.from('playlist_template_track').insert({
      template_id: selected.id, source: 'youtube', external_id: videoId,
      title: title || 'Sin título', artist, is_embeddable: embeddable,
    });
    if (error) return alert(error.message);
    setUrl(''); setTitle(''); setArtist(''); setEmbeddable(true); setMetaMsg(null);
    loadTplTracks(selected.id); loadTemplates();
  };

  const importPlaylistToTpl = async () => {
    const sb = supa(); if (!sb || !selected || !plUrl.trim()) return;
    setPlLoading(true); setPlMsg('Leyendo playlist…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=playlist&url=${encodeURIComponent(plUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setPlMsg('⚠️ ' + (data.error || 'No se pudo leer')); return; }
      const fetched: { videoId: string; title: string; artist: string; embeddable?: boolean }[] = data.tracks || [];
      const have = new Set(tplTracks.map((t) => t.external_id));
      const nuevas = fetched.filter((t) => !have.has(t.videoId) && t.embeddable !== false);
      const blocked = fetched.filter((t) => t.embeddable === false).length;
      if (nuevas.length === 0) { setPlMsg(blocked > 0 ? `⚠️ No se agregó nada: ${blocked} con embed bloqueado y el resto ya estaba.` : 'Todas esas canciones ya estaban.'); return; }
      const rows = nuevas.map((t) => ({
        template_id: selected.id, source: 'youtube', external_id: t.videoId,
        title: t.title || 'Sin título', artist: t.artist || '', is_embeddable: true,
      }));
      const { error } = await sb.from('playlist_template_track').insert(rows);
      if (error) { setPlMsg('⚠️ ' + error.message); return; }
      setPlMsg(`✓ Importadas ${nuevas.length} canciones${blocked > 0 ? `, omití ${blocked} no reproducibles` : ' (todas reproducibles ✓)'}.`);
      setPlUrl('');
      loadTplTracks(selected.id); loadTemplates();
    } catch { setPlMsg('⚠️ Error consultando YouTube'); } finally { setPlLoading(false); }
  };

  const togglePublish = async (t: Template) => {
    const sb = supa(); if (!sb) return;
    const { error } = await sb.from('playlist_template').update({ published: !t.published }).eq('id', t.id);
    if (error) return alert(error.message);
    if (selected?.id === t.id) setSelected({ ...t, published: !t.published });
    loadTemplates();
  };

  const deleteSong = async (trackId: string) => {
    const sb = supa(); if (!sb || !selected) return;
    const { error } = await sb.from('playlist_template_track').delete().eq('id', trackId);
    if (error) return alert(error.message);
    loadTplTracks(selected.id); loadTemplates();
  };

  const deleteTemplate = async (t: Template) => {
    if (!confirm(`¿Borrar la playlist "${t.name}" y todas sus canciones?`)) return;
    const sb = supa(); if (!sb) return;
    const { error } = await sb.from('playlist_template').delete().eq('id', t.id);
    if (error) return alert(error.message);
    if (selected?.id === t.id) { setSelected(null); setTplTracks([]); }
    loadTemplates();
  };

  if (isAdmin === null) return <div className="p-6">Verificando acceso…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Panel de Admin</h1>
        <p className="mt-2 text-gray-600">No tenés acceso. Iniciá sesión con la cuenta de administrador.</p>
        <a href="/" className="mt-4 inline-block text-blue-600 underline">Volver al inicio</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Panel de Admin — Playlists curadas</h1>

      <section className="mb-8 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
        <h2 className="mb-2 text-xl font-semibold">Crear playlist nueva</h2>
        <div className="space-y-2">
          <input className="w-full border p-2" placeholder="Nombre (ej: Previa Latina)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full border p-2" placeholder="Intención (ej: cumbia y reggaetón para subir la energía)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <input className="w-full border p-2" placeholder="Mood corto (ej: Fiesta)" value={newMood} onChange={(e) => setNewMood(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={createTemplate}>Crear</button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Playlists ({templates.length})</h2>
        <ul className="space-y-2">
          {templates.length === 0 && <li className="text-sm text-gray-500">Todavía no creaste ninguna.</li>}
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
              <div>
                <span className="font-semibold">{t.name}</span>
                {t.mood && <span className="ml-2 text-sm text-gray-500">· {t.mood}</span>}
                <span className="ml-2 text-sm text-gray-500">· {counts[t.id] || 0} temas</span>
                <span className={`ml-2 text-xs ${t.published ? 'text-green-700' : 'text-gray-400'}`}>{t.published ? '● publicada' : '○ borrador'}</span>
              </div>
              <div className="flex gap-2">
                <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white" onClick={() => selectTemplate(t)}>Editar</button>
                <button className="rounded bg-gray-700 px-3 py-1 text-sm text-white" onClick={() => togglePublish(t)}>{t.published ? 'Despublicar' : 'Publicar'}</button>
                <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => deleteTemplate(t)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="rounded-lg border-2 border-gray-400 p-4">
          <h2 className="text-xl font-semibold">Editando: {selected.name}</h2>
          {selected.description && <p className="mb-3 text-sm text-gray-600">{selected.description}</p>}

          <div className="mt-3 space-y-2 rounded border bg-gray-50 p-3">
            <p className="text-sm font-semibold">Nombre y datos</p>
            <input className="w-full border p-2" placeholder="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <input className="w-full border p-2" placeholder="Mood (ej: Fiesta)" value={editMood} onChange={(e) => setEditMood(e.target.value)} />
            <input className="w-full border p-2" placeholder="Intención / descripción" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={saveDetails}>Guardar datos</button>
          </div>

          <h3 className="mb-1 mt-3 font-semibold">Agregar canción</h3>
          <div className="space-y-2">
            <input className="w-full border p-2" placeholder="Pegá URL de YouTube y soltá → autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
            {metaLoading && <p className="text-sm text-gray-500">Buscando…</p>}
            {metaMsg && <p className="text-sm text-gray-700">{metaMsg}</p>}
            <input className="w-full border p-2" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="w-full border p-2" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={addSong}>Agregar a la playlist</button>
          </div>

          <h3 className="mb-1 mt-5 font-semibold">Importar playlist de YouTube a esta plantilla</h3>
          <div className="flex flex-wrap gap-2">
            <input className="min-w-0 flex-1 border p-2" placeholder="https://www.youtube.com/playlist?list=..." value={plUrl} onChange={(e) => setPlUrl(e.target.value)} />
            <button className="rounded bg-gray-800 px-4 py-2 text-white disabled:opacity-50" onClick={importPlaylistToTpl} disabled={plLoading}>{plLoading ? 'Importando…' : 'Importar'}</button>
          </div>
          {plMsg && <p className="mt-2 text-sm text-gray-700">{plMsg}</p>}

          <h3 className="mb-1 mt-5 font-semibold">Canciones ({tplTracks.length})</h3>
          <ul className="space-y-1">
            {tplTracks.length === 0 && <li className="text-sm text-gray-500">Sin canciones todavía.</li>}
            {tplTracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{t.title}{t.artist ? <span className="text-gray-500"> — {t.artist}</span> : null}{t.is_embeddable === false ? <span className="ml-2 text-xs text-amber-600">⚠️ no embebible</span> : null}</span>
                <button className="text-red-600 underline" onClick={() => deleteSong(t.id)}>quitar</button>
              </li>
            ))}
          </ul>
          <button className="mt-4 text-sm text-gray-500 underline" onClick={() => { setSelected(null); setTplTracks([]); }}>Cerrar editor</button>
        </section>
      )}
    </div>
  );
}
