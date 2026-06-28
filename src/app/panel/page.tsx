'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import VenueManager from '@/components/VenueManager';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(94,46,255,.12), transparent 60%), #07060e';
const MODE_LABELS: Record<string, string> = { youtube_jukebox: 'YouTube Jukebox', youtube_karaoke: 'YouTube Karaoke', local_pro: 'Local Pro' };
const modeLabel = (m: string) => MODE_LABELS[m] || m;

export default function PanelPage() {
  const [session, setSession] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState('youtube_jukebox');
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sb = supa();
    if (!sb) return;
    sb.auth.getSession().then(({ data }: any) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const sb = supa();
    if (!sb) return;
    const { data } = await sb.from('venue').select('*').order('created_at', { ascending: false });
    if (Array.isArray(data)) setVenues(data);
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

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

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cv-wordmark" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>carta <span className="cv-grad-text">vibra</span></div>
          <p style={{ fontSize: 15, color: 'var(--cv-text-2)', marginBottom: 18 }}>Necesitás iniciar sesión para entrar al panel.</p>
          <a href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Ir al inicio</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Mis locales</h1>
          <button className="cv-btn cv-btn-cyan" onClick={() => setShowCreate((s) => !s)} style={{ fontSize: 14, padding: '9px 18px' }}>
            {showCreate ? 'Cerrar' : '+ Nuevo local'}
          </button>
        </div>

        {/* crear local */}
        {showCreate && (
          <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 24, border: '1px solid rgba(0,212,255,.25)' }}>
            <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)', marginBottom: 14 }}>CREAR UN LOCAL NUEVO</div>
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

        {/* lista de locales desplegables */}
        <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)', marginBottom: 12 }}>TUS LOCALES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {venues.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>todavía no tenés locales. Creá el primero con “+ Nuevo local”.</div>}
          {venues.map((v) => {
            const open = openSlugs.has(v.slug);
            return (
              <div key={v.id} className="cv-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button onClick={() => toggle(v.slug)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div className="cv-wordmark" style={{ fontSize: 17, fontWeight: 600, color: 'var(--cv-text)' }}>{v.name}</div>
                    <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted-2)', marginTop: 3 }}>{modeLabel(v.mode)} · /{v.slug}</div>
                  </div>
                  <span style={{ fontSize: 20, color: 'var(--cv-cyan)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>›</span>
                </button>
                {open && (
                  <div style={{ padding: '6px 18px 20px', borderTop: '1px solid var(--cv-line)' }}>
                    <VenueManager slug={v.slug} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
