'use client';
import { useEffect } from 'react';
import { logError } from '@/lib/logError';
import { Ic } from '@/components/Ic';

// Atrapa errores en el layout raíz (los más graves). Reemplaza TODO el documento,
// así que lleva su propio <html>/<body> y estilos en línea (no hay CSS garantizado).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('global-error', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07060e',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, color: '#9b8cff' }}><Ic name="sliders" size={44} /></div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Algo se desafinó</h1>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Ya quedó registrado. Probá recargar.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #00D4FF',
              background: 'transparent',
              color: '#00D4FF',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
