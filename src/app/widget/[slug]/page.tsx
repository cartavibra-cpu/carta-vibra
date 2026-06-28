'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { supa } from '@/lib/supabaseClient';
import Vinyl from '@/components/Vinyl';

type Track = { id: string; title: string; artist: string | null; external_id: string | null };
type Signup = { id: string; singer: string; title: string | null; artist: string | null; external_id: string | null; state: string; sort: number; session: string | null };
type Picked = { external_id: string; title: string; artist: string; is_embeddable: boolean };

const STAGE_BG = 'radial-gradient(520px 420px at 50% -5%, rgba(94,46,255,.22), transparent 62%), #07060e';

function getSession(): string {
  if (typeof window === 'undefined') return '';
  let s = localStorage.getItem('cv_session');
  if (!s) { s = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('cv_session', s); }
  return s;
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

function MiniEq() {
  const delays = [0, 0.2, 0.36, 0.12];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26 }}>
      {delays.map((d, i) => (
        <div key={i} style={{ width: 4, height: '100%', borderRadius: 2, transformOrigin: 'bottom', background: 'linear-gradient(180deg,#6EF3B2,#00D4FF)', animation: `cvEq ${(0.7 + i * 0.07).toFixed(2)}s ease-in-out infinite`, animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

export default function WidgetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [venue, setVenue] = useState<any>(null);
  const [mode, setMode] = useState<'jukebox' | 'karaoke'>('jukebox');
  const [activePl, setActivePl] = useState<{ id: string; name: string } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [nowId, setNowId] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [code, setCode] = useState('');
  const [mesa, setMesa] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // karaoke
  const [signups, setSignups] = useState<Signup[]>([]);
  const [singer, setSinger] = useState('');
  const [pickMode, setPickMode] = useState<'catalog' | 'paste'>('catalog');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [catFilter, setCatFilter] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [kMsg, setKMsg] = useState<string | null>(null);

  const session = typeof window !== 'undefined' ? getSession() : '';

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setMesa(p.get('mesa') || '');
  }, []);

  const loadVenue = useCallback(async () => {
    const sb = supa(); if (!sb) return;
    const { data: v } = await sb.from('venue').select('*').eq('slug', slug).single();
    setVenue(v);
    if (!v) return;
    const { data: asg } = await sb.from('venue_playlist_assignment')
      .select('playlist_id,section').eq('venue_id', v.id).eq('is_active', true).maybeSingle();
    const plId = (asg as { playlist_id: string; section: string } | null)?.playlist_id ?? null;
    const section = (asg as { section: string } | null)?.section ?? 'jukebox';
    setMode(section === 'karaoke' ? 'karaoke' : 'jukebox');
    if (!plId) { setActivePl(null); setTracks([]); return; }
    const { data: pl } = await sb.from('venue_playlist').select('id,name').eq('id', plId).maybeSingle();
    setActivePl((pl as any) || null);
    const { data: t } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('playlist_id', plId).eq('enabled', true).neq('is_embeddable', false).not('external_id', 'is', null);
    setTracks((t as Track[]) || []);
  }, [slug]);

  const loadLive = useCallback(async (venueId: string) => {
    const sb = supa(); if (!sb) return;
    const { data: q } = await sb.from('queue')
      .select('track_id,votes,state').eq('venue_id', venueId).in('state', ['queued', 'playing']);
    const map: Record<string, number> = {};
    (q as { track_id: string; votes: number }[] | null)?.forEach((r) => { map[r.track_id] = r.votes; });
    setVotes(map);
    const { data: np } = await sb.from('now_playing').select('track_id').eq('venue_id', venueId).maybeSingle();
    setNowId((np as any)?.track_id ?? null);
  }, []);

  const loadSignups = useCallback(async (venueId: string) => {
    const sb = supa(); if (!sb) return;
    const { data } = await sb.from('karaoke_signup')
      .select('id,singer,title,artist,external_id,state,sort,session')
      .eq('venue_id', venueId).in('state', ['waiting', 'singing']).order('sort');
    setSignups((data as Signup[]) || []);
  }, []);

  useEffect(() => { loadVenue(); }, [loadVenue]);

  useEffect(() => {
    if (!venue) return;
    loadLive(venue.id);
    loadSignups(venue.id);
    const sb = supa(); if (!sb) return;
    const ch = sb.channel('live-' + venue.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `venue_id=eq.${venue.id}` }, () => loadLive(venue.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `venue_id=eq.${venue.id}` }, () => loadLive(venue.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_playlist_assignment', filter: `venue_id=eq.${venue.id}` }, () => loadVenue())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karaoke_signup', filter: `venue_id=eq.${venue.id}` }, () => loadSignups(venue.id))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venue, loadLive, loadVenue, loadSignups]);

  const redeem = async () => {
    const sb = supa(); if (!sb || !venue) return;
    const { error } = await sb.rpc('redeem_room_code', { p_slug: slug, p_code: code.trim(), p_session: session, p_mesa: mesa || null });
    if (error) { setMsg(error.message); return; }
    setPresent(true); setMsg(mode === 'karaoke' ? '¡Listo! Ya podés anotarte.' : '¡Listo! Ya podés votar.'); setCode('');
  };

  const vote = async (trackId: string) => {
    const sb = supa(); if (!sb || !venue) return;
    const { error } = await sb.rpc('cast_vote', { p_slug: slug, p_track: trackId, p_mesa: mesa || null, p_session: session });
    if (error) {
      if (error.message.startsWith('PRESENCIA')) { setPresent(false); setMsg('Ingresá el código de la pantalla para votar.'); }
      else setMsg(error.message);
      return;
    }
    setPresent(true); setMsg(null);
  };

  // ---------- karaoke ----------
  const fetchPaste = async () => {
    if (!pasteUrl.trim()) return;
    const id = getYouTubeId(pasteUrl.trim());
    if (!id) { setPasteMsg('⚠️ Ese link de YouTube no es válido.'); setPicked(null); return; }
    setPasteMsg('Buscando…');
    try {
      const r = await fetch(`/api/youtube-meta?kind=video&url=${encodeURIComponent(pasteUrl.trim())}`);
      const data = await r.json();
      if (!r.ok) { setPasteMsg('⚠️ ' + (data.error || 'No se pudo leer')); setPicked(null); return; }
      if (data.embeddable === false) { setPasteMsg('⚠️ Ese video no se puede reproducir. Probá otra versión.'); setPicked(null); return; }
      setPicked({ external_id: id, title: data.title || 'Sin título', artist: data.artist || '', is_embeddable: true });
      setPasteMsg('✓ ' + (data.title || 'cargada'));
    } catch { setPasteMsg('⚠️ Error consultando YouTube'); setPicked(null); }
  };

  const anotarme = async () => {
    const sb = supa(); if (!sb || !venue || !picked) return;
    if (!singer.trim()) { setKMsg('Poné tu nombre o apodo.'); return; }
    const { data, error } = await sb.rpc('karaoke_signup', {
      p_slug: slug, p_singer: singer.trim(), p_source: 'youtube',
      p_external_id: picked.external_id, p_title: picked.title, p_artist: picked.artist,
      p_is_embeddable: picked.is_embeddable, p_session: session,
    });
    if (error) {
      if (error.message.startsWith('PRESENCIA')) { setPresent(false); setKMsg('Ingresá el código de la pantalla para anotarte.'); }
      else setKMsg(error.message);
      return;
    }
    setKMsg(`✓ ¡Anotado! Sos el N° ${data?.position ?? '?'} en la fila.`);
    setPicked(null); setPasteUrl(''); setPasteMsg(null); setCatFilter('');
  };

  const removeOwn = async (id: string) => {
    const sb = supa(); if (!sb) return;
    await sb.rpc('karaoke_remove_own', { p_id: id, p_session: session });
  };

  // ---------- Cargando ----------
  if (!venue) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: STAGE_BG }}>
        <Vinyl size={52} mini />
        <div className="cv-mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em' }}>cargando…</div>
      </main>
    );
  }

  const sorted = [...tracks].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0) || a.title.localeCompare(b.title));
  const nowTrack = tracks.find((t) => t.id === nowId);
  const catMatches = catFilter.trim()
    ? tracks.filter((t) => (t.title + ' ' + (t.artist || '')).toLowerCase().includes(catFilter.trim().toLowerCase()))
    : tracks;

  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
      <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 24%, rgba(255,255,255,.02) 0 1px, transparent 1px 26px)', opacity: 0.45 }} />
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', padding: '22px 16px 40px' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="cv-wordmark" style={{ fontSize: 18 }}>carta <span className="cv-grad-text">vibra</span></div>
          {mesa && <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted)', border: '1px solid var(--cv-line)', borderRadius: 999, padding: '5px 11px' }}>Mesa {mesa}</span>}
        </div>

        <h1 className="cv-wordmark" style={{ fontSize: 24, fontWeight: 600 }}>{venue.name}</h1>
        {activePl && (
          <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', marginTop: 4 }}>
            {mode === 'karaoke' ? <>🎤 Karaoke · <span style={{ color: 'var(--cv-mint)' }}>{activePl.name}</span></> : <>Suena: <span style={{ color: 'var(--cv-mint)' }}>{activePl.name}</span></>}
          </div>
        )}

        {!activePl ? (
          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--cv-muted)', textAlign: 'center', lineHeight: 1.6 }}>El local no tiene una playlist activa en este momento.</p>
        ) : mode === 'karaoke' ? (
          /* ════════ MODO KARAOKE ════════ */
          <>
            {!present && (
              <div className="cv-card" style={{ marginTop: 18, padding: 16 }}>
                <p style={{ fontSize: 14, color: 'var(--cv-text-2)', marginBottom: 12, lineHeight: 1.5 }}>Para anotarte a cantar, ingresá el código que aparece en la pantalla del local:</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="cv-input" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value)}
                    style={{ width: 120, textAlign: 'center', fontSize: 22, letterSpacing: '.3em', fontFamily: 'var(--cv-font-display)' }} />
                  <button className="cv-btn cv-btn-mint" style={{ fontSize: 15, padding: '0 22px' }} onClick={redeem}>Validar</button>
                </div>
                {msg && <p className="cv-mono" style={{ marginTop: 12, fontSize: 13, color: 'var(--cv-mint)' }}>{msg}</p>}
              </div>
            )}

            {present && (
              <div className="cv-card" style={{ marginTop: 18, padding: 16 }}>
                <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-mint)', marginBottom: 12 }}>ANOTARTE PARA CANTAR</div>

                <input className="cv-input" placeholder="Tu nombre o apodo" value={singer} onChange={(e) => setSinger(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />

                {/* selector de canción */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => { setPickMode('catalog'); setPicked(null); setPasteMsg(null); }} className="cv-mono"
                    style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 10, cursor: 'pointer', border: pickMode === 'catalog' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: pickMode === 'catalog' ? 'rgba(110,243,178,.10)' : 'transparent', color: pickMode === 'catalog' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Del catálogo</button>
                  <button onClick={() => { setPickMode('paste'); setPicked(null); }} className="cv-mono"
                    style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 10, cursor: 'pointer', border: pickMode === 'paste' ? '1px solid var(--cv-mint)' : '1px solid var(--cv-line)', background: pickMode === 'paste' ? 'rgba(110,243,178,.10)' : 'transparent', color: pickMode === 'paste' ? 'var(--cv-mint)' : 'var(--cv-muted)' }}>Pegar link</button>
                </div>

                {pickMode === 'catalog' ? (
                  <>
                    <input className="cv-input" placeholder="Buscá en el catálogo…" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: '100%', marginBottom: 8, fontSize: 13 }} />
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {catMatches.length === 0 && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono)' }}>sin resultados.</div>}
                      {catMatches.map((t) => {
                        const sel = picked?.external_id === t.external_id;
                        return (
                          <button key={t.id} onClick={() => setPicked({ external_id: t.external_id || '', title: t.title, artist: t.artist || '', is_embeddable: true })}
                            style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: sel ? '1px solid var(--cv-mint)' : '1px solid transparent', background: sel ? 'rgba(110,243,178,.10)' : 'rgba(255,255,255,.03)' }}>
                            <div style={{ fontSize: 14, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            {t.artist && <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)' }}>{t.artist}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <input className="cv-input" placeholder="Pegá el link de YouTube y soltá" value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} onBlur={fetchPaste} style={{ width: '100%', fontSize: 13 }} />
                    {pasteMsg && <p className="cv-mono" style={{ marginTop: 8, fontSize: 12, color: pasteMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{pasteMsg}</p>}
                  </>
                )}

                {picked && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(110,243,178,.08)', border: '1px solid rgba(110,243,178,.3)' }}>
                    <div className="cv-mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--cv-mint)' }}>VAS A CANTAR</div>
                    <div style={{ fontSize: 14, color: 'var(--cv-text)', marginTop: 2 }}>{picked.title}{picked.artist ? ` — ${picked.artist}` : ''}</div>
                  </div>
                )}

                <button className="cv-btn cv-btn-mint" onClick={anotarme} disabled={!singer.trim() || !picked}
                  style={{ width: '100%', marginTop: 14, fontSize: 15, padding: '12px 0', opacity: !singer.trim() || !picked ? 0.5 : 1 }}>
                  Anotarme en la fila
                </button>
                {kMsg && <p className="cv-mono" style={{ marginTop: 12, fontSize: 13, color: kMsg.startsWith('✓') ? 'var(--cv-mint)' : 'var(--cv-warm)' }}>{kMsg}</p>}
              </div>
            )}

            {/* la fila */}
            <div className="cv-mono" style={{ marginTop: 22, marginBottom: 12, fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)' }}>FILA PARA CANTAR ({signups.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signups.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>todavía no se anotó nadie. ¡Sé el primero!</div>}
              {signups.map((s, i) => {
                const mine = s.session === session;
                const singing = s.state === 'singing';
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: singing ? 'rgba(0,212,255,.10)' : mine ? 'rgba(110,243,178,.08)' : 'rgba(255,255,255,.03)', border: singing ? '1px solid rgba(0,212,255,.35)' : mine ? '1px solid rgba(110,243,178,.3)' : '1px solid rgba(255,255,255,.06)' }}>
                    <span className="cv-wordmark" style={{ fontSize: 15, fontWeight: 700, color: singing ? 'var(--cv-cyan)' : mine ? 'var(--cv-mint)' : 'var(--cv-muted)', width: 22, flexShrink: 0 }}>{singing ? '♪' : i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cv-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.singer}{mine && <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mint)' }}> · vos</span>}
                      </div>
                      <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}{s.artist ? ` — ${s.artist}` : ''}</div>
                    </div>
                    {mine && !singing && (
                      <button onClick={() => removeOwn(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 12 }}>sacarme</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="cv-mono" style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.05em', color: 'var(--cv-mono-2)', marginTop: 22, lineHeight: 1.6 }}>
              anotate, esperá tu turno y cantá · 🎤
            </div>
          </>
        ) : (
          /* ════════ MODO JUKEBOX (votación) ════════ */
          <>
            {/* sonando ahora */}
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(150deg, rgba(94,46,255,.18), rgba(0,212,255,.06))', border: '1px solid rgba(255,255,255,.10)', borderRadius: 18, padding: 14 }}>
              <Vinyl size={56} mini />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cv-mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--cv-cyan)' }}>SONANDO AHORA</div>
                <div className="cv-wordmark" style={{ fontSize: 17, fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nowTrack ? nowTrack.title : '—'}</div>
                {nowTrack?.artist && <div style={{ fontSize: 13, color: 'var(--cv-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nowTrack.artist}</div>}
              </div>
              {nowTrack && <MiniEq />}
            </div>

            {!present && (
              <div className="cv-card" style={{ marginTop: 18, padding: 16 }}>
                <p style={{ fontSize: 14, color: 'var(--cv-text-2)', marginBottom: 12, lineHeight: 1.5 }}>Para votar, ingresá el código que aparece en la pantalla del local:</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="cv-input" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value)}
                    style={{ width: 120, textAlign: 'center', fontSize: 22, letterSpacing: '.3em', fontFamily: 'var(--cv-font-display)' }} />
                  <button className="cv-btn cv-btn-cyan" style={{ fontSize: 15, padding: '0 22px' }} onClick={redeem}>Validar</button>
                </div>
              </div>
            )}

            {msg && <p className="cv-mono" style={{ marginTop: 14, fontSize: 13, color: 'var(--cv-cyan-light)' }}>{msg}</p>}

            <div className="cv-mono" style={{ marginTop: 22, marginBottom: 12, fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-muted-2)' }}>VOTÁ TU CANCIÓN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '10px 10px 10px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cv-wordmark" style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    {t.artist && <div style={{ fontSize: 12, color: 'var(--cv-muted-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                  </div>
                  <button className="cv-vote-btn" onClick={() => vote(t.id)}>
                    <span style={{ fontSize: 14, lineHeight: 1, color: 'var(--cv-mint)' }}>▲</span>
                    <span className="cv-wordmark" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{votes[t.id] || 0}</span>
                  </button>
                </div>
              ))}
              {sorted.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>la playlist activa no tiene canciones.</div>}
            </div>

            <div className="cv-mono" style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.05em', color: 'var(--cv-mono-2)', marginTop: 22, lineHeight: 1.6 }}>
              toca ▲ para sumar tu voto · la vibra se elige entre todos
            </div>
          </>
        )}
      </div>
    </main>
  );
}
