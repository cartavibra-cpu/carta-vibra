'use client';
import React, { useEffect, useRef } from 'react';
import Vinyl from '@/components/Vinyl';
import Waveform from '@/components/Waveform';

const STAGE_BG =
  'radial-gradient(1000px 600px at 50% -8%, rgba(94,46,255,.20), transparent 60%), radial-gradient(800px 500px at 80% 112%, rgba(0,212,255,.10), transparent 60%), #07060e';

function GoogleButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="cv-btn cv-btn-google"
      style={{ fontSize: small ? 14 : 16, padding: small ? '10px 18px' : '15px 30px' }}
    >
      <span style={{ width: small ? 18 : 22, height: small ? 18 : 22, borderRadius: '50%', background: 'conic-gradient(from 0deg,#EA4335,#FBBC05,#34A853,#4285F4,#EA4335)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: small ? 7 : 9, height: small ? 7 : 9, borderRadius: '50%', background: 'var(--cv-text)' }} />
      </span>
      Entrar con Google
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
  const glowA = useRef<HTMLDivElement>(null);
  const glowB = useRef<HTMLDivElement>(null);
  const heroContent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll('[data-reveal]'));

    if (reduce) {
      els.forEach((e) => e.classList.add('cv-in'));
      return;
    }

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
    els.forEach((e) => io.observe(e));

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (glowA.current) glowA.current.style.transform = `translateY(${y * 0.25}px)`;
        if (glowB.current) glowB.current.style.transform = `translateY(${y * -0.12}px)`;
        if (heroContent.current) {
          heroContent.current.style.transform = `translateY(${y * 0.15}px)`;
          heroContent.current.style.opacity = String(Math.max(0, 1 - y / 620));
        }
        raf = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main style={{ position: 'relative', background: '#07060e', overflow: 'hidden' }}>
      {/* ---------- NAV ---------- */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'linear-gradient(180deg, rgba(7,6,14,.85), rgba(7,6,14,0))', backdropFilter: 'blur(6px)' }}>
        <a href="#top" className="cv-wordmark" style={{ fontSize: 20, textDecoration: 'none' }}>
          carta <span className="cv-grad-text">vibra</span>
        </a>
        <GoogleButton onClick={onLogin} small />
      </nav>

      {/* ---------- HERO ---------- */}
      <section id="top" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: STAGE_BG }}>
        <div ref={glowA} style={{ position: 'absolute', top: '-10%', left: '50%', width: 900, height: 600, transform: 'translateX(-50%)', marginLeft: '-450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(94,46,255,.18), transparent 60%)', pointerEvents: 'none' }} />
        <div ref={glowB} style={{ position: 'absolute', bottom: '0%', right: '6%', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,.12), transparent 60%)', pointerEvents: 'none' }} />
        <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 44%, rgba(255,255,255,.022) 0 1px, transparent 1px 30px)' }} />

        <div ref={heroContent} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '120px 24px 80px', textAlign: 'center' }}>
          <Vinyl size={196} glow beat />
          <div className="cv-wordmark" style={{ fontSize: 'clamp(48px, 10vw, 92px)' }}>
            carta <span className="cv-grad-text">vibra</span>
          </div>
          <div style={{ maxWidth: 620 }}>
            <div className="cv-mono" style={{ fontSize: 14, letterSpacing: '.12em', color: 'var(--cv-muted-2)' }}>
              La vibra se elige entre todos.
            </div>
            <p style={{ marginTop: 14, fontSize: 'clamp(16px, 2.4vw, 19px)', lineHeight: 1.6, color: 'var(--cv-text-2)' }}>
              Tu rockola DJ digital. La música de tu local, elegida por su gente — en vivo, desde el celular.
            </p>
          </div>
          <div className="cv-hero-ctas">
            <GoogleButton onClick={onLogin} />
            <a href="#como-funciona" className="cv-btn cv-btn-ghost" style={{ fontSize: 15, padding: '14px 24px', textDecoration: 'none' }}>
              Ver cómo funciona
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

          <div data-reveal style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,212,255,.14)', background: 'radial-gradient(1000px 720px at 50% 52%, rgba(0,212,255,.16), transparent 60%), #060810', padding: '40px 28px 28px' }}>
            <div className="cv-surco" style={{ background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.022) 0 1px, transparent 1px 36px)', opacity: 0.4 }} />

            {/* top bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="cv-wordmark" style={{ fontSize: 18 }}>carta <span className="cv-grad-text">vibra</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--cv-cyan)', boxShadow: '0 0 12px var(--cv-cyan)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
                <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: 'var(--cv-cyan)' }}>EN VIVO</span>
              </div>
            </div>

            {/* wave + code */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, margin: '12px 0' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', opacity: 0.85 }}>
                <Waveform n={76} color="#00D4FF" maxH={210} barW={5} gap={5} notch={9} seed={5} />
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
              { name: 'Tranquilo', meta: '21:30 · 70 BPM', color: '#7B4DFF', title: 'var(--cv-violet-tint)', bg: 'rgba(123,77,255,.07)', bd: 'rgba(123,77,255,.22)', maxH: 42, seed: 11 },
              { name: 'Cálido', meta: '23:10 · 100 BPM', color: '#00D4FF', title: 'var(--cv-cyan-light)', bg: 'rgba(0,212,255,.06)', bd: 'rgba(0,212,255,.22)', maxH: 64, seed: 23 },
              { name: 'Encendido', meta: '01:40 · 128 BPM', color: '#6EF3B2', title: '#6EF3B2', bg: 'rgba(110,243,178,.06)', bd: 'rgba(110,243,178,.24)', maxH: 92, seed: 31 },
            ].map((r, i) => (
              <div key={r.name} data-reveal className="cv-thermo-row" style={{ background: r.bg, border: `1px solid ${r.bd}`, borderRadius: 14, padding: '18px 22px', transitionDelay: `${i * 90}ms` }}>
                <div className="cv-thermo-label">
                  <div className="cv-wordmark" style={{ fontSize: 18, fontWeight: 600, color: r.title }}>{r.name}</div>
                  <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-mono)', marginTop: 3 }}>{r.meta}</div>
                </div>
                <div className="cv-thermo-wave" style={{ flex: 1, minWidth: 0 }}>
                  <Waveform n={54} color={r.color} maxH={r.maxH} barW={3} gap={4} seed={r.seed} />
                </div>
                <div className="cv-wordmark" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '.04em', color: r.color, flexShrink: 0 }}>4829</div>
              </div>
            ))}
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
              <div className="cv-wordmark" style={{ fontSize: 18 }}>carta <span className="cv-grad-text">vibra</span></div>
              <p style={{ fontSize: 13, color: 'var(--cv-muted)', marginTop: 6, lineHeight: 1.6 }}>Noche, neón, movimiento. La energía de tu local cuando suena.</p>
            </div>
            <div style={{ padding: 22, borderRadius: 16, border: '1px solid rgba(214,167,116,.16)', background: 'linear-gradient(180deg,#16110d,#0e0b08)' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 19, color: '#ebd9c2' }}>CartaViva</div>
              <p style={{ fontSize: 13, color: '#a89784', marginTop: 6, lineHeight: 1.6 }}>El primo sobrio: la carta digital de tu local. Mismo ecosistema, otra energía.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA FINAL + FOOTER ---------- */}
      <section className="cv-section" style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(900px 500px at 50% 120%, rgba(94,46,255,.14), transparent 60%), #07060e' }}>
        <div className="cv-container" style={{ textAlign: 'center', maxWidth: 720 }}>
          <div data-reveal style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
            <Vinyl size={96} mini />
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 600, lineHeight: 1.15 }}>
              Que tu local suene <span className="cv-grad-text">como su gente</span>.
            </h2>
            <GoogleButton onClick={onLogin} />
          </div>
        </div>

        <footer style={{ marginTop: 80, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
          <div className="cv-wordmark" style={{ fontSize: 18 }}>carta <span className="cv-grad-text">vibra</span></div>
          <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--cv-mono)', marginTop: 8 }}>La vibra se elige entre todos · Tu rockola DJ digital</div>
        </footer>
      </section>
    </main>
  );
}
