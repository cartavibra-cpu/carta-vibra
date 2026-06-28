'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import { useIsMobile } from '@/lib/useIsMobile';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e';

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
  const isMobile = useIsMobile();
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

  if (isAdmin === null) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG }}>
      <div className="cv-mono" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.18em', color: 'var(--cv-muted)' }}>verificando acceso…</div>
    </main>
  );

  if (!isAdmin) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, marginBottom: 12 }}>carta <span className="cv-grad-text">vibra</span></div>
        <p style={{ fontSize: 15, color: 'var(--cv-text-2)', marginBottom: 18 }}>No tenés acceso. Iniciá sesión con la cuenta de administrador.</p>
        <a href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Volver al inicio</a>
      </div>
    </main>
  );

  const inputStyle: React.CSSProperties = { width: '100%' };
  const sub = (s: string) => (<div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-muted-2)', margin: '0 0 8px' }}>{s}</div>);

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '32px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Admin</h1>
          <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)' }}>PLAYLISTS CURADAS</span>
        </div>

        {/* crear */}
        <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 22, border: '1px solid rgba(0,212,255,.25)' }}>
          {sub('CREAR PLAYLIST NUEVA')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="cv-input" style={inputStyle} placeholder="Nombre (ej: Previa Latina)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="cv-input" style={inputStyle} placeholder="Intención (ej: cumbia y reggaetón para subir la energía)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <input className="cv-input" style={inputStyle} placeholder="Mood corto (ej: Fiesta)" value={newMood} onChange={(e) => setNewMood(e.target.value)} />
            <button className="cv-btn cv-btn-cyan" onClick={createTemplate} style={{ fontSize: 14, padding: '10px 20px', alignSelf: 'flex-start' }}>Crear</button>
          </div>
        </section>

        {/* lista */}
        <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)', marginBottom: 12 }}>PLAYLISTS ({templates.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {templates.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>todavía no creaste ninguna.</div>}
          {templates.map((t) => (
            <div key={t.id} className="cv-card" style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, ...(selected?.id === t.id ? { border: '1px solid rgba(0,212,255,.35)' } : {}) }}>
              <div style={{ minWidth: 0 }}>
                <span className="cv-wordmark" style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text)' }}>{t.name}</span>
                <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 3 }}>
                  {t.mood ? `${t.mood} · ` : ''}{counts[t.id] || 0} temas ·{' '}
                  <span style={{ color: t.published ? 'var(--cv-mint)' : 'var(--cv-mono-2)' }}>{t.published ? '● publicada' : '○ borrador'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="cv-btn cv-btn-ghost" onClick={() => selectTemplate(t)} style={{ fontSize: 13, padding: '7px 14px' }}>Editar</button>
                <button className={t.published ? 'cv-btn cv-btn-ghost' : 'cv-btn cv-btn-cyan'} onClick={() => togglePublish(t)} style={{ fontSize: 13, padding: '7px 14px' }}>{t.published ? 'Despublicar' : 'Publicar'}</button>
                <button onClick={() => deleteTemplate(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 13, padding: '4px 8px' }}>Borrar</button>
              </div>
            </div>
          ))}
        </div>

        {/* editor */}
        {selected && (
          <section className="cv-card" style={{ padding: '22px 24px', border: '1px solid rgba(123,77,255,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h2 className="cv-wordmark" style={{ fontSize: 19, fontWeight: 600, color: 'var(--cv-text)' }}>Editando: {selected.name}</h2>
              <button onClick={() => { setSelected(null); setTplTracks([]); }} className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', background: 'none', border: 'none', cursor: 'pointer' }}>cerrar editor ✕</button>
            </div>
            {selected.description && <p style={{ fontSize: 13.5, color: 'var(--cv-text-2)', margin: '0 0 16px' }}>{selected.description}</p>}

            {/* datos */}
            <div style={{ paddingTop: 16, marginTop: 8, borderTop: '1px solid var(--cv-line)' }}>
              {sub('NOMBRE Y DATOS')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="cv-input" style={inputStyle} placeholder="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <input className="cv-input" style={inputStyle} placeholder="Mood (ej: Fiesta)" value={editMood} onChange={(e) => setEditMood(e.target.value)} />
                <input className="cv-input" style={inputStyle} placeholder="Intención / descripción" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                <button className="cv-btn cv-btn-ghost" onClick={saveDetails} style={{ fontSize: 14, padding: '9px 18px', alignSelf: 'flex-start' }}>Guardar datos</button>
              </div>
            </div>

            {/* agregar canción */}
            <div style={{ paddingTop: 16, marginTop: 18, borderTop: '1px solid var(--cv-line)' }}>
              {sub('AGREGAR CANCIÓN')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="cv-input" style={inputStyle} placeholder="Pegá URL de YouTube y soltá → autocompleta" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={fetchMeta} />
                {metaLoading && <p className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)' }}>buscando…</p>}
                {metaMsg && <p className="cv-mono" style={{ fontSize: 12.5, color: metaMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{metaMsg}</p>}
                <input className="cv-input" style={inputStyle} placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input className="cv-input" style={inputStyle} placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
                <button className="cv-btn cv-btn-cyan" onClick={addSong} style={{ fontSize: 14, padding: '9px 18px', alignSelf: 'flex-start' }}>Agregar a la playlist</button>
              </div>
            </div>

            {/* importar playlist */}
            <div style={{ paddingTop: 16, marginTop: 18, borderTop: '1px solid var(--cv-line)' }}>
              {sub('IMPORTAR PLAYLIST DE YOUTUBE')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <input className="cv-input" placeholder="https://www.youtube.com/playlist?list=..." value={plUrl} onChange={(e) => setPlUrl(e.target.value)} style={{ flex: 1, minWidth: isMobile ? 0 : 220 }} />
                <button className="cv-btn cv-btn-ghost" onClick={importPlaylistToTpl} disabled={plLoading} style={{ fontSize: 14, padding: '0 18px', opacity: plLoading ? 0.6 : 1 }}>{plLoading ? 'Importando…' : 'Importar'}</button>
              </div>
              {plMsg && <p className="cv-mono" style={{ marginTop: 10, fontSize: 12.5, color: plMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{plMsg}</p>}
            </div>

            {/* canciones */}
            <div style={{ paddingTop: 16, marginTop: 18, borderTop: '1px solid var(--cv-line)' }}>
              {sub(`CANCIONES (${tplTracks.length})`)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tplTracks.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>sin canciones todavía.</div>}
                {tplTracks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid var(--cv-line)' }}>
                    <span style={{ fontSize: 14, color: 'var(--cv-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}{t.artist ? <span style={{ color: 'var(--cv-muted)' }}> — {t.artist}</span> : null}
                      {t.is_embeddable === false ? <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--cv-warm)' }}>⚠️ no embebible</span> : null}
                    </span>
                    <button onClick={() => deleteSong(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 12.5, flexShrink: 0 }}>quitar</button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
