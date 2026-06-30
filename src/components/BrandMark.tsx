'use client';
import React from 'react';
import Vinyl from './Vinyl';

/** "vibra" con la Onda (cada letra anima con su delay). */
function Vibra({ still = false }: { still?: boolean }) {
  return (
    <span className="vibra">
      {['v', 'i', 'b', 'r', 'a'].map((c, i) => (
        <span key={i} className="ch" style={{ ['--i' as string]: i } as React.CSSProperties}>
          {c}
        </span>
      ))}
    </span>
  );
}

/**
 * Logo oficial de Carta Vibra: el disco vivo SIEMPRE presente.
 * - layout="stack" (default): el wordmark "carta vibra" va DENTRO del disco.
 * - layout="row": disco chico + wordmark vivo (Syne + Onda) al lado. Para navs.
 * El color del wordmark sigue el tema activo (--cv-theme-grad).
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
        <span className="cv-wm" style={{ fontSize: font }}>
          <span className="carta">carta</span>
          <Vibra />
        </span>
      </span>
    );
  }

  const cartaSize = Math.round(size * 0.082);
  const vibraSize = Math.round(size * 0.10);
  return (
    <Vinyl
      size={size}
      glow={glow}
      beat={beat}
      style={style}
      label={
        <div style={{ textAlign: 'center', lineHeight: 0.92 }}>
          <div className="cv-wordmark" style={{ fontWeight: 700, fontSize: cartaSize, letterSpacing: '.005em', color: 'var(--cv-ink)' }}>
            carta
          </div>
          <div className="cv-wordmark cv-grad-theme" style={{ fontWeight: 800, fontSize: vibraSize, letterSpacing: '.005em' }}>
            vibra
          </div>
        </div>
      }
    />
  );
}
