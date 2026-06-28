'use client';
import { useState, useEffect } from 'react';
import { supa } from '@/lib/supabaseClient';
import Vinyl from '@/components/Vinyl';

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(94,46,255,.2), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(0,212,255,.1), transparent 60%), #07060e';

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

  // ---------- Cargando ----------
  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: STAGE_BG }}>
        <Vinyl size={56} mini />
        <div className="cv-mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em' }}>cargando…</div>
      </main>
    );
  }

  // ---------- Login (sin sesión) ----------
  if (!session) {
    return (
      <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
        <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 44%, rgba(255,255,255,.024) 0 1px, transparent 1px 30px)' }} />
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: 24 }}>

          <Vinyl size={188} glow beat />

          <div style={{ textAlign: 'center' }}>
            <div className="cv-wordmark" style={{ fontSize: 'clamp(42px, 9vw, 58px)' }}>
              carta <span className="cv-grad-text">vibra</span>
            </div>
            <div className="cv-mono" style={{ fontSize: 13, letterSpacing: '.05em', color: 'var(--cv-muted-2)', marginTop: 16 }}>
              La vibra se elige entre todos.
            </div>
          </div>

          <button onClick={handleLogin} className="cv-btn cv-btn-google" style={{ fontSize: 16, padding: '15px 30px' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'conic-gradient(from 0deg,#EA4335,#FBBC05,#34A853,#4285F4,#EA4335)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-text)' }} />
            </span>
            Entrar con Google
          </button>
        </div>
      </main>
    );
  }

  // ---------- Con sesión ----------
  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
      <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 30%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>

        <Vinyl size={120} glow beat />

        <div style={{ textAlign: 'center' }}>
          <div className="cv-wordmark" style={{ fontSize: 40 }}>
            carta <span className="cv-grad-text">vibra</span>
          </div>
          <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 12 }}>
            {session.user?.email}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <a href="/panel" className="cv-btn cv-btn-primary" style={{ fontSize: 16, padding: '15px 24px' }}>
            Ir a mi panel
          </a>
          <a href="/console" className="cv-btn cv-btn-ghost" style={{ fontSize: 15, padding: '14px 24px' }}>
            Abrir consola · pantalla del local
          </a>
        </div>

        <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--cv-font-body)', fontSize: 13, color: 'var(--cv-mono)', textDecoration: 'underline', marginTop: 4 }}>
          Salir
        </button>
      </div>
    </main>
  );
}
