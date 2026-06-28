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

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
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
    if (kind === 'search') {
      const q = (searchParams.get('q') || '').trim();
      if (q.length < 2) {
        return NextResponse.json({ error: 'Escribí algo para buscar.' }, { status: 400 });
      }
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // 1) caché (no gasta cuota)
      if (supaUrl && supaKey) {
        try {
          const cr = await fetch(`${supaUrl}/rest/v1/rpc/yt_cache_get`, {
            method: 'POST',
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_q: q }),
          });
          if (cr.ok) {
            const cached: any = await cr.json();
            if (Array.isArray(cached) && cached.length) {
              return NextResponse.json({ type: 'search', results: cached, cached: true });
            }
          }
        } catch { /* si falla el caché, seguimos a YouTube */ }
      }

      // 2) YouTube search.list (100 unidades de cuota)
      const api = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&videoEmbeddable=true&q=${encodeURIComponent(q)}&key=${key}`;
      const r = await fetch(api);
      const data: any = await r.json();
      if (data.error) {
        const reason = data.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          return NextResponse.json({ error: 'quota', message: 'Se acabó la cuota de búsqueda por hoy.' }, { status: 429 });
        }
        return NextResponse.json({ error: data.error.message || 'Error de YouTube' }, { status: 400 });
      }
      const results = (data.items || [])
        .map((it: any) => ({
          videoId: it.id?.videoId,
          title: decodeEntities(it.snippet?.title || ''),
          artist: decodeEntities(cleanArtist(it.snippet?.channelTitle || '')),
        }))
        .filter((x: any) => x.videoId);

      // 3) guardar en caché
      if (supaUrl && supaKey && results.length) {
        try {
          await fetch(`${supaUrl}/rest/v1/rpc/yt_cache_put`, {
            method: 'POST',
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_q: q, p_results: results }),
          });
        } catch { /* el caché es best-effort */ }
      }
      return NextResponse.json({ type: 'search', results });
    }

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

      // Chequear reproducibilidad REAL (en lotes de 50). No alcanza con "embeddable":
      // también descartamos restricción de edad y videos no disponibles/borrados,
      // porque YouTube marca embeddable=true en videos que igual no se reproducen.
      const playableMap: Record<string, boolean> = {};
      const ids = raw.map((t) => t.videoId);
      for (let i = 0; i < ids.length; i += 50) {
        const batchIds = ids.slice(i, i + 50);
        const r2 = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${batchIds.join(',')}&key=${key}`);
        const d2: any = await r2.json();
        if (d2.error || !d2.items) {
          batchIds.forEach((id) => { playableMap[id] = true; }); // si falla el chequeo, no bloqueamos
          continue;
        }
        const returned = new Set<string>();
        for (const it of d2.items) {
          const emb = it.status?.embeddable !== false;
          const ageRestricted = it.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted';
          const available = it.status?.uploadStatus !== 'rejected' && it.status?.privacyStatus !== 'private';
          playableMap[it.id] = emb && !ageRestricted && available;
          returned.add(it.id);
        }
        // los que no volvieron están borrados / no disponibles
        batchIds.forEach((id) => { if (!returned.has(id)) playableMap[id] = false; });
      }

      const tracks = raw.map((t) => {
        const ok = playableMap[t.videoId] !== false;
        return { ...t, embeddable: ok, playable: ok };
      });
      return NextResponse.json({ type: 'playlist', tracks });
    }

    // kind === 'video'
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'No reconocí un video de YouTube en esa URL.' }, { status: 400 });
    }
    const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${videoId}&key=${key}`;
    const r = await fetch(api);
    const data: any = await r.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message || 'Error de YouTube' }, { status: 400 });
    }
    const item = data.items?.[0];
    if (!item) {
      return NextResponse.json({ error: 'Video no encontrado.' }, { status: 404 });
    }
    const emb = item.status?.embeddable !== false;
    const ageRestricted = item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted';
    const playable = emb && !ageRestricted;
    return NextResponse.json({
      type: 'video',
      videoId,
      title: item.snippet?.title || '',
      artist: cleanArtist(item.snippet?.channelTitle || ''),
      embeddable: playable,
      playable,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error consultando YouTube.' }, { status: 500 });
  }
}
