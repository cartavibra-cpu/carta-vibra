'use client';
import { useState, useEffect } from 'react';
import { supa } from '@/lib/supabaseClient';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleLogin = async () => {
    const sb = supa();
    if (!sb) return alert('Supabase no configurado');
    await sb.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleLogout = async () => {
    const sb = supa();
    if (!sb) return;
    await sb.auth.signOut();
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Cargando...</div>;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button
          onClick={handleLogin}
          className="rounded bg-blue-600 px-6 py-3 text-white"
        >
          Entrar con Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl">Panel Carta Vibra</h1>
        <p>{session.user.email}</p>
        <button onClick={handleLogout} className="rounded bg-gray-700 px-4 py-2 text-white">Salir</button>
      </div>
    </div>
  );
}
