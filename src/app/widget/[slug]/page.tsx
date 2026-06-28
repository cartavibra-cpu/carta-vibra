'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { supa } from '@/lib/supabaseClient';
import Vinyl from '@/components/Vinyl';

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

const STAGE_BG = 'radial-gradient(520px 420px at 50% -5%, rgba(94,46,255,.22), transparent 62%), #07060e';

function getSession(): string {
  if (typeof window === 'undefined') return '';
  let s = localStorage.getItem('cv_session');
  if (!s) { s = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('cv_session', s); }
  return s;
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
  const [activePl, setActivePl] = useState<{ id: string; name: string } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [nowId, setNowId] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [code, setCode] = useState('');
  const [mesa, setMesa] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

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
    const { data: pl } = await sb.from('venue_playlist').select('id,name').eq('venue_id', v.id).eq('is_active', true).maybeSingle();
    setActivePl((pl as any) || null);
    if (!pl) { setTracks([]); return; }
    const { data: t } = await sb.from('catalog_track')
      .select('id,title,artist,external_id').eq('playlist_id', (pl as any).id).eq('enabled', true).neq('is_embeddable', false).not('external_id', 'is', null);
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

  useEffect(() => { loadVenue(); }, [loadVenue]);

  useEffect(() => {
    if (!venue) return;
    loadLive(venue.id);
    const sb = supa(); if (!sb) return;
    const ch = sb.channel('live-' + venue.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `venue_id=eq.${venue.id}` }, () => loadLive(venue.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `venue_id=eq.${venue.id}` }, () => loadLive(venue.id))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venue, loadLive]);

  const redeem = async () => {
    const sb = supa(); if (!sb || !venue) return;
    const { error } = await sb.rpc('redeem_room_code', { p_slug: slug, p_code: code.trim(), p_session: session, p_mesa: mesa || null });
    if (error) { setMsg(error.message); return; }
    setPresent(true); setMsg('¡Listo! Ya podés votar.'); setCode('');
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
        {activePl && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-muted-2)', marginTop: 4 }}>Suena: <span style={{ color: 'var(--cv-mint)' }}>{activePl.name}</span></div>}

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

        {!activePl ? (
          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--cv-muted)', textAlign: 'center', lineHeight: 1.6 }}>El local no tiene una playlist activa en este momento.</p>
        ) : (
          <>
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
