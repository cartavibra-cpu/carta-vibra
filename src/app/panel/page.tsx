'use client';
import { useEffect, useState } from 'react';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';

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
      window.location.href = `/panel/venues/${encodeURIComponent(data.slug)}`;
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
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600, marginBottom: 24 }}>Mis locales</h1>

        {/* crear local */}
        <section className="cv-card" style={{ padding: '20px 22px', marginBottom: 24 }}>
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

        {/* lista de locales */}
        <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-muted-2)', marginBottom: 12 }}>TUS LOCALES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {venues.length === 0 && <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-mono)' }}>todavía no tenés locales. Creá el primero arriba.</div>}
          {venues.map((v) => (
            <a key={v.id} href={`/panel/venues/${encodeURIComponent(v.slug)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '15px 18px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', textDecoration: 'none' }}>
              <div>
                <div className="cv-wordmark" style={{ fontSize: 17, fontWeight: 600, color: 'var(--cv-text)' }}>{v.name}</div>
                <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-muted-2)', marginTop: 3 }}>{modeLabel(v.mode)} · /{v.slug}</div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--cv-cyan)' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
