import React from 'react';
import { type Skin } from '@/lib/skins';

// Geometría de la "pantalla" (el hueco del video). DEBE coincidir con el videoBox
// del modo marco en las consolas para que la decoración calce alrededor del video.
export const FRAME_SCREEN: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(82vw, calc(82vh * 16 / 9))',
  aspectRatio: '16 / 9',
};

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function shade(hex: string, f: number): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Tubo lateral con burbujas que suben (pilar de la rockola). */
function Pillar({ side, c }: { side: 'left' | 'right'; c: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '15vh',
        bottom: '15vh',
        [side]: '2.4vw',
        width: 'clamp(10px, 1vw, 20px)',
        borderRadius: '1vw',
        overflow: 'hidden',
        background: `linear-gradient(${shade(c, 0.45)}, ${rgba(c, 0.22)})`,
        border: `1px solid ${rgba(c, 0.55)}`,
        boxShadow: `0 0 2.4vh ${rgba(c, 0.55)}, inset 0 0 1vh ${rgba(c, 0.45)}`,
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '-12%',
            width: '46%',
            aspectRatio: '1',
            borderRadius: '50%',
            background: rgba(c, 0.85),
            boxShadow: `0 0 6px ${rgba(c, 0.9)}`,
            animation: `cvBubble ${2.6 + i * 0.55}s linear ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** Vinilo que gira, asomando por detrás del borde de la pantalla. */
function FrameVinyl({ pos, c }: { pos: 'left' | 'right'; c: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        [pos]: 0,
        transform: `translate(${pos === 'left' ? '-52%' : '52%'}, -50%)`,
        width: 'clamp(120px, 21vh, 280px)',
        aspectRatio: '1',
        borderRadius: '50%',
        overflow: 'hidden',
        animation: 'cvSpin 4.5s linear infinite',
        background:
          'repeating-radial-gradient(circle at center, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 6px), radial-gradient(circle, #1c1626, #0b0913 70%)',
        boxShadow: 'inset 0 0 4vh rgba(0,0,0,.85), 0 1.4vh 4vh rgba(0,0,0,.6)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '34%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 38% 30%, ${c}, ${shade(c, 0.42)})`,
          boxShadow: `0 0 2vh ${rgba(c, 0.5)}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '46.5%',
          borderRadius: '50%',
          background: '#07060e',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2)',
        }}
      />
    </div>
  );
}

/** Barra de grilla / ecualizador (header arriba, consola abajo). */
function Bar({ where, c, eq }: { where: 'top' | 'bottom'; c: string; eq: boolean }) {
  const pos: React.CSSProperties =
    where === 'top'
      ? { bottom: '100%', marginBottom: '2.2vh' }
      : { top: '100%', marginTop: '2.2vh' };
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        ...pos,
        width: '32%',
        height: '5.4vh',
        borderRadius: '1vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.42vw',
        background: rgba(c, 0.07),
        border: `1px solid ${rgba(c, 0.5)}`,
        boxShadow: `0 0 2.4vh ${rgba(c, 0.5)}, inset 0 0 1.4vh ${rgba(c, 0.18)}`,
      }}
    >
      {Array.from({ length: eq ? 26 : 28 }).map((_, i) =>
        eq ? (
          <div
            key={i}
            style={{
              width: 'clamp(3px, 0.45vw, 6px)',
              height: '62%',
              borderRadius: 3,
              background: c,
              transformOrigin: 'center',
              animation: `cvEq ${0.7 + (i % 5) * 0.17}s ease-in-out ${(i % 7) * 0.1}s infinite`,
            }}
          />
        ) : (
          <div
            key={i}
            style={{
              width: 2,
              height: '52%',
              borderRadius: 2,
              background: rgba(c, 0.5),
            }}
          />
        )
      )}
    </div>
  );
}

/**
 * Marco de rockola dibujado en código (sin fotos): se anima, nunca se deforma,
 * escala a cualquier TV. Va DETRÁS del video (z-index 0); el video lo tapa en el
 * centro y la decoración asoma alrededor.
 */
export default function RockolaFrame({ skin, tone }: { skin: Skin; tone?: string }) {
  const c = tone ?? skin.accent; // un solo tono: jukebox=accent (cyan/ámbar), karaoke=accent2 (mint/oro)
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* glow de sala */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(62vw 46vh at 50% 44%, ${rgba(c, 0.13)}, transparent 72%)`,
        }}
      />
      {/* pilares con burbujas */}
      <Pillar side="left" c={c} />
      <Pillar side="right" c={c} />

      {/* referencia de la pantalla: la decoración cuelga de acá */}
      <div style={FRAME_SCREEN}>
        {/* vinilos girando, asomando por los costados */}
        <FrameVinyl pos="left" c={c} />
        <FrameVinyl pos="right" c={c} />

        {/* resplandor que late al beat (detrás del borde) */}
        <div
          style={{
            position: 'absolute',
            inset: '-1.4vh',
            borderRadius: '2vh',
            boxShadow: `0 0 5vh ${rgba(c, 0.55)}`,
            animation: 'cvGlow var(--cv-beat, .66s) ease-in-out infinite',
          }}
        />
        {/* borde neón crisp que respira */}
        <div
          style={{
            position: 'absolute',
            inset: '-1.4vh',
            borderRadius: '2vh',
            border: `0.35vh solid ${c}`,
            boxShadow: `inset 0 0 2vh ${rgba(c, 0.25)}`,
            animation: 'cvBreathe 3.6s ease-in-out infinite',
          }}
        />

        {/* header (grilla) y consola (ecualizador) */}
        <Bar where="top" c={c} eq={false} />
        <Bar where="bottom" c={c} eq={true} />
      </div>
    </div>
  );
}
