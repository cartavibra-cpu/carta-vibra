'use client';
import { useEffect, useState, use, useCallback, useRef } from 'react';
import { supa } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import BrandMark from '@/components/BrandMark';
import { Ic } from '@/components/Ic';
import { applyCvTheme, CV_THEME_META } from '@/lib/theme';

type Track = { id: string; title: string; artist: string | null; external_id: string | null };
type Signup = { id: string; singer: string; title: string | null; artist: string | null; external_id: string | null; state: string; sort: number };
type Picked = { external_id: string; title: string; artist: string; is_embeddable: boolean };

const BG = 'radial-gradient(520px 420px at 50% -5%, rgba(var(--cv-accent-rgb),.16), transparent 62%), var(--cv-bg)';

function getYouTubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || '';
    return '';
  } catch { return ''; }
}

export default function ControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [venue, setVenue] = useState<any>(null);
  const [venueLoaded, setVenueLoaded] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Signup[]>([]);
  const [backAvailable, setBackAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pcPlaying, setPcPlaying] = useState(true);
  const [mode, setMode] = useState<'jukebox' | 'karaoke'>('karaoke');
  const [jbSeconds, setJbSeconds] = useState(0);
  const [jbAutoDj, setJbAutoDj] = useState(true);
  const [theme, setTheme] = useState('vibra');
  const [energyOn, setEnergyOn] = useState(true);
  const [pcVolume, setPcVolume] = useState(100);
  const [pcStopped, setPcStopped] = useState(false);
  const [pcPending, setPcPending] = useState<string | null>(null);
  const cmdChRef = useRef<any>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addSinger, setAddSinger] = useState('');
  const [addPickMode, setAddPickMode] = useState<'catalog' | 'paste'>('catalog');
  const [addPicked, setAddPicked] = useState<Picked | null>(null);
  const [addFilter, setAddFilter] = useState('');
  const [addPasteUrl, setAddPasteUrl] = useState('');
  const [addPasteMsg, setAddPasteMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const current = queue.find((s) => s.state === 'singing') || null;
  const waiting = queue.filter((s) => s.state === 'waiting');
  const vid = venue?.id as string | undefined;
  const isOwner = !!(session?.user?.id && venue?.owner && session.user.id === venue.owner);
  const addMatches = addFilter.trim()
    ? tracks.filter((t) => (t.title + ' ' + (t.artist || '')).toLowerCase().includes(addFilter.trim().toLowerCase()))
    : tracks;

  useEffect(() => {
    const sb = supa(); if (!sb) { setSessionLoaded(true); return; }
    sb.auth.getSession().then(({ data }: any) => { setSession(data.session); setSessionLoaded(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadVenue = useCallback(async () => {
    const sb = supa(); if (!sb) return;
    const { data: v } = await sb.from('venue').select('id,owner,name,slug,theme,settings').eq('slug', slug).maybeSingle();
    setVenue(v); setVenueLoaded(true);
    if (!v) return;
    applyCvTheme((v as { theme?: string }).theme);
    setTheme((v as { theme?: string }).theme || 'vibra');
    setEnergyOn((v as { settings?: { energy?: boolean } }).settings?.energy !== false);
    const { data: asg } = await sb.from('venue_playlist_assignment')
      .select('playlist_id,section').eq('venue_id', v.id).eq('is_active', true).maybeSingle();
    setMode((asg as any)?.section === 'jukebox' ? 'jukebox' : 'karaoke');
    const plId = (asg as any)?.playlist_id ?? null;
    if (!plId) { setTracks([]); return; }
    const { data: t } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('playlist_id', plId).eq('enabled', true).neq('is_embeddable', false).not('external_id', 'is', null);
    setTracks((t as Track[]) || []);
  }, [slug]);

  useEffect(() => { loadVenue(); }, [loadVenue]);

  const loadQueue = useCallback(async (venueId: string) => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('karaoke_signup')
      .select('id,singer,title,artist,external_id,state,sort')
      .eq('venue_id', venueId).in('state', ['waiting', 'singing']).order('sort');
    setQueue((data as Signup[]) || []);
    const { count } = await sb.from('karaoke_signup')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId).eq('state', 'done');
    setBackAvailable((count ?? 0) > 0);
  }, []);

  // Re-lee la sección activa (jukebox/karaoke) + el catálogo, sin recargar el local.
  // Sirve para que el control cambie de modo solo cuando activás otra playlist.
  const refreshMode = useCallback(async (venueId: string) => {
    const sb = supa(); if (!sb) return;
    const { data: asg } = await sb.from('venue_playlist_assignment')
      .select('playlist_id,section').eq('venue_id', venueId).eq('is_active', true).maybeSingle();
    setMode((asg as any)?.section === 'jukebox' ? 'jukebox' : 'karaoke');
    const plId = (asg as any)?.playlist_id ?? null;
    if (!plId) { setTracks([]); return; }
    const { data: t } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('playlist_id', plId).eq('enabled', true).neq('is_embeddable', false).not('external_id', 'is', null);
    setTracks((t as Track[]) || []);
  }, []);

  useEffect(() => {
    if (!venue) return;
    loadQueue(venue.id);
    const sb = supa(); if (!sb) return;
    const ch = sb.channel('ctrl-' + venue.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karaoke_signup', filter: `venue_id=eq.${venue.id}` }, () => loadQueue(venue.id))
      // si activás otra playlist (jukebox ⇄ karaoke), el control cambia de modo solo
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_playlist_assignment', filter: `venue_id=eq.${venue.id}` }, () => refreshMode(venue.id))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venue, loadQueue, refreshMode]);

  // canal de comandos hacia el PC (broadcast): pausar/reanudar + estado (karaoke y jukebox)
  useEffect(() => {
    if (!venue) return;
    const sb = supa(); if (!sb) return;
    const cmd = sb.channel('cmd-' + venue.id);
    cmd
      .on('broadcast', { event: 'state' }, (p: any) => { if (typeof p?.payload?.playing === 'boolean') setPcPlaying(p.payload.playing); })
      .on('broadcast', { event: 'jbstate' }, (p: any) => {
        const s = p?.payload || {};
        if (typeof s.playing === 'boolean') setPcPlaying(s.playing);
        if (typeof s.seconds === 'number') setJbSeconds(s.seconds);
        if (typeof s.autodj === 'boolean') setJbAutoDj(s.autodj);
        if (typeof s.theme === 'string') { applyCvTheme(s.theme); setTheme(s.theme); }
        if (typeof s.energy === 'boolean') setEnergyOn(s.energy);
        if (typeof s.volume === 'number') setPcVolume(s.volume);
        if (typeof s.stopped === 'boolean') setPcStopped(s.stopped);
        if ('pendingName' in s) setPcPending(s.pendingName || null);
      });
    cmdChRef.current = cmd;
    cmd.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && mode === 'jukebox') {
        try { cmd.send({ type: 'broadcast', event: 'jbcmd', payload: { cmd: 'hello' } }); } catch {}
      }
    });
    return () => { sb.removeChannel(cmd); cmdChRef.current = null; };
  }, [venue, mode]);

  const togglePlay = () => { try { cmdChRef.current?.send({ type: 'broadcast', event: 'playpause', payload: {} }); } catch {} setPcPlaying((v) => !v); };

  // jukebox: órdenes al PC
  const jbSend = (payload: any) => { try { cmdChRef.current?.send({ type: 'broadcast', event: 'jbcmd', payload }); } catch {} };
  const jbSkip = () => jbSend({ cmd: 'skip' });
  const jbBack = () => jbSend({ cmd: 'back' });
  const jbPlayPause = () => { jbSend({ cmd: 'playpause' }); setPcPlaying((v) => !v); };
  const jbStop = () => { jbSend({ cmd: 'stop' }); setPcStopped(true); };
  const jbResume = () => { jbSend({ cmd: 'resume' }); setPcStopped(false); };
  const jbCC = () => jbSend({ cmd: 'cc' });
  const jbVolume = (n: number) => { const v = Math.max(0, Math.min(100, n)); setPcVolume(v); jbSend({ cmd: 'volume', value: v }); };
  const jbSwitchPlaylist = () => { jbSend({ cmd: 'switchplaylist' }); setPcPending(null); };
  const jbSetAutoDj = (v: boolean) => { setJbAutoDj(v); jbSend({ cmd: 'autodj', value: v }); };
  const jbSetSeconds = (n: number) => { setJbSeconds(n); jbSend({ cmd: 'seconds', value: n }); };

  // Apariencia de la pantalla del local: paleta + termómetro (guarda en el local + avisa al PC).
  const pickTheme = (t: string) => {
    setTheme(t); applyCvTheme(t); jbSend({ cmd: 'theme', value: t });
    const sb = supa(); if (sb && vid) (async () => { try { await sb.rpc('set_venue_theme', { p_venue: vid, p_theme: t }); } catch {} })();
  };
  const setEnergy = (v: boolean) => {
    setEnergyOn(v); jbSend({ cmd: 'energy', value: v });
    const sb = supa(); if (sb && vid) (async () => { try { await sb.rpc('set_venue_energy', { p_venue: vid, p_on: v }); } catch {} })();
  };

  const advance = async () => { const sb = supa(); if (!sb || !vid || busy) return; setBusy(true); try { await sb.rpc('karaoke_owner_advance', { p_venue: vid }); } catch (e) { logError('control-karaoke-siguiente', e); } finally { setBusy(false); } };
  const goBack = async () => { const sb = supa(); if (!sb || !vid || busy) return; setBusy(true); try { await sb.rpc('karaoke_owner_back', { p_venue: vid }); } catch (e) { logError('control-karaoke-anterior', e); } finally { setBusy(false); } };
  const removeOne = async (id: string) => { const sb = supa(); if (!sb || !vid) return; await sb.rpc('karaoke_owner_remove', { p_venue: vid, p_id: id }); };
  const moveOne = async (id: string, dir: -1 | 1) => { const sb = supa(); if (!sb || !vid) return; await sb.rpc('karaoke_owner_move', { p_venue: vid, p_id: id, p_dir: dir }); };

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
    const sb = supa(); if (!sb || !vid || !addPicked || !addSinger.trim()) return;
    setAdding(true);
    const { error } = await sb.rpc('karaoke_owner_add', {
      p_venue: vid, p_singer: addSinger.trim(), p_external_id: addPicked.external_id,
      p_title: addPicked.title, p_artist: addPicked.artist, p_is_embeddable: addPicked.is_embeddable,
    });
    setAdding(false);
    if (error) { alert('No se pudo agregar: ' + error.message); logError('control-karaoke-agregar', new Error(error.message), { externalId: addPicked?.external_id, title: addPicked?.title }); return; }
    setAddSinger(''); setAddPicked(null); setAddFilter(''); setAddPasteUrl(''); setAddPasteMsg(null); setShowAdd(false);
  };

  const shell = (inner: React.ReactNode) => (
    <main style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 48px' }}>{inner}</div>
    </main>
  );

  if (!sessionLoaded || !venueLoaded) return shell(<p className="cv-mono" style={{ color: 'var(--cv-muted)', textAlign: 'center', marginTop: 60 }}>Cargando…</p>);

  if (!venue) return shell(
    <div style={{ textAlign: 'center', marginTop: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><BrandMark size={88} /></div>
      <p className="cv-mono" style={{ color: 'var(--cv-muted)' }}>No encontramos el local «{slug}».</p>
    </div>
  );

  if (!session) return shell(
    <div style={{ textAlign: 'center', marginTop: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BrandMark size={92} /></div>
      <div className="cv-card" style={{ padding: '24px 20px' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
        <p style={{ color: 'var(--cv-text)', fontWeight: 600, marginBottom: 6 }}>Iniciá sesión para controlar tu local</p>
        <p className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)', marginBottom: 16 }}>Entrá con la cuenta dueña de «{venue.name}».</p>
        <a href="/" className="cv-btn cv-btn-primary" style={{ display: 'inline-block', padding: '11px 22px' }}>Ir a iniciar sesión</a>
      </div>
    </div>
  );

  if (!isOwner) return shell(
    <div style={{ textAlign: 'center', marginTop: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BrandMark size={92} /></div>
      <div className="cv-card" style={{ padding: '24px 20px' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🚫</div>
        <p style={{ color: 'var(--cv-text)', fontWeight: 600, marginBottom: 6 }}>Este local no es tuyo</p>
        <p className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)' }}>«{venue.name}» pertenece a otra cuenta.</p>
      </div>
    </div>
  );

  const addFormBody = (
    <>
      <input className="cv-input" placeholder="Nombre o apodo" value={addSinger} onChange={(e) => setAddSinger(e.target.value)} style={{ width: '100%', marginBottom: 10, fontSize: 16 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => { setAddPickMode('catalog'); setAddPicked(null); setAddPasteMsg(null); }} className="cv-mono" style={{ flex: 1, fontSize: 13, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: addPickMode === 'catalog' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: addPickMode === 'catalog' ? 'rgba(var(--cv-accent-rgb),.10)' : 'transparent', color: addPickMode === 'catalog' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Catálogo</button>
        <button onClick={() => { setAddPickMode('paste'); setAddPicked(null); }} className="cv-mono" style={{ flex: 1, fontSize: 13, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: addPickMode === 'paste' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: addPickMode === 'paste' ? 'rgba(var(--cv-accent-rgb),.10)' : 'transparent', color: addPickMode === 'paste' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Link</button>
      </div>
      {addPickMode === 'catalog' ? (
        <>
          <input className="cv-input" placeholder="Buscá en el catálogo…" value={addFilter} onChange={(e) => setAddFilter(e.target.value)} style={{ width: '100%', marginBottom: 8, fontSize: 16 }} />
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {addMatches.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>sin resultados.</div>}
            {addMatches.map((t) => {
              const sel = addPicked?.external_id === t.external_id;
              return (
                <button key={t.id} onClick={() => setAddPicked({ external_id: t.external_id || '', title: t.title, artist: t.artist || '', is_embeddable: true })} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: sel ? '1px solid var(--cv-mint)' : '1px solid transparent', background: sel ? 'rgba(var(--cv-accent-rgb),.10)' : 'rgba(255,255,255,.03)' }}>
                  <div style={{ fontSize: 15, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  {t.artist && <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)' }}>{t.artist}</div>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <input className="cv-input" placeholder="Pegá el link de YouTube y soltá" value={addPasteUrl} onChange={(e) => setAddPasteUrl(e.target.value)} onBlur={fetchAddPaste} style={{ width: '100%', fontSize: 16 }} />
          {addPasteMsg && <p className="cv-mono" style={{ marginTop: 8, fontSize: 13, color: addPasteMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{addPasteMsg}</p>}
        </>
      )}
      {addPicked && <div className="cv-mono" style={{ marginTop: 10, fontSize: 13, color: 'var(--cv-text-2)' }}>→ {addPicked.title}{addPicked.artist ? ` — ${addPicked.artist}` : ''}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="cv-btn cv-btn-ghost" onClick={() => setShowAdd(false)} style={{ padding: '12px 0', fontSize: 15, flex: 1 }}>Cancelar</button>
        <button className="cv-btn cv-btn-mint" onClick={doAdd} disabled={adding || !addSinger.trim() || !addPicked} style={{ padding: '12px 0', fontSize: 15, flex: 2, opacity: adding || !addSinger.trim() || !addPicked ? 0.5 : 1 }}>{adding ? 'Agregando…' : 'Agregar a la fila'}</button>
      </div>
    </>
  );

  return shell(
    <>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <BrandMark size={32} layout="row" />
          <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted)', marginTop: 2 }}>{venue.name}</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: mode === 'jukebox' ? 'var(--cv-cyan)' : 'var(--cv-mint)', boxShadow: mode === 'jukebox' ? '0 0 10px var(--cv-cyan)' : '0 0 10px var(--cv-mint)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
          <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: mode === 'jukebox' ? 'var(--cv-cyan)' : 'var(--cv-mint)' }}>CONTROL EN VIVO</span>
        </span>
      </div>

      {/* apariencia de la pantalla del local: paleta + termómetro */}
      <div className="cv-card" style={{ padding: '16px 18px', marginBottom: 12 }}>
        <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-muted-2)', marginBottom: 12 }}>PALETA DE LA PANTALLA</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
          {CV_THEME_META.map((t) => (
            <button key={t.id} onClick={() => pickTheme(t.id)} title={t.name} style={{ height: 36, borderRadius: 9, cursor: 'pointer', background: t.grad, border: theme === t.id ? '2px solid var(--cv-text)' : '2px solid var(--cv-line)', boxShadow: theme === t.id ? '0 0 10px rgba(var(--cv-accent-rgb),.4)' : 'none' }} />
          ))}
        </div>
        <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 9 }}>cambia el color de la pantalla del local al toque.</div>
        <div style={{ height: 1, background: 'var(--cv-line)', margin: '14px 0' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={energyOn} onChange={(e) => setEnergy(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--cv-accent)' }} />
          <span style={{ fontSize: 15, color: 'var(--cv-text)' }}>Mostrar termómetro de energía <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)' }}>(rockola)</span></span>
        </label>
        <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 6, marginLeft: 28 }}>apagalo si hay poca gente; en su lugar gira el vinilo del local.</div>
      </div>

      {mode === 'jukebox' ? (
        <>
          {/* aviso: cambiaron la playlist desde "mis locales" */}
          {pcPending && (
            <div className="cv-card" style={{ padding: '15px 16px', marginBottom: 12, border: '1px solid var(--cv-accent)', background: 'rgba(var(--cv-accent-rgb),.10)' }}>
              <div style={{ fontSize: 14.5, color: 'var(--cv-text)', marginBottom: 11, lineHeight: 1.4 }}>Cambiaron la playlist a <b style={{ color: 'var(--cv-accent)' }}>{pcPending}</b>. ¿La ponés ahora?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cv-btn cv-btn-cyan" onClick={jbSwitchPlaylist} style={{ flex: 1, padding: '13px 0', fontSize: 15 }}>Cambiar ahora</button>
                <button className="cv-btn cv-btn-ghost" onClick={() => setPcPending(null)} style={{ padding: '13px 18px', fontSize: 15 }}>Ahora no</button>
              </div>
            </div>
          )}
          {/* controles de la rockola (jukebox) */}
          <div className="cv-card" style={{ padding: '18px', marginBottom: 12 }}>
            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-cyan)', marginBottom: 14 }}>CONTROLES DE LA ROCKOLA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="cv-btn cv-btn-ghost" onClick={jbBack} style={{ padding: '15px 0', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ic name="prev" size={17} />Anterior</button>
              <button className="cv-btn cv-btn-cyan" onClick={jbPlayPause} style={{ padding: '15px 0', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{pcPlaying ? <><Ic name="pause" size={17} />Pausa</> : <><Ic name="play" size={17} />Play</>}</button>
              <button className={pcStopped ? 'cv-btn cv-btn-mint' : 'cv-btn cv-btn-ghost'} onClick={pcStopped ? jbResume : jbStop} style={{ padding: '15px 0', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{pcStopped ? <><Ic name="play" size={17} />Reanudar</> : <><Ic name="stop" size={16} />Detener</>}</button>
              <button className="cv-btn cv-btn-ghost" onClick={jbSkip} style={{ padding: '15px 0', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ic name="next" size={17} />Saltar</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <span style={{ width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cv-mut)' }}><Ic name={pcVolume === 0 ? 'mute' : 'volume'} size={20} /></span>
              <input type="range" min={0} max={100} value={pcVolume} onChange={(e) => jbVolume(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--cv-accent)', cursor: 'pointer' }} />
              <span className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', width: 30, textAlign: 'right' }}>{pcVolume}</span>
            </div>
            <button className="cv-btn cv-btn-ghost" onClick={jbCC} style={{ width: '100%', padding: '11px 0', fontSize: 13.5, marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ic name="cc" size={18} />Subtítulos on/off</button>
          </div>
          <div className="cv-card" style={{ padding: '18px', marginBottom: 12 }}>
            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-muted-2)', marginBottom: 16 }}>AJUSTES</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={jbAutoDj} onChange={(e) => jbSetAutoDj(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--cv-accent)' }} />
              <span style={{ fontSize: 15, color: 'var(--cv-text)' }}>AutoDJ cuando no hay votos</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 15, color: 'var(--cv-text)' }}>Segundos por canción <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)' }}>(0 = completa)</span></span>
              <input type="number" min={0} className="cv-input" value={jbSeconds} onChange={(e) => jbSetSeconds(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 80, padding: '10px', fontSize: 16, textAlign: 'center' }} />
            </div>
          </div>
          <p className="cv-mono" style={{ fontSize: 11.5, color: 'var(--cv-mono-2)', textAlign: 'center' }}>la música arrancala desde el PC; desde acá saltás, pausás y ajustás.</p>
        </>
      ) : (
        <>
          {/* cantando ahora */}
      <div className="cv-card" style={{ padding: '18px', textAlign: 'center', marginBottom: 12 }}>
        <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mint)' }}>CANTANDO AHORA</div>
        <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 700, color: 'var(--cv-text)', lineHeight: 1.15, marginTop: 4 }}>{current ? current.singer : 'nadie todavía'}</div>
        {current && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 3 }}>{current.title}{current.artist ? ` — ${current.artist}` : ''}</div>}
      </div>

      {/* controles grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginBottom: 10 }}>
        <button className="cv-btn cv-btn-ghost" onClick={goBack} disabled={!backAvailable || busy} style={{ padding: '16px 0', fontSize: 16, opacity: !backAvailable || busy ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ic name="prev" size={17} />Anterior</button>
        <button className="cv-btn cv-btn-mint" onClick={advance} disabled={(!current && waiting.length === 0) || busy} style={{ padding: '16px 0', fontSize: 16, opacity: (!current && waiting.length === 0) || busy ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{current ? <><Ic name="next" size={17} />Siguiente</> : <><Ic name="play" size={17} />Empezar</>}</button>
      </div>
      {current && (
        <button className="cv-btn cv-btn-ghost" onClick={togglePlay} style={{ width: '100%', padding: '14px 0', fontSize: 16, marginBottom: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{pcPlaying ? <><Ic name="pause" size={17} />Pausar</> : <><Ic name="play" size={17} />Reanudar</>}</button>
      )}
      {!current && waiting.length > 0 && (
        <p className="cv-mono" style={{ fontSize: 11.5, color: 'var(--cv-mono-2)', marginBottom: 12, textAlign: 'center' }}>el primer tema arrancalo desde el PC; después controlás todo desde acá.</p>
      )}

      {/* agregar */}
      <div className="cv-card" style={{ padding: showAdd ? '16px' : '12px', marginBottom: 12 }}>
        {!showAdd ? (
          <button className="cv-btn cv-btn-ghost" onClick={() => setShowAdd(true)} style={{ width: '100%', padding: '12px 0', fontSize: 15 }}>➕ Agregar cantante</button>
        ) : (
          <>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.14em', color: 'var(--cv-mint)', marginBottom: 12 }}>AGREGAR CANTANTE</div>
            {addFormBody}
          </>
        )}
      </div>

      {/* fila */}
      <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)', marginBottom: 10 }}>PRÓXIMOS TURNOS ({waiting.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {waiting.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>nadie en espera. Cuando se anoten, aparecen acá.</div>}
        {waiting.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', borderRadius: 12, background: 'var(--cv-surface)', border: '1px solid var(--cv-line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => moveOne(s.id, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 14, lineHeight: 1, padding: 0, opacity: i === 0 ? 0.4 : 1 }}>▲</button>
              <button onClick={() => moveOne(s.id, 1)} disabled={i === waiting.length - 1} style={{ background: 'none', border: 'none', cursor: i === waiting.length - 1 ? 'default' : 'pointer', color: i === waiting.length - 1 ? 'var(--cv-mono-2)' : 'var(--cv-muted)', fontSize: 14, lineHeight: 1, padding: 0, opacity: i === waiting.length - 1 ? 0.4 : 1 }}>▼</button>
            </div>
            <span className="cv-wordmark" style={{ fontSize: 17, fontWeight: 700, color: 'var(--cv-muted)', width: 22, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.singer}</div>
              <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}{s.artist ? ` — ${s.artist}` : ''}</div>
            </div>
            <button onClick={() => removeOne(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 19, flexShrink: 0, lineHeight: 1, padding: '4px' }}>✕</button>
          </div>
        ))}
      </div>
        </>
      )}

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <a href="/panel" className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic name="chevleft" size={13} />Volver al panel</a>
      </div>
    </>
  );
}
