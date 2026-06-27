import { NextRequest, NextResponse } from 'next/server';

function extractVideoId(input: string): string | null {
  const s = (input || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split(/[?/]/)[0] || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split(/[?/]/)[0] || null;
    return null;
  } catch {
    return null;
  }
}

function extractPlaylistId(input: string): string | null {
  try {
    const u = new URL((input || '').trim());
    return u.searchParams.get('list');
  } catch {
    return null;
  }
}

function cleanArtist(channelTitle: string): string {
  return (channelTitle || '').replace(/\s*-\s*Topic$/i, '').trim();
}

export async function GET(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY no configurada en el servidor.' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || '';
  const kind = searchParams.get('kind') || 'video';

  try {
    if (kind === 'playlist') {
      const playlistId = extractPlaylistId(url);
      if (!playlistId) {
        return NextResponse.json({ error: 'No reconocí una playlist de YouTube en esa URL.' }, { status: 400 });
      }
      const raw: { videoId: string; title: string; artist: string }[] = [];
      let pageToken = '';
      do {
        const api = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&pageToken=${pageToken}&key=${key}`;
        const r = await fetch(api);
        const data: any = await r.json();
        if (data.error) {
          return NextResponse.json({ error: data.error.message || 'Error de YouTube' }, { status: 400 });
        }
        for (const it of data.items || []) {
          const s = it.snippet;
          const vid = s?.resourceId?.videoId;
          if (vid && s.title !== 'Deleted video' && s.title !== 'Private video') {
            raw.push({ videoId: vid, title: s.title, artist: cleanArtist(s.videoOwnerChannelTitle || '') });
          }
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken && raw.length < 200);

      // Chequear reproducibilidad (endpoint videos, en lotes de 50)
      const embeddable: Record<string, boolean> = {};
      const ids = raw.map((t) => t.videoId);
      for (let i = 0; i < ids.length; i += 50) {
        const batchIds = ids.slice(i, i + 50);
        const r2 = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${batchIds.join(',')}&key=${key}`);
        const d2: any = await r2.json();
        if (d2.error || !d2.items) {
          batchIds.forEach((id) => { embeddable[id] = true; }); // si falla el chequeo, no bloqueamos
          continue;
        }
        const returned = new Set<string>();
        for (const it of d2.items) {
          embeddable[it.id] = it.status?.embeddable !== false;
          returned.add(it.id);
        }
        // los que no volvieron están borrados / no disponibles
        batchIds.forEach((id) => { if (!returned.has(id)) embeddable[id] = false; });
      }

      const tracks = raw.map((t) => ({ ...t, embeddable: embeddable[t.videoId] !== false }));
      return NextResponse.json({ type: 'playlist', tracks });
    }

    // kind === 'video'
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'No reconocí un video de YouTube en esa URL.' }, { status: 400 });
    }
    const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${key}`;
    const r = await fetch(api);
    const data: any = await r.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message || 'Error de YouTube' }, { status: 400 });
    }
    const item = data.items?.[0];
    if (!item) {
      return NextResponse.json({ error: 'Video no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({
      type: 'video',
      videoId,
      title: item.snippet?.title || '',
      artist: cleanArtist(item.snippet?.channelTitle || ''),
      embeddable: item.status?.embeddable !== false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error consultando YouTube.' }, { status: 500 });
  }
}
