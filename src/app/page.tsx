'use client';
import { useState, useEffect } from 'react';
import { supa } from '@/lib/supabaseClient';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supa();
    if (!sb) { setLoading(false); return; }
    sb.auth.getSession().then(({ data }: any) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
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
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-black">Carta Vibra</h1>
          <p className="text-gray-600">Tu rockola DJ digital</p>
          <button onClick={handleLogin} className="rounded bg-blue-600 px-6 py-3 text-white">
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Carta Vibra</h1>
        <p className="text-sm text-gray-600">{session.user.email}</p>
        <div className="flex flex-col gap-2">
          <a href="/panel" className="rounded bg-blue-600 px-6 py-3 text-white">Ir a mi panel</a>
          <a href="/console" className="rounded bg-gray-800 px-6 py-3 text-white">Abrir consola (pantalla del local)</a>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 underline">Salir</button>
      </div>
    </div>
  );
}
