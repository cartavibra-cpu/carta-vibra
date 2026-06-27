'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supa } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const handle = async () => {
      const sb = supa();
      if (!sb) throw new Error('Supabase no configurado');
      await sb.auth.getSession();
      router.replace('/');
    };
    handle().catch(() => router.replace('/'));
  }, [router]);
  return (
    <div className="p-6">Procesando login...</div>
  );
}
