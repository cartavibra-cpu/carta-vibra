// Carta Vibra · temas curados por local
// El tema vive en venue.theme (Supabase) y se aplica como data-cv-theme en <html>.
// globals.css mapea cada id a su set de tokens (--cv-accent / --cv-theme-grad / etc.)

export const CV_THEME_IDS = [
  'vibra', 'cyan', 'fiesta',     // ELÉCTRICOS
  'cobre', 'ambar', 'vino',      // BRASA
  'tinta', 'niebla', 'salvia',   // PENUMBRA
  'lino', 'crema', 'algodon',    // LUZ
] as const;

export type CvTheme = (typeof CV_THEME_IDS)[number];

export const CV_DEFAULT_THEME: CvTheme = 'vibra';

/** Temas de fondo claro (sin glow). Útil para decisiones de UI. */
export const CV_LIGHT_THEMES: ReadonlySet<string> = new Set(['lino', 'crema', 'algodon']);

export function isCvTheme(v: unknown): v is CvTheme {
  return typeof v === 'string' && (CV_THEME_IDS as readonly string[]).includes(v);
}

/** Aplica el tema del local a la raíz del documento. Si es inválido, usa Vibra. */
export function applyCvTheme(theme?: string | null): CvTheme {
  const t: CvTheme = isCvTheme(theme) ? theme : CV_DEFAULT_THEME;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.cvTheme = t;
  }
  return t;
}

/** Clave de la paleta global (identidad de color) en localStorage. */
export const CV_THEME_LS_KEY = 'cv-theme';

/** Lee la paleta global guardada. Vibra por defecto. */
export function readGlobalTheme(): CvTheme {
  try {
    const t = typeof localStorage !== 'undefined' ? localStorage.getItem(CV_THEME_LS_KEY) : null;
    return isCvTheme(t) ? t : CV_DEFAULT_THEME;
  } catch {
    return CV_DEFAULT_THEME;
  }
}

/** Guarda la paleta global (localStorage) y la aplica al <html>. */
export function setGlobalTheme(theme?: string | null): CvTheme {
  const t = applyCvTheme(theme);
  try { localStorage.setItem(CV_THEME_LS_KEY, t); } catch {}
  return t;
}

// Metadata para el selector de tema (swatches en el panel).
// La fuente de verdad de los tokens vive en globals.css; acá solo el gradiente del swatch.
export type CvThemeMeta = { id: CvTheme; name: string; family: string; grad: string; story: string; light?: boolean };

export const CV_THEME_META: CvThemeMeta[] = [
  // ELÉCTRICOS
  { id: 'vibra',   name: 'Vibra',   family: 'Eléctricos', grad: 'linear-gradient(102deg,#b14cff,#ff4db0 50%,#ff8a5c)', story: 'violeta creativo · la insignia' },
  { id: 'cyan',    name: 'Cyan',    family: 'Eléctricos', grad: 'linear-gradient(102deg,#6a3cff,#16e0ff 50%,#6ef3b2)', story: 'cyan eléctrico · club frío' },
  { id: 'fiesta',  name: 'Fiesta',  family: 'Eléctricos', grad: 'linear-gradient(102deg,#ff3da6,#7a5cff 52%,#b6f36e)', story: 'magenta · pura fiesta' },
  // BRASA
  { id: 'cobre',   name: 'Cobre',   family: 'Brasa', grad: 'linear-gradient(102deg,#f4d9b0,#ff8a6b 52%,#e0a85c)', story: 'cobre y champagne · boutique' },
  { id: 'ambar',   name: 'Ámbar',   family: 'Brasa', grad: 'linear-gradient(102deg,#ffc24d,#ff7a4d 52%,#e05a8a)', story: 'atardecer dorado · terraza' },
  { id: 'vino',    name: 'Vino',    family: 'Brasa', grad: 'linear-gradient(102deg,#b84062,#e0688a 52%,#e8b04a)', story: 'íntimo y elegante · wine bar' },
  // PENUMBRA
  { id: 'tinta',   name: 'Tinta',   family: 'Penumbra', grad: 'linear-gradient(102deg,#7a5cff,#a08cff 52%,#d0c2ff)', story: 'oscuro sereno · sofisticado' },
  { id: 'niebla',  name: 'Niebla',  family: 'Penumbra', grad: 'linear-gradient(102deg,#c9a0e0,#d0a0c8 52%,#e0c0a0)', story: 'pastel en penumbra · sutil' },
  { id: 'salvia',  name: 'Salvia',  family: 'Penumbra', grad: 'linear-gradient(102deg,#5aa886,#7fcf9f 52%,#cfe8a0)', story: 'fresco y natural · herbal' },
  // LUZ
  { id: 'lino',    name: 'Lino',    family: 'Luz', grad: 'linear-gradient(102deg,#7a3cff,#d04bb0 52%,#e0764a)', story: 'claro y editorial · sobrio', light: true },
  { id: 'crema',   name: 'Crema',   family: 'Luz', grad: 'linear-gradient(102deg,#e0975a,#c4663b 52%,#9a4f8a)', story: 'cálido · café con leche', light: true },
  { id: 'algodon', name: 'Algodón', family: 'Luz', grad: 'linear-gradient(102deg,#b388ff,#e58ad0 52%,#ffb49a)', story: 'suave · alma pastel', light: true },
];

export const CV_THEME_FAMILIES = ['Eléctricos', 'Brasa', 'Penumbra', 'Luz'] as const;
