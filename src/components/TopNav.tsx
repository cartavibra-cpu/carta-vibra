'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';

/**
 * Barra de navegación para las pantallas del dueño (panel, panel del local).
 * No va en la consola (proyección) ni en el widget (celular del cliente).
 * El link "Admin" solo aparece para administradores.
 */
export default function TopNav() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data, error } = await sb.rpc('is_admin');
      if (!error) setIsAdmin(data === true);
    })();
  }, []);

  const signOut = async () => {
    const sb = supa();
    if (sb) await sb.auth.signOut();
    window.location.href = '/';
  };

  const linkStyle: React.CSSProperties = { fontSize: 13, color: 'var(--cv-muted)', textDecoration: 'none' };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 20px',
        background: 'rgba(7,6,14,.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--cv-line)',
      }}
    >
      <a href="/panel" className="cv-wordmark" style={{ fontSize: 19, textDecoration: 'none', flexShrink: 0 }}>
        carta <span className="cv-grad-text">vibra</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <a href="/panel" className="cv-mono" style={linkStyle}>Mis locales</a>
        <a href="/panel/playlists" className="cv-mono" style={linkStyle}>Mis playlists</a>
        <a href="/panel/curadas" className="cv-mono" style={linkStyle}>Curadas</a>
        {isAdmin && <a href="/admin" className="cv-mono" style={{ ...linkStyle, color: 'var(--cv-violet-light)' }}>Admin</a>}
        <a href="/console" className="cv-mono" style={{ ...linkStyle, color: 'var(--cv-cyan)' }}>Consola</a>
        <button onClick={signOut} className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted-2)', background: 'none', border: 'none', cursor: 'pointer' }}>Salir</button>
      </div>
    </nav>
  );
}
