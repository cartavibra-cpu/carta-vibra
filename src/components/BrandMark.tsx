'use client';
import React from 'react';
import Vinyl from './Vinyl';

/**
 * Logo oficial de Carta Vibra: el disco vivo SIEMPRE presente.
 * - layout="stack" (default): el wordmark "carta vibra" va DENTRO del disco.
 *   Para splash, login, headers con aire (legible de ~80px para arriba).
 * - layout="row": disco chico + wordmark al lado. Para barras finitas / navs,
 *   donde el nombre adentro sería ilegible. El disco igual ancla la identidad.
 * Las cifras escalan con el tamaño del disco.
 */
export default function BrandMark({
  size = 200,
  layout = 'stack',
  glow = false,
  beat = false,
  style,
}: {
  size?: number;
  layout?: 'stack' | 'row';
  glow?: boolean;
  beat?: boolean;
  style?: React.CSSProperties;
}) {
  if (layout === 'row') {
    const font = Math.round(size * 0.56);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), ...style }}>
        <Vinyl size={size} mini />
        <span className="cv-wordmark" style={{ fontSize: font, fontWeight: 600, letterSpacing: '.005em', lineHeight: 1, whiteSpace: 'nowrap' }}>
          carta <span className="cv-grad-text">vibra</span>
        </span>
      </span>
    );
  }

  const cartaSize = Math.round(size * 0.078);
  const vibraSize = Math.round(size * 0.094);
  return (
    <Vinyl
      size={size}
      glow={glow}
      beat={beat}
      style={style}
      label={
        <div style={{ textAlign: 'center', lineHeight: 0.92 }}>
          <div className="cv-wordmark" style={{ fontWeight: 600, fontSize: cartaSize, letterSpacing: '.01em', color: 'var(--cv-text)' }}>
            carta
          </div>
          <div className="cv-wordmark cv-grad-text" style={{ fontWeight: 700, fontSize: vibraSize, letterSpacing: '.01em' }}>
            vibra
          </div>
        </div>
      }
    />
  );
}
