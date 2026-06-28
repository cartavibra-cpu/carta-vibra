'use client';
import { supa } from '@/lib/supabaseClient';

/**
 * Barra de navegación para las pantallas del dueño (panel, panel del local).
 * No va en la consola (proyección) ni en el widget (celular del cliente).
 */
export default function TopNav() {
  const signOut = async () => {
    const sb = supa();
    if (sb) await sb.auth.signOut();
    window.location.href = '/';
  };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 20px',
        background: 'rgba(7,6,14,.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--cv-line)',
      }}
    >
      <a href="/panel" className="cv-wordmark" style={{ fontSize: 19, textDecoration: 'none' }}>
        carta <span className="cv-grad-text">vibra</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <a href="/panel" className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', textDecoration: 'none' }}>Mis locales</a>
        <a href="/panel/playlists" className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', textDecoration: 'none' }}>Mis playlists</a>
        <a href="/panel/curadas" className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', textDecoration: 'none' }}>Curadas</a>
        <a href="/console" className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-cyan)', textDecoration: 'none' }}>Consola</a>
        <button onClick={signOut} className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted-2)', background: 'none', border: 'none', cursor: 'pointer' }}>Salir</button>
      </div>
    </nav>
  );
}
