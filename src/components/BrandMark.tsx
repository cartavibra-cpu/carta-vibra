'use client';
import React from 'react';
import Vinyl from './Vinyl';

/**
 * Logo integrado de Carta Vibra: el wordmark "carta vibra" DENTRO del vinilo vivo.
 * Compacto y autocontenido — ideal para splash/headers donde el espacio manda.
 * Las cifras escalan con el tamaño del disco.
 */
export default function BrandMark({
  size = 200,
  glow = true,
  beat = true,
  style,
}: {
  size?: number;
  glow?: boolean;
  beat?: boolean;
  style?: React.CSSProperties;
}) {
  const cartaSize = Math.round(size * 0.052);
  const vibraSize = Math.round(size * 0.079);
  const dot = Math.max(5, Math.round(size * 0.024));

  return (
    <Vinyl
      size={size}
      glow={glow}
      beat={beat}
      style={style}
      label={
        <>
          <span className="cv-wordmark" style={{ fontWeight: 500, fontSize: cartaSize, letterSpacing: '.01em', lineHeight: 1 }}>
            carta
          </span>
          <span className="cv-wordmark cv-grad-text" style={{ fontWeight: 700, fontSize: vibraSize, letterSpacing: '-.01em', lineHeight: 1 }}>
            vibra
          </span>
          <div
            style={{
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: '#07060e',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)',
              marginTop: Math.round(size * 0.024),
            }}
          />
        </>
      }
    />
  );
}
