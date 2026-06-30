// Filtro liviano de nombres (estilo Kahoot). Bloquea ordinarieces evidentes
// para que no aparezcan en grande en la pantalla del local. Moderado: NO bloquea
// apodos comunes cariñosos. Ajustable; el server igual limita el largo a 24.

const BLOCK = new Set<string>([
  'puta', 'puto', 'putas', 'putos', 'putita', 'putito',
  'culiao', 'culia', 'culiá', 'reculiao', 'culiaos',
  'conchetumare', 'conchatumadre', 'conchadetumadre', 'ctm', 'chuchetumare',
  'weon', 'weón', 'aweonao', 'aweonado', 'wn', 'qlo', 'qla', 'culiada',
  'maricon', 'maricón', 'maraco', 'maraca', 'maricueca', 'maricueco',
  'pico', 'pichula', 'pichulas', 'tula', 'verga', 'vergon', 'vergón',
  'pene', 'pendejo', 'pendeja', 'pendejos', 'zorra', 'zorras', 'perra',
  'mierda', 'mierdas', 'cagada', 'chucha', 'choro',
  'concha', 'conchuda', 'conchudo', 'forro', 'forra',
  'violador', 'violadores', 'pedofilo', 'pedófilo', 'sidoso', 'nazi', 'hitler',
]);

// Subcadenas "duras" (atrapan trucos de espaciado/relleno como "p u t a").
const HARD = [
  'conchetumare', 'conchatumadre', 'culiao', 'pichula', 'violador', 'pedofil',
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function cleanName(raw: string): { ok: boolean; reason?: string } {
  const t = (raw ?? '').trim();
  if (!t) return { ok: false, reason: 'Escribí un nombre o elegí anónimo.' };
  if (t.length > 24) return { ok: false, reason: 'Máximo 24 caracteres.' };

  const n = norm(t);
  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((tok) => BLOCK.has(tok))) return { ok: false, reason: 'Ese nombre mejor no 😅 elegí otro.' };

  const compact = n.replace(/[^a-z0-9]/g, '');
  if (HARD.some((h) => compact.includes(h))) return { ok: false, reason: 'Ese nombre mejor no 😅 elegí otro.' };

  return { ok: true };
}
