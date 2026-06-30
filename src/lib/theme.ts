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
