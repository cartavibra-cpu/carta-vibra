'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import VenueManager from '@/components/VenueManager';
import BrandMark from '@/components/BrandMark';
import Ic from '@/components/Ic';
import PaletteSwitcher from '@/components/PaletteSwitcher';
import { setGlobalTheme, type CvTheme } from '@/lib/theme';
import { useIsMobile } from '@/lib/useIsMobile';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(var(--cv-accent-rgb),.12), transparent 60%), var(--cv-bg)';
const MODE_LABELS: Record<string, string> = { youtube_jukebox: 'YouTube Jukebox', youtube_karaoke: 'YouTube Karaoke', local_pro: 'Local Pro' };
const modeLabel = (m: string) => MODE_LABELS[m] || m;

export default function PanelPage() {
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState('youtube_jukebox');
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());
  const [savedPalette, setSavedPalette] = useState(false);
  const syncedRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }: any) => { setSession(data.session); setAuthChecked(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_event: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    const t0 = Date.now();
    const { data } = await sb.from('venue').select('*').order('created_at', { ascending: false });
    if (Array.isArray(data)) setVenues(data);
    const dt = Date.now() - t0;
    if (dt < 400) await new Promise((r) => setTimeout(r, 400 - dt));
    setLoaded(true);
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  // Al cargar los locales por primera vez, sincronizá la paleta global desde el local
  // (fuente de verdad en la base) → el chrome sigue tu identidad en cualquier dispositivo.
  useEffect(() => {
    if (!syncedRef.current && venues.length && venues[0]?.theme) {
      syncedRef.current = true;
      setGlobalTheme(venues[0].theme);
    }
  }, [venues]);

  // El local es la fuente de verdad de la paleta. Si la cambian desde el control o la consola,
  // reflejala EN VIVO en el chrome del panel (sin recargar), escuchando el mismo canal que ellos.
  const primaryVenueId = venues[0]?.id;
  useEffect(() => {
    const sb = supa();
    if (!sb || !primaryVenueId) return;
    const ch = sb.channel('cmd-' + primaryVenueId);
    ch.on('broadcast', { event: 'jbstate' }, (p: any) => {
      const t = p?.payload?.theme;
      if (typeof t === 'string') {
        setGlobalTheme(t as CvTheme);
        setVenues((prev) => prev.map((v) => ({ ...v, theme: t })));
      }
    }).subscribe();
    return () => { try { sb.removeChannel(ch); } catch {} };
  }, [primaryVenueId]);

  // Elegir la paleta desde "mis locales": PaletteSwitcher ya la aplicó al chrome (localStorage
  // + <html>); acá la bajamos a TODOS tus locales para que consola y widget queden iguales.
  const saveIdentityTheme = (id: CvTheme) => {
    const sb = supa();
    if (sb && venues.length) {
      venues.forEach((v) => {
        // 1) persistir en la base (fuente de verdad; al recargar cualquier pantalla lo toma)
        sb.rpc('set_venue_theme', { p_venue: v.id, p_theme: id }).then(() => {}, () => {});
        // 2) avisar EN VIVO a las pantallas abiertas de ese local por el mismo canal que ya
        //    escuchan: la consola oye 'jbcmd' (cmd:theme), el control y el widget oyen 'jbstate'.
        try {
          const ch = sb.channel('cmd-' + v.id);
          ch.subscribe((status: string) => {
            if (status !== 'SUBSCRIBED') return;
            try {
              ch.send({ type: 'broadcast', event: 'jbcmd', payload: { cmd: 'theme', value: id } });
              ch.send({ type: 'broadcast', event: 'jbstate', payload: { theme: id } });
            } catch {}
            setTimeout(() => { try { sb.removeChannel(ch); } catch {} }, 1500);
          });
        } catch {}
      });
      setVenues((prev) => prev.map((v) => ({ ...v, theme: id })));
    }
    setSavedPalette(true);
    setTimeout(() => setSavedPalette(false), 1800);
  };

  const toggle = (s: string) =>
    setOpenSlugs((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const sb = supa();
    if (!sb) return;
    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!cleanName) { setErr('Poné el nombre del local.'); return; }
    if (!cleanSlug) { setErr('Poné un identificador (slug) válido: letras, números y guiones, sin espacios.'); return; }
    setCreating(true);
    try {
      const { data, error } = await sb.rpc('create_venue', { p_slug: cleanSlug, p_name: cleanName, p_mode: mode });
      if (error) { setErr(error.message); return; }
      setName(''); setSlug(''); setShowCreate(false);
      await load();
      setOpenSlugs((prev) => new Set(prev).add(data.slug));
    } catch (e: any) { setErr(e?.message || 'No se pudo crear el local.'); }
    finally { setCreating(false); }
  };

  if (!authChecked) {
    return <main style={{ minHeight: '100vh', background: PANEL_BG }} />;
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><BrandMark size={104} /></div>
          <p style={{ fontSize: 15, color: 'var(--cv-mut)', marginBottom: 18 }}>Necesitás iniciar sesión para entrar al panel.</p>
          <Link href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Ir al inicio</Link>
        </div>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main style={{ minHeight: '100vh', background: PANEL_BG }}>
        <TopNav />
        <div className="cv-mono" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--cv-mut)' }}>cargando tus locales…</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '32px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Mis locales</h1>
          <button className="cv-btn cv-btn-cyan" onClick={() => setShowCreate((s) => !s)} style={{ fontSize: 14, padding: '9px 18px' }}>
            {showCreate ? 'Cerrar' : '+ Nuevo local'}
          </button>
        </div>

        {/* Paleta / identidad de color — se aplica a todo el chrome y (si tenés locales) a tu pantalla y widget */}
        <section className="cv-card" style={{ padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h2 className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-ink)' }}>Tu paleta</h2>
            {savedPalette && <span className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-accent)' }}>✓ aplicada</span>}
          </div>
          <p className="cv-mono" style={{ fontSize: 12.5, color: 'var(--cv-mut)', marginBottom: 14, lineHeight: 1.5 }}>
            La identidad de color de tu Carta Vibra. Se aplica a todo{venues.length ? ' — y a tu pantalla y widget' : ''}.
          </p>
          <PaletteSwitcher onPick={saveIdentityTheme} />
        </section>

        {/* crear local */}
        {showCreate && (
          <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 24, border: '1px solid rgba(var(--cv-accent-rgb),.25)' }}>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-faint)', marginBottom: 14 }}>CREAR UN LOCAL NUEVO</div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="cv-input" placeholder="Nombre del local" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="cv-input" placeholder="slug (sin espacios, ej: bar-luna)" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <select className="cv-input" value={mode} onChange={(e) => setMode(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="youtube_jukebox">YouTube Jukebox</option>
                <option value="youtube_karaoke">YouTube Karaoke</option>
                <option value="local_pro">Local Pro</option>
              </select>
              <button className="cv-btn cv-btn-cyan" type="submit" disabled={creating} style={{ fontSize: 15, padding: '11px 22px', alignSelf: 'flex-start', opacity: creating ? 0.6 : 1 }}>{creating ? 'Creando…' : 'Crear local'}</button>
              {err && <p className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-warm)' }}>{err}</p>}
            </form>
          </section>
        )}

        {/* Bienvenida para dueño nuevo (sin locales todavía) */}
        {venues.length === 0 ? (
          <div className="cv-card" style={{ padding: isMobile ? '28px 20px' : '36px 32px', textAlign: 'center', border: '1px solid rgba(var(--cv-accent-rgb),.25)', background: 'linear-gradient(165deg, rgba(var(--cv-accent-rgb),.10), rgba(var(--cv-accent-rgb),.04))' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--cv-accent)' }}><Ic name="music" size={40} /></div>
            <h2 className="cv-wordmark" style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 600, color: 'var(--cv-ink)' }}>¡Bienvenido a <span className="cv-grad-text">Carta Vibra</span>!</h2>
            <p style={{ fontSize: 14.5, color: 'var(--cv-mut)', lineHeight: 1.6, margin: '12px auto 0', maxWidth: 460 }}>
              Tus clientes votan la música y cantan karaoke desde el celular, y suena en la pantalla de tu local. Armarlo lleva 2 minutos:
            </p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, justifyContent: 'center', margin: '22px 0', textAlign: 'left' }}>
              {[
                { n: '1', t: 'Creá tu local', d: 'Un nombre y listo.' },
                { n: '2', t: 'Armá la música', d: 'Una playlist tuya o curada.' },
                { n: '3', t: 'Vinculá la pantalla', d: 'Abrí /console y emparejá.' },
              ].map((s) => (
                <div key={s.n} style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,.03)', border: '1px solid var(--cv-hair)', borderRadius: 12, padding: '12px 14px' }}>
                  <span className="cv-wordmark" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cv-accent)', flexShrink: 0 }}>{s.n}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cv-ink)' }}>{s.t}</div>
                    <div className="cv-mono" style={{ fontSize: 11.5, color: 'var(--cv-faint)', marginTop: 2 }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="cv-btn cv-btn-cyan" onClick={() => setShowCreate(true)} style={{ fontSize: 15, padding: '12px 26px' }}>+ Crear mi primer local</button>
          </div>
        ) : (
          <>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-faint)', marginBottom: 12 }}>TUS LOCALES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {venues.map((v) => {
                const open = openSlugs.has(v.slug);
                return (
                  <div key={v.id} className="cv-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button onClick={() => toggle(v.slug)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div>
                        <div className="cv-wordmark" style={{ fontSize: 17, fontWeight: 600, color: 'var(--cv-ink)' }}>{v.name}</div>
                        <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', marginTop: 3 }}>{modeLabel(v.mode)} · /{v.slug}</div>
                      </div>
                      <span style={{ fontSize: 20, color: 'var(--cv-accent)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>›</span>
                    </button>
                    {open && (
                      <div style={{ padding: '6px 18px 20px', borderTop: '1px solid var(--cv-hair)' }}>
                        <VenueManager slug={v.slug} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
