'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supa } from '@/lib/supabaseClient';
import TopNav from '@/components/TopNav';
import { Ic } from '@/components/Ic';
import { useIsMobile } from '@/lib/useIsMobile';

const PANEL_BG = 'radial-gradient(700px 500px at 50% -10%, rgba(var(--cv-accent-rgb),.12), transparent 60%), var(--cv-bg)';

type ErrRow = {
  id: string;
  created_at: string;
  context: string | null;
  venue_slug: string | null;
  message: string | null;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  extra: any;
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace ' + s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const d = Math.floor(h / 24);
  return 'hace ' + d + ' d';
}

export default function ErroresPage() {
  const isMobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('todos');

  useEffect(() => {
    const sb = supa(); if (!sb) { setIsAdmin(false); return; }
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setIsAdmin(false); return; }
      const { data, error } = await sb.rpc('is_admin');
      setIsAdmin(!error && data === true);
    })();
  }, []);

  const load = useCallback(async () => {
    const sb = supa(); if (!sb) return;
    setLoading(true);
    const { data } = await sb.from('error_log')
      .select('*').order('created_at', { ascending: false }).limit(150);
    setRows((data as ErrRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (isAdmin === null) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG }}>
        <div className="cv-mono" style={{ fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-mut)' }}>cargando…</div>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL_BG, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--cv-mut)', fontSize: 15, marginBottom: 16 }}>Esta sección es solo para administradores.</p>
          <Link href="/" className="cv-btn cv-btn-cyan" style={{ display: 'inline-block', fontSize: 15, padding: '12px 24px', textDecoration: 'none' }}>Volver al inicio</Link>
        </div>
      </main>
    );
  }

  const last24 = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86400000).length;
  const contexts = Array.from(new Set(rows.map((r) => r.context || '—'))).sort();
  const shown = filter === 'todos' ? rows : rows.filter((r) => (r.context || '—') === filter);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG }}>
      <TopNav />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '32px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600 }}>Errores</h1>
          <button onClick={load} disabled={loading} className="cv-btn cv-btn-cyan" style={{ fontSize: 13, padding: '9px 18px', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Cargando…' : '↻ Actualizar'}
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--cv-mut)', lineHeight: 1.5, margin: '0 0 18px', maxWidth: 580 }}>
          Lo que falló en la app (cliente y servidor). Si está vacío, todo viene andando.
        </p>

        {/* resumen */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="cv-card" style={{ padding: '12px 18px', flex: '1 1 auto', minWidth: 140 }}>
            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--cv-faint)' }}>ÚLTIMAS 24 H</div>
            <div className="cv-wordmark" style={{ fontSize: 28, fontWeight: 700, color: last24 > 0 ? 'var(--cv-warm)' : 'var(--cv-accent)', marginTop: 2 }}>{last24}</div>
          </div>
          <div className="cv-card" style={{ padding: '12px 18px', flex: '1 1 auto', minWidth: 140 }}>
            <div className="cv-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--cv-faint)' }}>TOTAL (últimos 150)</div>
            <div className="cv-wordmark" style={{ fontSize: 28, fontWeight: 700, color: 'var(--cv-ink)', marginTop: 2 }}>{rows.length}</div>
          </div>
        </div>

        {/* filtro por contexto */}
        {contexts.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['todos', ...contexts].map((c) => (
              <button key={c} onClick={() => setFilter(c)} className="cv-mono"
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  border: filter === c ? '1px solid var(--cv-accent)' : '1px solid var(--cv-hair)',
                  background: filter === c ? 'rgba(var(--cv-accent-rgb),.10)' : 'transparent',
                  color: filter === c ? 'var(--cv-accent)' : 'var(--cv-mut)' }}>{c}</button>
            ))}
          </div>
        )}

        {/* lista */}
        {shown.length === 0 ? (
          <div className="cv-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--cv-accent)" }}><Ic name="check" size={34} /></div>
            <p className="cv-mono" style={{ fontSize: 14, color: 'var(--cv-mut)' }}>Sin errores registrados. Todo viene andando.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((r) => {
              const isOpen = open.has(r.id);
              return (
                <div key={r.id} className="cv-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <button onClick={() => toggle(r.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ marginTop: 2, fontSize: 14, color: 'var(--cv-accent)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>›</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.08em', color: 'var(--cv-accent)', border: '1px solid rgba(var(--cv-accent-rgb),.3)', borderRadius: 999, padding: '1px 8px' }}>{r.context || '—'}</span>
                        {r.venue_slug && <span className="cv-mono" style={{ fontSize: 10.5, color: 'var(--cv-faint)' }}>/{r.venue_slug}</span>}
                        <span className="cv-mono" style={{ fontSize: 10.5, color: 'var(--cv-faint)' }}>{timeAgo(r.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--cv-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap' }}>{r.message || '(sin mensaje)'}</div>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px 34px', borderTop: '1px solid var(--cv-hair)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                        {r.url && (
                          <div>
                            <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--cv-faint)', marginBottom: 3 }}>PANTALLA</div>
                            <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mut)', wordBreak: 'break-all' }}>{r.url}</div>
                          </div>
                        )}
                        {r.stack && (
                          <div>
                            <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--cv-faint)', marginBottom: 3 }}>TRAZA</div>
                            <pre className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,.25)', padding: 10, borderRadius: 8 }}>{r.stack}</pre>
                          </div>
                        )}
                        {r.user_agent && (
                          <div>
                            <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--cv-faint)', marginBottom: 3 }}>DISPOSITIVO</div>
                            <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', wordBreak: 'break-word' }}>{r.user_agent}</div>
                          </div>
                        )}
                        {r.extra && (
                          <div>
                            <div className="cv-mono" style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--cv-faint)', marginBottom: 3 }}>EXTRA</div>
                            <pre className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(r.extra, null, 2)}</pre>
                          </div>
                        )}
                        <div className="cv-mono" style={{ fontSize: 10.5, color: 'var(--cv-faint)' }}>{new Date(r.created_at).toLocaleString('es-CL')}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
