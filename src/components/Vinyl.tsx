import React from 'react';

type VinylProps = {
  /** diámetro en px */
  size: number;
  /** variante chica: gira, sin resplandor ni latido (consola / widget) */
  mini?: boolean;
  /** resplandor exterior que pulsa al beat (login / logo) */
  glow?: boolean;
  /** todo el vinilo late al beat (login / logo) */
  beat?: boolean;
  /** contenido del centro del vinilo (ej. el wordmark en la pantalla de logo) */
  label?: React.ReactNode;
  /** disco blanco (para temas claros); si no, disco negro de siempre */
  light?: boolean;
  style?: React.CSSProperties;
};

/**
 * Vinilo vivo de Carta Vibra.
 * - mini: disco que gira con anillo de color y púa central (now-playing).
 * - hero: disco que gira + late + resplandece, con etiqueta central opcional (login/logo).
 */
export default function Vinyl({ size, mini = false, glow = false, beat = false, label, light = false, style }: VinylProps) {
  if (mini) {
    return (
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: '50%',
          animation: 'cvSpin 9s linear infinite',
          background: light
            ? 'repeating-radial-gradient(circle at center, rgba(0,0,0,.055) 0 1px, transparent 1px 4px), radial-gradient(circle, #ffffff, #f0ecf6 72%)'
            : 'repeating-radial-gradient(circle at center, rgba(255,255,255,.05) 0 1px, transparent 1px 4px), radial-gradient(circle, #1a1426, #0c0a15 72%)',
          boxShadow: light
            ? 'inset 0 0 20px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.14)'
            : 'inset 0 0 26px rgba(0,0,0,.8)',
          ...style,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '20%',
            borderRadius: '50%',
            background: light
              ? 'conic-gradient(from 200deg, rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.88), rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.88))'
              : 'conic-gradient(from 200deg, rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.5), rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.5))',
            filter: light ? 'saturate(1.9) brightness(.8) drop-shadow(0 0 3px rgba(var(--cv-accent-rgb),.95)) drop-shadow(0 0 7px rgba(var(--cv-accent-rgb),.6))' : undefined,
            WebkitMask: 'radial-gradient(circle, transparent 52%, #000 56%, #000 70%, transparent 74%)',
            mask: 'radial-gradient(circle, transparent 52%, #000 56%, #000 70%, transparent 74%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '42%',
            borderRadius: '50%',
            background: light ? '#2a2233' : '#07060e',
            boxShadow: light ? 'inset 0 0 0 1px rgba(0,0,0,.25)' : 'inset 0 0 0 1px rgba(255,255,255,.2)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        animation: beat ? 'cvBeat var(--cv-beat,.66s) ease-in-out infinite' : undefined,
        ...style,
      }}
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: '-8%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(var(--cv-accent-rgb),.42), rgba(var(--cv-accent-rgb),.22) 45%, transparent 70%)',
            filter: 'blur(16px)',
            animation: 'cvGlow var(--cv-beat,.66s) ease-in-out infinite',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          animation: 'cvSpin 9s linear infinite',
          background:
            'repeating-radial-gradient(circle at center, rgba(255,255,255,.05) 0 1px, transparent 1px 5px), radial-gradient(circle, #1a1426, #0d0a16 72%)',
          boxShadow: 'inset 0 0 44px rgba(0,0,0,.85)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '20%',
            borderRadius: '50%',
            background: 'conic-gradient(from 210deg, rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.5), rgba(var(--cv-accent-rgb),1), rgba(var(--cv-accent-rgb),.5), rgba(var(--cv-accent-rgb),1))',
            WebkitMask: 'radial-gradient(circle, transparent 55%, #000 58%, #000 64%, transparent 67%)',
            mask: 'radial-gradient(circle, transparent 55%, #000 58%, #000 64%, transparent 67%)',
          }}
        />
      </div>

      {/* brillo especular */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 32% 25%, rgba(255,255,255,.16), transparent 40%)',
        }}
      />

      {/* centro */}
      <div
        style={{
          position: 'absolute',
          inset: label ? '31%' : '34%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 30%, #17121f, #0a0812)',
          border: '1px solid rgba(255,255,255,.09)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 26px rgba(0,0,0,.6)',
        }}
      >
        {label ?? (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#07060e',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)',
            }}
          />
        )}
      </div>
    </div>
  );
}
