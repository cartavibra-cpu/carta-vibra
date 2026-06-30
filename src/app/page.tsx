'use client';
import { useState, useEffect } from 'react';
import { supa } from '@/lib/supabaseClient';
import Vinyl from '@/components/Vinyl';
import BrandMark from '@/components/BrandMark';
import Landing from '@/components/Landing';

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(var(--cv-accent-rgb),.2), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(var(--cv-accent-rgb),.1), transparent 60%), var(--cv-bg)';

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

  // ---------- Sin sesión: landing de presentación ----------
  if (!session) {
    return <Landing onLogin={handleLogin} />;
  }

  // ---------- Con sesión: home del dueño ----------
  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: STAGE_BG }}>
      <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 30%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>

        <BrandMark size={150} glow beat />

        <div style={{ textAlign: 'center' }}>
          <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)' }}>
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
