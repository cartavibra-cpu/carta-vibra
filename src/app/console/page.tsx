'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

export default function ConsolePage() {
  const [status, setStatus] = useState<any>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('console_device_token') : null;
    if (token) {
      pollStatus(token);
    } else {
      startPairing();
    }
  }, []);

  const startPairing = async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = supa();
      if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_request_pairing');
      if (error) throw error;
      const { device_token, pairing_code } = data;
      localStorage.setItem('console_device_token', device_token);
      setCode(pairing_code);
      pollStatus(device_token);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  };

  const pollStatus = async (token: string) => {
    setLoading(true);
    try {
      const sb = supa();
      if (!sb) throw new Error('Supabase no configurado');
      const { data, error } = await sb.rpc('console_status', { p_token: token });
      if (error) throw error;
      setStatus(data);
      setLoading(false);
      if (!data.paired) {
        setTimeout(() => pollStatus(token), 2000);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-red-600">Error: {error}</p>
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={startPairing}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (loading && !status?.paired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-black">Emparejando consola...</h1>
        {code && (
          <div className="rounded-2xl border-4 border-black bg-white p-8">
            <p className="mb-2 text-center text-lg font-semibold">Código de sala</p>
            <p className="text-center text-6xl font-black">{code}</p>
          </div>
        )}
        <p className="text-sm text-gray-600">Ingresá este código en el panel del dueño para vincular esta consola.</p>
      </div>
    );
  }

  if (status?.paired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Consola lista</h1>
        <p className="text-lg">Local: {status.name}</p>
        <p className="text-sm text-gray-600">{status.slug}</p>
        <pre className="rounded bg-gray-100 p-4 text-xs">{JSON.stringify(status, null, 2)}</pre>
      </div>
    );
  }

  return <div className="flex min-h-screen items-center justify-center">Cargando...</div>;
}
