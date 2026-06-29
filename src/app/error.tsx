'use client';
import { useEffect } from 'react';
import { logError } from '@/lib/logError';

// Atrapa cualquier error de renderizado en las páginas (ej: el crash #310 que
// nos costó encontrar). Lo registra en Supabase y muestra una pantalla amable
// con botón de reintentar, en vez de dejar la pantalla en blanco.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('error-boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🎚️</div>
        <h1 className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, color: 'var(--cv-text)' }}>
          Algo se desafinó
        </h1>
        <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10, lineHeight: 1.6 }}>
          Tuvimos un problema cargando esta pantalla. Ya quedó registrado para revisarlo. Probá de nuevo.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={reset} className="cv-btn cv-btn-cyan" style={{ fontSize: 14, padding: '10px 20px' }}>
            Reintentar
          </button>
          <a href="/" className="cv-btn cv-btn-ghost" style={{ fontSize: 14, padding: '10px 20px', textDecoration: 'none' }}>
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}
