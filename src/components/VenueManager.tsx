'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supa } from '@/lib/supabaseClient';
import QRCode from 'qrcode';
import { useIsMobile } from '@/lib/useIsMobile';
import { logError } from '@/lib/logError';
import { Ic } from '@/components/Ic';

const MODE_LABELS: Record<string, string> = { youtube_jukebox: 'YouTube Jukebox', youtube_karaoke: 'YouTube Karaoke', local_pro: 'Local Pro' };
const modeLabel = (m: string) => MODE_LABELS[m] || m;

type Section = 'jukebox' | 'karaoke';
type Assignment = {
  id: string;
  playlist_id: string;
  section: Section;
  sort: number;
  is_active: boolean;
  name: string;
  mood: string | null;
  count: number;
};
type LibPlaylist = { id: string; name: string; type: string | null; mood: string | null };

const SECTIONS: { key: Section; label: string; accent: string; hint: string }[] = [
  { key: 'jukebox', label: 'JUKEBOX', accent: 'var(--cv-accent)', hint: 'Los clientes votan las canciones de la playlist activa.' },
  { key: 'karaoke', label: 'KARAOKE', accent: 'var(--cv-accent)', hint: 'Para cantar. (El modo karaoke completo llega pronto.)' },
];

function belongsToSection(p: LibPlaylist, section: Section) {
  if (section === 'karaoke') return p.type === 'karaoke';
  return p.type !== 'karaoke' && p.type !== 'dj_pro';
}

const labelStyle: React.CSSProperties = { fontSize: 12, letterSpacing: '.18em', color: 'var(--cv-faint)' };

export default function VenueManager({ slug, showHeader = false }: { slug: string; showHeader?: boolean }) {
  const [venue, setVenue] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [library, setLibrary] = useState<LibPlaylist[]>([]);

  const [qr, setQr] = useState('');
  const [mesa, setMesa] = useState('1');
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consolePaired, setConsolePaired] = useState<boolean | null>(null);
  const isMobile = useIsMobile();

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supa(); if (!sb || !venue) return;
    const trimmed = pairCode.trim(); if (!trimmed) return;
    const { data, error } = await sb.rpc('console_confirm_pairing', { p_code: trimmed, p_venue: venue.id });
    if (error) { setPairMsg('❌ ' + error.message); return; }
    setPairMsg(data?.ok ? '✓ Consola vinculada. Mirá la pantalla del local.' : 'Hecho.');
    setPairCode('');
    if (data?.ok) await load();
  };

  const load = async () => {
    const sb = supa(); if (!sb) return;
    const { data: v } = await sb.from('venue').select('*').eq('slug', slug).single();
    setVenue(v);
    if (!v) return;

    const { data: u } = await sb.auth.getUser();
    const uid = u?.user?.id ?? null;

    const { data: asg } = await sb.from('venue_playlist_assignment')
      .select('id,playlist_id,section,sort,is_active').eq('venue_id', v.id).order('sort');
    const rows = (asg as any[]) || [];
    const pids = rows.map((a) => a.playlist_id);

    const meta: Record<string, { name: string; mood: string | null }> = {};
    const counts: Record<string, number> = {};
    if (pids.length) {
      const { data: pls } = await sb.from('venue_playlist').select('id,name,mood').in('id', pids);
      (pls as any[] | null)?.forEach((p) => { meta[p.id] = { name: p.name, mood: p.mood }; });
      const { data: trk } = await sb.from('catalog_track').select('id,playlist_id').in('playlist_id', pids);
      (trk as any[] | null)?.forEach((r) => { if (r.playlist_id) counts[r.playlist_id] = (counts[r.playlist_id] || 0) + 1; });
    }
    setAssignments(rows.map((a) => ({
      id: a.id, playlist_id: a.playlist_id, section: a.section, sort: a.sort, is_active: a.is_active,
      name: meta[a.playlist_id]?.name ?? '(sin nombre)', mood: meta[a.playlist_id]?.mood ?? null,
      count: counts[a.playlist_id] ?? 0,
    })));

    if (uid) {
      const { data: lib } = await sb.from('venue_playlist').select('id,name,type,mood').eq('owner', uid).order('created_at');
      setLibrary((lib as LibPlaylist[]) || []);
    }

    // ¿hay una consola vinculada a este local? (para los "Primeros pasos")
    const { data: dev } = await sb.from('console_device').select('id').eq('venue_id', v.id).limit(1);
    setConsolePaired((((dev as any[]) || []).length) > 0);

    QRCode.toDataURL(`/widget/${slug}?mesa=${mesa}`, { width: 400 }).then(setQr);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, mesa]);

  const assignedIn = (section: Section) =>
    assignments.filter((a) => a.section === section).sort((a, b) => a.sort - b.sort);

  const availableFor = (section: Section) =>
    library.filter((p) => belongsToSection(p, section) && !assignments.some((a) => a.section === section && a.playlist_id === p.id));

  const activeAssignment = assignments.find((a) => a.is_active) || null;

  // Estado de "Primeros pasos": qué falta para que el local esté listo para abrir.
  const hasPlaylist = !!activeAssignment;
  const hasConsole = consolePaired === true;
  const setupDone = hasPlaylist && hasConsole;

  const doAssign = async (section: Section, playlistId: string) => {
    if (!playlistId) return;
    const sb = supa(); if (!sb || !venue) return;
    setBusy(true);
    const { error } = await sb.rpc('assign_playlist', { p_venue: venue.id, p_playlist: playlistId, p_section: section });
    setBusy(false);
    if (error) { alert('No se pudo asignar: ' + error.message); return; }
    await load();
  };

  const doActivate = async (a: Assignment) => {
    const sb = supa(); if (!sb) return;
    setBusy(true);
    const { error } = await sb.rpc('set_active_assignment', { p_assignment: a.id });
    setBusy(false);
    if (error) { alert('No se pudo activar: ' + error.message); logError('panel-activar-playlist', new Error(error.message), { assignmentId: a.id, section: a.section }); return; }
    await load();
  };

  const doUnassign = async (a: Assignment) => {
    if (!confirm(`¿Quitar "${a.name}" de este local? (La playlist sigue en tu biblioteca.)`)) return;
    const sb = supa(); if (!sb) return;
    setBusy(true);
    const { error } = await sb.rpc('unassign_playlist', { p_assignment: a.id });
    setBusy(false);
    if (error) { alert('No se pudo quitar: ' + error.message); return; }
    await load();
  };

  const move = async (a: Assignment, dir: -1 | 1) => {
    const sb = supa(); if (!sb) return;
    const list = assignedIn(a.section);
    const i = list.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const b = list[j];
    setBusy(true);
    await sb.from('venue_playlist_assignment').update({ sort: b.sort }).eq('id', a.id);
    await sb.from('venue_playlist_assignment').update({ sort: a.sort }).eq('id', b.id);
    setBusy(false);
    await load();
  };

  if (!venue) return (
    <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mut)', padding: '8px 0' }}>cargando local…</div>
  );

  const block: React.CSSProperties = { paddingTop: 20, marginTop: 20, borderTop: '1px solid var(--cv-hair)' };

  return (
    <div>
      {showHeader && (
        <div style={{ marginBottom: 22 }}>
          <h1 className="cv-wordmark" style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 600 }}>{venue.name}</h1>
          <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-faint)', marginTop: 6 }}>MODO · {modeLabel(venue.mode)}</div>
        </div>
      )}

      {/* Primeros pasos — guía al dueño nuevo. Se esconde sola cuando está todo listo. */}
      {consolePaired !== null && !setupDone && (
        <div className="cv-card" style={{ padding: '18px 20px', marginBottom: 20, border: '1px solid rgba(var(--cv-accent-rgb),.3)', background: 'linear-gradient(160deg, rgba(var(--cv-accent-rgb),.10), rgba(var(--cv-accent-rgb),.05))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 10px var(--cv-accent)', flexShrink: 0 }} />
            <span className="cv-wordmark" style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-ink)' }}>Primeros pasos</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--cv-mut)', lineHeight: 1.5, margin: '0 0 14px' }}>
            Dos cositas y tu local queda listo para abrir:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* paso 1: playlist */}
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginTop: 1, background: hasPlaylist ? 'var(--cv-accent)' : 'transparent', border: hasPlaylist ? 'none' : '1.5px solid var(--cv-faint)', color: hasPlaylist ? 'var(--cv-on)' : 'transparent' }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: hasPlaylist ? 'var(--cv-mut)' : 'var(--cv-ink)', textDecoration: hasPlaylist ? 'line-through' : 'none' }}>Elegí la música y ponela a sonar</div>
                {!hasPlaylist && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-faint)', marginTop: 4, lineHeight: 1.5 }}>Asigná una playlist de tu <Link href="/panel/playlists" style={{ color: 'var(--cv-accent)' }}>biblioteca</Link> más abajo, en <b style={{ color: 'var(--cv-mut)' }}>“Playlists del local”</b>, y tocá <b style={{ color: 'var(--cv-mut)' }}>“Poner a sonar”</b>. ¿No tenés ninguna? Mirá las <Link href="/panel/curadas" style={{ color: 'var(--cv-accent)' }}>curadas</Link>.</div>}
              </div>
            </div>
            {/* paso 2: consola */}
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginTop: 1, background: hasConsole ? 'var(--cv-accent)' : 'transparent', border: hasConsole ? 'none' : '1.5px solid var(--cv-faint)', color: hasConsole ? 'var(--cv-on)' : 'transparent' }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: hasConsole ? 'var(--cv-mut)' : 'var(--cv-ink)', textDecoration: hasConsole ? 'line-through' : 'none' }}>Vinculá la pantalla del local</div>
                {!hasConsole && <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-faint)', marginTop: 4, lineHeight: 1.5 }}>En la pantalla o PC del local, abrí <b style={{ color: 'var(--cv-mut)' }}>/console</b>. Te da un código de 6 dígitos: escribilo acá abajo en <b style={{ color: 'var(--cv-mut)' }}>“Vincular consola”</b>.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vincular consola */}
      <div>
        <div className="cv-mono" style={{ ...labelStyle, marginBottom: 6 }}>VINCULAR CONSOLA</div>
        <p style={{ fontSize: 13.5, color: 'var(--cv-mut)', lineHeight: 1.55, margin: '0 0 12px' }}>
          Abrí <b style={{ color: 'var(--cv-ink)' }}>/console</b> en la pantalla del local. Te muestra un código de 6 dígitos. Escribilo acá.
        </p>
        <form onSubmit={handlePair} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input className="cv-input" inputMode="numeric" maxLength={6} placeholder="000000" value={pairCode} onChange={(e) => setPairCode(e.target.value)} style={{ width: 150, textAlign: 'center', fontSize: 19, letterSpacing: '.25em', fontFamily: 'var(--cv-font-display)' }} />
          <button className="cv-btn cv-btn-cyan" type="submit" style={{ fontSize: 14, padding: '0 22px' }}>Vincular</button>
        </form>
        {pairMsg && <p className="cv-mono" style={{ marginTop: 10, fontSize: 13, color: 'var(--cv-accent)' }}>{pairMsg}</p>}
      </div>

      {/* Control en vivo desde el celular */}
      <div style={block}>
        <div className="cv-mono" style={{ ...labelStyle, marginBottom: 6 }}>CONTROL EN VIVO (CELULAR)</div>
        <p style={{ fontSize: 13.5, color: 'var(--cv-mut)', lineHeight: 1.55, margin: '0 0 12px' }}>
          Mientras el PC proyecta a la TV, controlá el local <b style={{ color: 'var(--cv-ink)' }}>desde tu celular</b>. En karaoke: agregar, reordenar, anterior y siguiente. En jukebox: saltear, pausar, AutoDJ y segundos por canción. Abrí este link en tu teléfono (logueado con tu cuenta).
        </p>
        <a href={`/control/${slug}`} className="cv-btn cv-btn-mint" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '10px 20px' }}><Ic name="phone" size={16} />Abrir control en vivo</a>
      </div>

      {/* Playlists del local */}
      <div style={block}>
        <div className="cv-mono" style={{ ...labelStyle, marginBottom: 6 }}>PLAYLISTS DEL LOCAL</div>
        <p style={{ fontSize: 13.5, color: 'var(--cv-mut)', lineHeight: 1.55, margin: '0 0 14px' }}>
          Asigná playlists de tu <Link href="/panel/playlists" style={{ color: 'var(--cv-accent)' }}>biblioteca</Link> a cada sección y elegí cuál suena.
          La que <b style={{ color: 'var(--cv-accent)' }}>está sonando</b> es la que ven y votan los clientes — solo una a la vez.
        </p>

        <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 12, background: 'rgba(var(--cv-accent-rgb),.06)', border: '1px solid rgba(var(--cv-accent-rgb),.2)' }}>
          <span className="cv-mono" style={{ fontSize: 11, letterSpacing: '.16em', color: 'var(--cv-mut)' }}>SONANDO AHORA</span>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: activeAssignment ? 'var(--cv-ink)' : 'var(--cv-faint)', marginTop: 3 }}>
            {activeAssignment ? `${activeAssignment.name}  ·  ${activeAssignment.section === 'karaoke' ? 'Karaoke' : 'Jukebox'}` : 'Ninguna playlist activa'}
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const items = assignedIn(sec.key);
          const avail = availableFor(sec.key);
          return (
            <div key={sec.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sec.accent, boxShadow: `0 0 10px ${sec.accent}` }} />
                <span className="cv-mono" style={{ fontSize: 12, letterSpacing: '.16em', color: sec.accent }}>{sec.label}</span>
              </div>
              <p className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', margin: isMobile ? '0 0 10px 0' : '0 0 10px 16px' }}>{sec.hint}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: isMobile ? 0 : 16 }}>
                {items.length === 0 && (
                  <div className="cv-mono" style={{ fontSize: 13, color: 'var(--cv-faint)' }}>sin playlists asignadas.</div>
                )}
                {items.map((a, idx) => (
                  <div key={a.id} style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                    background: a.is_active ? 'rgba(var(--cv-accent-rgb),.08)' : 'rgba(255,255,255,.02)',
                    border: a.is_active ? '1px solid rgba(var(--cv-accent-rgb),.35)' : '1px solid var(--cv-hair)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => move(a, -1)} disabled={busy || idx === 0} title="Subir"
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--cv-faint)' : 'var(--cv-mut)', fontSize: 11, lineHeight: 1, padding: 0, opacity: idx === 0 ? 0.4 : 1 }}>▲</button>
                      <button onClick={() => move(a, 1)} disabled={busy || idx === items.length - 1} title="Bajar"
                        style={{ background: 'none', border: 'none', cursor: idx === items.length - 1 ? 'default' : 'pointer', color: idx === items.length - 1 ? 'var(--cv-faint)' : 'var(--cv-mut)', fontSize: 11, lineHeight: 1, padding: 0, opacity: idx === items.length - 1 ? 0.4 : 1 }}>▼</button>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)' }}>
                        {a.count} {a.count === 1 ? 'canción' : 'canciones'}{a.mood ? ` · ${a.mood}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: isMobile ? '1 1 100%' : '0 0 auto', justifyContent: isMobile ? 'flex-end' : undefined }}>
                      {a.is_active ? (
                        <span className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cv-accent)', boxShadow: '0 0 8px var(--cv-accent)', animation: 'cvLive 1.4s ease-in-out infinite' }} />
                          Sonando
                        </span>
                      ) : (
                        <button className="cv-btn cv-btn-ghost" onClick={() => doActivate(a)} disabled={busy} style={{ fontSize: 13, padding: '7px 14px' }}>Poner a sonar</button>
                      )}
                      <button onClick={() => doUnassign(a)} disabled={busy} title="Quitar del local"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cv-warm)', fontSize: 13, padding: '4px 6px' }}>Quitar</button>
                    </div>
                  </div>
                ))}

                {avail.length > 0 ? (
                  <select className="cv-input" defaultValue="" disabled={busy}
                    onChange={(e) => { const val = e.target.value; e.currentTarget.value = ''; doAssign(sec.key, val); }}
                    style={{ marginTop: 2, fontSize: 14, color: 'var(--cv-mut)' }}>
                    <option value="" disabled>+ Asignar playlist de la biblioteca…</option>
                    {avail.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.mood ? ` · ${p.mood}` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-faint)', marginTop: 2 }}>
                    {library.some((p) => belongsToSection(p, sec.key))
                      ? 'ya asignaste todas tus playlists de esta sección.'
                      : <>no tenés playlists de esta sección · <Link href="/panel/playlists" style={{ color: 'var(--cv-accent)' }}>creá una en tu biblioteca</Link></>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* QR */}
      <div style={block}>
        <div className="cv-mono" style={{ ...labelStyle, marginBottom: 12 }}>QR PARA CLIENTES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {qr && <img src={qr} alt="QR" style={{ width: 140, height: 140, borderRadius: 12, background: '#fff', padding: 8 }} />}
          <div>
            <div className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mut)', marginBottom: 6 }}>MESA</div>
            <input className="cv-input" value={mesa} onChange={(e) => setMesa(e.target.value)} style={{ width: 90 }} />
            <p className="cv-mono" style={{ fontSize: 11, color: 'var(--cv-faint)', marginTop: 10, maxWidth: 240, lineHeight: 1.5 }}>El QR lleva al widget de este local con el número de mesa.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
