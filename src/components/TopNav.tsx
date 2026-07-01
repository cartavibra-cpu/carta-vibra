'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import { useIsMobile } from '@/lib/useIsMobile';
import BrandMark from '@/components/BrandMark';

/**
 * Barra de navegación para las pantallas del dueño (panel, panel del local).
 * No va en la consola (proyección) ni en el widget (celular del cliente).
 * El link "Admin" solo aparece para administradores.
 */
export default function TopNav() {
  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useIsMobile();

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

  const linkStyle: React.CSSProperties = { fontSize: 13, color: 'var(--cv-mut)', textDecoration: 'none' };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '8px 12px' : 12,
        padding: isMobile ? '11px 14px' : '13px 20px',
        background: 'rgba(7,6,14,.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--cv-hair)',
      }}
    >
      <a href="/panel" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <BrandMark size={isMobile ? 30 : 34} layout="row" />
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 16, flexWrap: 'wrap', justifyContent: isMobile ? 'space-between' : 'flex-end', flex: isMobile ? '1 1 100%' : '0 1 auto' }}>
        <a href="/panel" className="cv-mono" style={linkStyle}>{isMobile ? 'Locales' : 'Mis locales'}</a>
        <a href="/panel/playlists" className="cv-mono" style={linkStyle}>{isMobile ? 'Playlists' : 'Mis playlists'}</a>
        <a href="/panel/curadas" className="cv-mono" style={linkStyle}>Curadas</a>
        {isAdmin && <a href="/admin" className="cv-mono" style={{ ...linkStyle, color: 'var(--cv-accent)' }}>Admin</a>}
        {isAdmin && <a href="/admin/errores" className="cv-mono" style={{ ...linkStyle, color: 'var(--cv-accent)' }}>Errores</a>}
        <a href="/console" className="cv-mono" style={{ ...linkStyle, color: 'var(--cv-accent)' }}>Consola</a>
        <button onClick={signOut} className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>Salir</button>
      </div>
    </nav>
  );
}
