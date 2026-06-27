'use client';
import { useEffect, useState } from 'react';
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

export default function VenuePanelPage({ params }: { params: { slug: string } }) {
  const [venue, setVenue] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [qr, setQr] = useState('');
  const [mesa, setMesa] = useState('1');
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState<string | null>(null);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb || !venue) return;
    const trimmed = pairCode.trim();
    if (!trimmed) return;
    const { data, error } = await sb.rpc('console_confirm_pairing', { p_code: trimmed, p_venue: venue.id });
    if (error) {
      setPairMsg(error.message);
      return;
    }
    setPairMsg(data?.message ? 'Vinculación OK' : 'Vinculación enviada');
    setPairCode('');
  };

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    const { data: v } = await sb.from('venue').select('*').eq('slug', params.slug).single();
    setVenue(v);
    const { data: t } = await sb.from('catalog_track').select('*').eq('venue_id', v.id);
    setTracks(t || []);
    const qrUrl = `/widget/${params.slug}?mesa=${mesa}`;
    QRCode.toDataURL(qrUrl, { width: 400 }).then(setQr);
  };

  useEffect(() => { load(); }, [params.slug, mesa]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb || !venue) return;
    const videoId = getYouTubeId(url);
    if (!videoId) return alert('URL de YouTube inválida');
    const { error } = await sb.from('catalog_track').insert({
      venue_id: venue.id,
      source: 'youtube',
      external_id: videoId,
      title: title || 'Sin título',
      artist,
      is_embeddable: true,
    });
    if (error) return alert(error.message);
    setUrl('');
    setTitle('');
    setArtist('');
    load();
  };

  if (!venue) return <div className="p-6">Cargando local...</div>;
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-bold">{venue.name}</h1>
      <p className="mb-4 text-sm text-gray-600">Modo: {venue.mode}</p>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Cargar canción YouTube</h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <input className="w-full border p-2" placeholder="URL del video" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="w-full border p-2" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="w-full border p-2" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">Agregar</button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">QR para clientes</h2>
        <div className="flex items-center gap-4">
          <img src={qr} alt="QR" className="h-40 w-40" />
          <div>
            <p>Mesa:</p>
            <input className="w-20 border p-1" value={mesa} onChange={(e) => setMesa(e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Catálogo</h2>
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li key={t.id} className="rounded border p-2">{t.title} - {t.artist}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
