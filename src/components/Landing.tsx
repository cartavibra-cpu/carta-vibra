'use client';
import React, { useEffect, useRef } from 'react';
import Vinyl from '@/components/Vinyl';
import BrandMark from '@/components/BrandMark';
import Waveform from '@/components/Waveform';
import { useIsMobile } from '@/lib/useIsMobile';

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(var(--cv-accent-rgb),.20), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(var(--cv-accent-rgb),.10), transparent 60%), var(--cv-bg)';

// Contacto — Fran: confirmá que este WhatsApp sea el de Carta Vibra (es el mismo de CartaViva).
const WHATSAPP = '56979282574';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, me interesa Carta Vibra para mi local 🎶')}`;
const EMAIL = 'cartavibra@gmail.com';
const EMAIL_URL = `mailto:${EMAIL}?subject=${encodeURIComponent('Quiero Carta Vibra en mi local')}`;

function GoogleG({ size }: { size: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'conic-gradient(from 0deg,#EA4335,#FBBC05,#34A853,#4285F4,#EA4335)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4), borderRadius: '50%', background: '#0b0a14' }} />
    </span>
  );
}

function GoogleButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  const isMobile = useIsMobile();
  return (
    <button
      onClick={onClick}
      className="cv-btn"
      style={{
        fontSize: small ? 13.5 : 15,
        padding: small ? '9px 15px' : '14px 26px',
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(0,212,255,.42)',
        color: 'var(--cv-text)',
        boxShadow: '0 8px 26px rgba(0,212,255,.12)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
      }}
    >
      <GoogleG size={small ? 16 : 18} />
      {small && isMobile ? 'Entrar' : 'Entrar con Google'}
    </button>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase', color: color ?? 'var(--cv-muted-2)' }}>
      {children}
    </div>
  );
}

export default function Landing({ onLogin }: { onLogin: () => void }) {
  const isMobile = useIsMobile();
  const vinylSize = isMobile ? 230 : 300;

  const glowA = useRef<HTMLDivElement>(null);
  const glowB = useRef<HTMLDivElement>(null);
  const heroContent = useRef<HTMLDivElement>(null);
  const vinylWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll('[data-reveal]'));

    // Las revelaciones (fade-in al hacer scroll) van siempre, aun con reduced-motion off.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('cv-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    if (reduce) {
      els.forEach((e) => e.classList.add('cv-in'));
    } else {
      els.forEach((e) => io.observe(e));
    }

    // Parallax: combinamos scroll + mouse en un solo rAF para que no se pisen.
    const sRef = { v: 0 }; // scrollY
    const mRef = { x: 0, y: 0 }; // mouse normalizado -1..1
    let raf = 0;

    const apply = () => {
      const y = sRef.v;
      const mx = mRef.x;
      const my = mRef.y;
      if (glowA.current) glowA.current.style.transform = `translate(${mx * -36}px, ${y * 0.25 + my * -36}px)`;
      if (glowB.current) glowB.current.style.transform = `translate(${mx * 28}px, ${y * -0.12 + my * 28}px)`;
      // El disco flota: parallax por mouse/giroscopio (mx,my) + un arrastre por scroll
      // (más lento que el texto) para que TENGA parallax también en el celular.
      if (vinylWrap.current) vinylWrap.current.style.transform = `translate(${mx * 20}px, ${my * 20 - y * 0.07}px)`;
      if (heroContent.current) {
        heroContent.current.style.transform = `translateY(${y * 0.12}px)`;
        heroContent.current.style.opacity = String(Math.max(0, 1 - y / 640));
      }
      raf = 0;
    };
    const req = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onScroll = () => {
      sRef.v = window.scrollY;
      req();
    };
    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mRef.x = (e.clientX - cx) / cx;
      mRef.y = (e.clientY - cy) / cy;
      req();
    };
    // Giroscopio: en el celu, inclinar el teléfono mueve el disco (equivalente al mouse).
    // No pedimos permiso: en iOS 13+ sin permiso simplemente no dispara y queda el
    // parallax por scroll; en Android funciona directo.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      mRef.x = Math.max(-1, Math.min(1, e.gamma / 26));
      mRef.y = Math.max(-1, Math.min(1, (e.beta - 45) / 26));
      req();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (!reduce) {
      window.addEventListener('mousemove', onMouse, { passive: true });
      window.addEventListener('deviceorientation', onTilt);
    }

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('deviceorientation', onTilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main style={{ position: 'relative', background: 'var(--cv-bg)', overflow: 'hidden' }}>
      {/* ---------- NAV ---------- */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: isMobile ? '12px 16px' : '16px 24px', background: 'linear-gradient(180deg, rgba(7,6,14,.88), rgba(7,6,14,0))', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        <a href="#top" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <BrandMark size={isMobile ? 30 : 34} layout="row" />
        </a>
        <GoogleButton onClick={onLogin} small />
      </nav>

      {/* ---------- HERO ---------- */}
      <section id="top" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: STAGE_BG }}>
        <div ref={glowA} style={{ position: 'absolute', top: '-10%', left: '50%', width: 900, height: 600, transform: 'translateX(-50%)', marginLeft: '-450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(94,46,255,.18), transparent 60%)', pointerEvents: 'none' }} />
        <div ref={glowB} style={{ position: 'absolute', bottom: '0%', right: '6%', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,.12), transparent 60%)', pointerEvents: 'none' }} />
        <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 44%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />

        <div ref={heroContent} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, padding: '120px 24px 80px', textAlign: 'center' }}>
          <div ref={vinylWrap} style={{ willChange: 'transform' }}>
            <BrandMark size={vinylSize} glow beat />
          </div>
          <div style={{ maxWidth: 600 }}>
            <div className="cv-mono" style={{ fontSize: 14, letterSpacing: '.14em', color: 'var(--cv-muted-2)' }}>
              La vibra se elige entre todos.
            </div>
            <p style={{ marginTop: 14, fontSize: 'clamp(17px, 2.6vw, 21px)', lineHeight: 1.55, color: 'var(--cv-text-2)' }}>
              Tu rockola DJ digital. La música de tu local, elegida por su gente — en vivo, desde el celular.
            </p>
          </div>
          <div className="cv-hero-ctas">
            <a href="#como-funciona" className="cv-btn cv-btn-primary" style={{ fontSize: 15, padding: '14px 26px', textDecoration: 'none', ...(isMobile ? { width: '100%' } : {}) }}>
              Ver cómo funciona
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="cv-btn cv-btn-ghost" style={{ fontSize: 15, padding: '14px 26px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, ...(isMobile ? { width: '100%' } : {}) }}>
              <span style={{ fontSize: 17 }}>💬</span> Escribinos por WhatsApp
            </a>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)' }}>
          <a href="#que-es" className="cv-mono" style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--cv-mono)', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            cómo funciona
            <span style={{ fontSize: 16 }}>↓</span>
          </a>
        </div>
      </section>

      {/* ---------- QUÉ ES ---------- */}
      <section id="que-es" className="cv-section">
        <div className="cv-container" style={{ maxWidth: 820 }}>
          <div data-reveal>
            <Eyebrow>Qué es</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 600, lineHeight: 1.1, marginTop: 16 }}>
              No es una rockola. Es el <span className="cv-grad-text">sistema nervioso</span> de tu local.
            </h2>
            <p style={{ marginTop: 22, fontSize: 'clamp(16px, 2.2vw, 18px)', lineHeight: 1.7, color: 'var(--cv-muted)' }}>
              Carta Vibra pone la música del ambiente en manos de la gente. Tus clientes votan, suena lo más votado,
              y la energía del lugar se construye sola — sin pedirle canciones al mesero, sin un DJ que adivine.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- CÓMO FUNCIONA ---------- */}
      <section id="como-funciona" className="cv-section" style={{ background: 'linear-gradient(180deg, transparent, rgba(94,46,255,.05), transparent)' }}>
        <div className="cv-container">
          <div data-reveal style={{ textAlign: 'center', marginBottom: 44 }}>
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, marginTop: 14 }}>Así de simple.</h2>
          </div>
          <div className="cv-steps">
            {[
              { n: '01', c: 'var(--cv-violet-light)', t: 'Pega el QR en las mesas', d: 'Lo imprimes desde tu panel y listo. Cada local tiene el suyo.' },
              { n: '02', c: 'var(--cv-cyan)', t: 'Tu gente vota desde el celular', d: 'Sin descargar nada. Escanean, entran con el código de la pantalla, y eligen.' },
              { n: '03', c: 'var(--cv-mint)', t: 'La pantalla reproduce lo más votado', d: 'La cola se reordena en vivo. El local suena como su gente.' },
            ].map((s, i) => (
              <div key={s.n} data-reveal className="cv-card" style={{ padding: 24, transitionDelay: `${i * 90}ms` }}>
                <div className="cv-wordmark" style={{ fontSize: 14, fontWeight: 700, color: s.c, letterSpacing: '.04em' }}>{s.n}</div>
                <div className="cv-wordmark" style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>{s.t}</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--cv-muted)', marginTop: 8 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- LA CONSOLA (onda) ---------- */}
      <section className="cv-section">
        <div className="cv-container">
          <div data-reveal style={{ textAlign: 'center', marginBottom: 36 }}>
            <Eyebrow color="var(--cv-cyan-light)">La consola</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, marginTop: 14 }}>Una sola onda. Se ve de lejos.</h2>
          </div>

          <div data-reveal style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(var(--cv-accent-rgb),.16)', background: 'radial-gradient(1000px 720px at 50% 52%, rgba(var(--cv-accent-rgb),.16), transparent 60%), var(--cv-bg)', padding: '40px 28px 28px' }}>
            <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.022) 0 1px, transparent 1px 36px)', opacity: 0.4 }} />

            {/* top bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <BrandMark size={28} layout="row" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-cyan)', boxShadow: '0 0 12px var(--cv-cyan)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
                <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-cyan)' }}>EN VIVO</span>
              </div>
            </div>

            {/* wave + code */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, margin: '12px 0' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', opacity: 0.85 }}>
                <Waveform n={isMobile ? 30 : 76} color="var(--cv-accent)" maxH={isMobile ? 150 : 210} barW={5} gap={5} notch={isMobile ? 5 : 9} seed={5} />
              </div>
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div className="cv-mono" style={{ fontSize: 13, letterSpacing: '.28em', color: 'var(--cv-cyan-light)', marginBottom: 4 }}>CÓDIGO DE SALA</div>
                <div className="cv-wordmark cv-grad-code" style={{ fontSize: 'clamp(64px, 13vw, 150px)', fontWeight: 700, lineHeight: 0.9, letterSpacing: '.03em', textShadow: '0 0 70px rgba(0,212,255,.3)' }}>4829</div>
              </div>
            </div>

            {/* sonando ahora */}
            <div className="cv-mono" style={{ position: 'relative', textAlign: 'center', fontSize: 13, letterSpacing: '.06em', color: 'var(--cv-muted-2)', marginBottom: 16 }}>
              SONANDO AHORA · <span style={{ color: 'var(--cv-cyan)' }}>One More Time</span> — Daft Punk
            </div>

            {/* ticker */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '10px 22px', borderTop: '1px solid rgba(0,212,255,.14)', paddingTop: 16 }}>
              {[['Borderline', 47], ['Tek It', 41], ['Flashing Lights', 33]].map(([t, v], i) => (
                <React.Fragment key={t as string}>
                  {i > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3a4658' }} />}
                  <span className="cv-wordmark" style={{ fontSize: 15, fontWeight: 500, color: 'var(--cv-text-2)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--cv-cyan)' }}>▲</span> {t} <span style={{ color: 'var(--cv-cyan-light)' }}>{v}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <p data-reveal style={{ textAlign: 'center', marginTop: 22, fontSize: 15, color: 'var(--cv-muted)', maxWidth: 560, marginInline: 'auto' }}>
            El código de sala es el héroe. Tu gente lo escribe en el celular y ya está adentro, votando.
          </p>
        </div>
      </section>

      {/* ---------- TERMÓMETRO ---------- */}
      <section className="cv-section" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,212,255,.04), transparent)' }}>
        <div className="cv-container">
          <div data-reveal style={{ marginBottom: 36 }}>
            <Eyebrow>El color late con la sala</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, marginTop: 14 }}>La vibra no se dice. Se ve.</h2>
            <p style={{ marginTop: 18, fontSize: 'clamp(16px, 2.2vw, 18px)', lineHeight: 1.7, color: 'var(--cv-muted)', maxWidth: 680 }}>
              El color es un termómetro del ambiente: violeta cuando el local está tranquilo, menta cuando está encendido.
              La frase se vuelve literal — visible desde la barra.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { name: 'Tranquilo', meta: '21:30 · 70 BPM', color: '#7B4DFF', title: '#A98BFF', bg: 'rgba(123,77,255,.07)', bd: 'rgba(123,77,255,.22)', maxH: 42, seed: 11 },
              { name: 'Cálido', meta: '23:10 · 100 BPM', color: '#00D4FF', title: '#5FE0FF', bg: 'rgba(0,212,255,.06)', bd: 'rgba(0,212,255,.22)', maxH: 64, seed: 23 },
              { name: 'Encendido', meta: '01:40 · 128 BPM', color: '#6EF3B2', title: '#6EF3B2', bg: 'rgba(110,243,178,.06)', bd: 'rgba(110,243,178,.24)', maxH: 92, seed: 31 },
            ].map((r, i) => {
              const label = (
                <div style={{ flexShrink: 0, ...(isMobile ? {} : { width: 150 }) }}>
                  <div className="cv-wordmark" style={{ fontSize: 18, fontWeight: 600, color: r.title }}>{r.name}</div>
                  <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 3 }}>{r.meta}</div>
                </div>
              );
              const code = (
                <div className="cv-wordmark" style={{ fontSize: isMobile ? 30 : 34, fontWeight: 700, letterSpacing: '.04em', color: r.color, flexShrink: 0 }}>4829</div>
              );
              const waveEl = <Waveform n={isMobile ? 34 : 54} color={r.color} maxH={r.maxH} barW={3} gap={4} seed={r.seed} />;
              const rowStyle: React.CSSProperties = {
                background: r.bg,
                border: `1px solid ${r.bd}`,
                borderRadius: 14,
                padding: isMobile ? '16px 18px' : '18px 22px',
                transitionDelay: `${i * 90}ms`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: isMobile ? 12 : 24,
              };
              return (
                <div key={r.name} data-reveal style={rowStyle}>
                  {isMobile ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        {label}
                        {code}
                      </div>
                      <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>{waveEl}</div>
                    </>
                  ) : (
                    <>
                      {label}
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{waveEl}</div>
                      {code}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- FUTURO / DIFERENCIACIÓN ---------- */}
      <section className="cv-section">
        <div className="cv-container" style={{ maxWidth: 820 }}>
          <div data-reveal>
            <Eyebrow>Hacia dónde vamos</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 600, lineHeight: 1.1, marginTop: 16 }}>
              El DJ que <span className="cv-grad-text">nunca para</span>.
            </h2>
            <p style={{ marginTop: 22, fontSize: 'clamp(16px, 2.2vw, 18px)', lineHeight: 1.7, color: 'var(--cv-muted)' }}>
              Carta Vibra aprende qué prende a tu gente. El objetivo: un DJ virtual que anima tu espacio solo,
              toda la noche — leyendo la sala y eligiendo lo que sube la vibra.
            </p>
          </div>

          {/* ecosistema */}
          <div data-reveal className="cv-eco" style={{ marginTop: 40 }}>
            <div className="cv-card" style={{ padding: 22 }}>
              <BrandMark size={30} layout="row" />
              <p style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 10, lineHeight: 1.6 }}>Noche, neón, movimiento. La energía de tu local cuando suena.</p>
            </div>
            <div style={{ padding: 22, borderRadius: 16, border: '1px solid rgba(214,167,116,.16)', background: 'linear-gradient(180deg,#16110d,#0e0b08)' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 19, color: '#ebd9c2' }}>CartaViva</div>
              <p style={{ fontSize: 13, color: '#a89784', marginTop: 6, lineHeight: 1.6 }}>El primo sobrio: la carta digital de tu local. Mismo ecosistema, otra energía.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CONTACTO + FOOTER ---------- */}
      <section id="contacto" className="cv-section" style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(900px 520px at 50% 120%, rgba(var(--cv-accent-rgb),.12), transparent 60%), radial-gradient(800px 500px at 50% -20%, rgba(var(--cv-accent-rgb),.10), transparent 60%), var(--cv-bg)' }}>
        <div className="cv-container" style={{ textAlign: 'center', maxWidth: 680 }}>
          <div data-reveal style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <Vinyl size={92} mini />
            <Eyebrow color="var(--cv-mint)">¿Lo querés en tu local?</Eyebrow>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 600, lineHeight: 1.15 }}>
              Que tu local suene <span className="cv-grad-text">como su gente</span>.
            </h2>
            <p style={{ fontSize: 'clamp(15px, 2.2vw, 17px)', lineHeight: 1.65, color: 'var(--cv-muted)', maxWidth: 520 }}>
              Te mostramos cómo quedaría andando en tu local y lo dejamos listo. Escribinos y conversamos — sin compromiso.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6, width: '100%', maxWidth: isMobile ? 360 : undefined }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="cv-btn cv-btn-mint" style={{ fontSize: 15, padding: '15px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, ...(isMobile ? { width: '100%' } : {}) }}>
                <span style={{ fontSize: 18 }}>💬</span> Escribinos por WhatsApp
              </a>
              <a href={EMAIL_URL} className="cv-btn cv-btn-ghost" style={{ fontSize: 15, padding: '15px 26px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%', overflow: 'hidden', ...(isMobile ? { width: '100%' } : {}) }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>✉️</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{EMAIL}</span>
              </a>
            </div>

            <div className="cv-mono" style={{ fontSize: 12.5, letterSpacing: '.04em', color: 'var(--cv-muted-2)', display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, maxWidth: '100%' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cv-mint)', boxShadow: '0 0 8px var(--cv-mint)', flexShrink: 0 }} />
              Te responde una persona de verdad, no un robot.
            </div>
          </div>
        </div>

        <footer style={{ marginTop: 80, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BrandMark size={32} layout="row" />
          </div>
          <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--cv-mono)', marginTop: 12 }}>La vibra se elige entre todos · Tu rockola DJ digital</div>
        </footer>
      </section>
    </main>
  );
}
