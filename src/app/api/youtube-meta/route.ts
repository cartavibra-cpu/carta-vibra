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
      const tracks: { videoId: string; title: string; artist: string }[] = [];
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
            tracks.push({ videoId: vid, title: s.title, artist: cleanArtist(s.videoOwnerChannelTitle || '') });
          }
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken && tracks.length < 200);

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
