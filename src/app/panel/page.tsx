'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

export default function PanelPage() {
  const [session, setSession] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState('youtube_jukebox');

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    const { data } = await sb.from('venue').select('*').order('created_at', { ascending: false });
    if (Array.isArray(data)) setVenues(data);
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa();
    if (!sb) return;
    const { data, error } = await sb.rpc('create_venue', { p_slug: slug, p_name: name, p_mode: mode });
    if (error) return alert(error.message);
    window.location.href = `/panel/venues/${encodeURIComponent(data.slug)}`;
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <p>Necesitás iniciar sesión para acceder al panel.</p>
          <a className="inline-block rounded bg-blue-600 px-4 py-2 text-white" href="/">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Panel del dueño</h1>

      <form onSubmit={handleCreate} className="space-y-2">
        <input
          className="w-full border p-2"
          placeholder="Nombre del local"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full border p-2"
          placeholder="slug (sin espacios)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <select
          className="w-full border p-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
        >
          <option value="youtube_jukebox">YouTube Jukebox</option>
          <option value="youtube_karaoke">YouTube Karaoke</option>
          <option value="local_pro">Local Pro</option>
        </select>
        <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">
          Crear local
        </button>
      </form>

      <section>
        <h2 className="text-xl font-semibold">Mis locales</h2>
        <ul className="mt-2 space-y-2">
          {venues.map((v) => (
            <li key={v.id} className="rounded border p-3">
              <a className="font-semibold" href={`/panel/venues/${encodeURIComponent(v.slug)}`}>
                {v.name}
              </a>
              <span className="ml-2 text-sm text-gray-600">{v.mode}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
