'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { supa } from '@/lib/supabaseClient';

type Track = { id: string; title: string; artist: string | null; external_id: string | null };

function getSession(): string {
  if (typeof window === 'undefined') return '';
  let s = localStorage.getItem('cv_session');
  if (!s) { s = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('cv_session', s); }
  return s;
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
      .select('id,title,artist,external_id').eq('playlist_id', (pl as any).id).eq('enabled', true).neq('is_embeddable', false);
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

  if (!venue) return <div className="p-6">Cargando…</div>;

  const sorted = [...tracks].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0) || a.title.localeCompare(b.title));
  const nowTrack = tracks.find((t) => t.id === nowId);

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="text-xl font-bold">{venue.name}</h1>
      {activePl && <p className="text-xs text-gray-500">Playlist: {activePl.name}{mesa ? ` · Mesa ${mesa}` : ''}</p>}

      <div className="my-3 rounded-lg bg-gray-100 p-3">
        <p className="text-xs uppercase text-gray-500">Sonando ahora</p>
        <p className="font-semibold">{nowTrack ? `${nowTrack.title}${nowTrack.artist ? ' — ' + nowTrack.artist : ''}` : '—'}</p>
      </div>

      {!activePl ? (
        <p className="my-4 text-sm text-gray-600">El local no tiene una playlist activa en este momento.</p>
      ) : (
        <>
          {!present && (
            <div className="my-3 rounded-lg border p-3">
              <p className="mb-2 text-sm">Para votar, ingresá el código que aparece en la pantalla del local:</p>
              <div className="flex gap-2">
                <input className="w-28 rounded border p-2 text-center text-lg tracking-widest" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={redeem}>Validar</button>
              </div>
            </div>
          )}

          {msg && <p className="my-2 text-sm text-blue-700">{msg}</p>}

          <h2 className="mt-4 mb-2 font-semibold">Votá tu canción</h2>
          <ul className="space-y-2">
            {sorted.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border p-2">
                <span>{t.title}{t.artist ? <span className="text-gray-500"> — {t.artist}</span> : null}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{votes[t.id] || 0} ▲</span>
                  <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => vote(t.id)}>Votar</button>
                </span>
              </li>
            ))}
            {sorted.length === 0 && <li className="text-sm text-gray-500">La playlist activa no tiene canciones.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
