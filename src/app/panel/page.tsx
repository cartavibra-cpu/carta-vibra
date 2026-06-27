'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function PanelPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState('youtube_jukebox');

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/');
      else setSession(data.session);
    });
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb) return;
    const { data, error } = await sb.rpc('create_venue', { p_slug: slug, p_name: name, p_mode: mode });
    if (error) return alert(error.message);
    router.push(`/panel/venues/${data.slug}`);
    loadVenues(sb);
  };

  const loadVenues = async (sb: any) => {
    const { data } = await sb.from('venue').select('*');
    if (data) setVenues(data);
  };

  if (!session) return null;
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Panel del dueño</h1>
      <form onSubmit={handleCreate} className="mb-8 space-y-2">
        <input className="w-full border p-2" placeholder="Nombre del local" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full border p-2" placeholder="slug (sin espacios)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <select className="w-full border p-2" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="youtube_jukebox">YouTube Jukebox</option>
          <option value="youtube_karaoke">YouTube Karaoke</option>
          <option value="local_pro">Local Pro</option>
        </select>
        <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">Crear local</button>
      </form>
      <h2 className="mb-2 text-xl font-semibold">Mis locales</h2>
      <ul className="space-y-2">
        {venues.map((v) => (
          <li key={v.id} className="rounded border p-3">
            <a href={`/panel/venues/${v.slug}`} className="font-semibold">{v.name}</a> · {v.mode}
          </li>
        ))}
      </ul>
    </div>
  );
}
