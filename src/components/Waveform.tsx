'use client';
import React from 'react';

type WaveformProps = {
  /** número de barras */
  n?: number;
  /** color del tono (termómetro: violeta/cian/menta) */
  color?: string;
  /** altura máxima en px */
  maxH?: number;
  /** ancho de barra */
  barW?: number;
  /** separación entre barras */
  gap?: number;
  /** colapsa el centro N barras para hacer hueco al código de sala (solo consola) */
  notch?: number;
  /** semilla del ruido (fija = look estable, sin parpadeo en hidratación) */
  seed?: number;
  /** halo de neón en cada barra */
  glow?: boolean;
  style?: React.CSSProperties;
};

/**
 * Forma de onda de Carta Vibra.
 * Algoritmo determinista (PRNG con semilla) → server y cliente renderizan idéntico.
 * Cada barra ondula con cvWiggle; la amplitud crece con la "energía" (maxH).
 */
export default function Waveform({
  n = 64,
  color = '#00D4FF',
  maxH = 160,
  barW = 5,
  gap = 4,
  notch = 0,
  seed = 5,
  glow = true,
  style,
}: WaveformProps) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return ((s >> 8) / 0x800000) % 1;
  };

  const c = (n - 1) / 2;
  const bars: React.ReactNode[] = [];

  for (let i = 0; i < n; i++) {
    const env = 0.5 + 0.5 * Math.sin((Math.PI * i) / (n - 1));
    const noise = 0.55 + 0.45 * rnd();
    let h = maxH * env * noise;
    if (notch && Math.abs(i - c) <= notch) {
      const t = 1 - Math.abs(i - c) / notch;
      h = h * (1 - 0.92 * t);
    }
    h = Math.max(5, h);
    const dur = (1.1 + rnd() * 1.2).toFixed(2);

    bars.push(
      <div
        key={i}
        style={{
          width: barW,
          height: h,
          borderRadius: barW,
          background: color,
          transformOrigin: 'center',
          animation: `cvWiggle ${dur}s ease-in-out infinite`,
          animationDelay: `${(i * 0.025).toFixed(3)}s`,
          boxShadow: glow ? `0 0 10px ${color}55` : 'none',
          flexShrink: 0,
          opacity: 0.92,
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap, width: '100%', ...style }}>
      {bars}
    </div>
  );
}
