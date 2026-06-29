// Skins de la vista "ambiente" (la rockola que se proyecta).
// Cada skin es un MARCO de rockola (textura) con una "pantalla" 16:9 en el centro
// donde se calza el video. El código va en gradiente con CLASE fija (estable).

export type SkinName = 'neon' | 'retro';

// Posición de la "pantalla" (hueco del video) en % del contenedor de la textura.
export type Screen = { top: number; left: number; width: number; height: number };

export type Skin = {
  name: SkinName;
  label: string;
  // textura-marco del modo SIN pantalla completa (archivo en /public/textures/)
  texture: string;
  textureAspect: number;     // ancho/alto de la textura (para no deformarla)
  screen: Screen;            // hueco donde va el video (medido sobre la textura)
  bgFallback: string;        // fondo si la textura no cargó
  // clase del código en gradiente (estable, no se rompe al cambiar de skin)
  gradClass: string;
  // tarjetas semitransparentes sobre el video
  cardBg: string;
  cardBorder: string;
  // acentos
  accent: string;
  accent2: string;
  liveColor: string;
  waveColor: string;
  labelColor: string;
  textOnVideo: string;
  codeGlow: string;          // text-shadow del código
  // marco del video dentro del hueco
  frameGlow: string;
  frameBorder: string;
};

export const SKINS: Record<SkinName, Skin> = {
  neon: {
    name: 'neon',
    label: 'Neón',
    texture: '/textures/rockola-neon.jpg',
    textureAspect: 1672 / 941,
    screen: { top: 15.9, left: 15.8, width: 68.5, height: 68.5 },
    bgFallback: 'radial-gradient(900px 620px at 50% 30%, rgba(0,212,255,.12), transparent 62%), #05060d',
    gradClass: 'cv-grad-code',
    cardBg: 'rgba(6,8,16,.4)',
    cardBorder: 'rgba(0,212,255,.22)',
    accent: '#00D4FF',
    accent2: '#6EF3B2',
    liveColor: '#00D4FF',
    waveColor: '#00D4FF',
    labelColor: '#9BE8FF',
    textOnVideo: '#FFFFFF',
    codeGlow: '0 2px 22px rgba(0,212,255,.5)',
    frameGlow: '0 0 0 1px rgba(0,212,255,.16), 0 0 60px -14px rgba(0,212,255,.5)',
    frameBorder: 'rgba(0,212,255,.2)',
  },
  retro: {
    name: 'retro',
    label: 'Retro',
    texture: '/textures/rockola-retro.jpg',
    textureAspect: 1672 / 941,
    screen: { top: 11.9, left: 14.6, width: 70.5, height: 70.5 },
    bgFallback: 'radial-gradient(900px 620px at 50% 30%, rgba(242,180,92,.14), transparent 62%), #130c07',
    gradClass: 'cv-grad-code-retro',
    cardBg: 'rgba(18,11,6,.44)',
    cardBorder: 'rgba(242,180,92,.3)',
    accent: '#F2B45C',
    accent2: '#FFD98A',
    liveColor: '#F2B45C',
    waveColor: '#F2B45C',
    labelColor: '#F2C98C',
    textOnVideo: '#FFF4E6',
    codeGlow: '0 2px 22px rgba(242,180,92,.55)',
    frameGlow: '0 0 0 1px rgba(242,180,92,.2), 0 0 60px -14px rgba(242,180,92,.5)',
    frameBorder: 'rgba(242,180,92,.22)',
  },
};

export function getSkin(name: string | null | undefined): Skin {
  return name === 'retro' ? SKINS.retro : SKINS.neon;
}

// Fondo del MARCO (modo sin pantalla completa): la textura, con fallback si no cargó.
export function frameBg(skin: Skin): string {
  return `url("${skin.texture}") center / cover no-repeat, ${skin.bgFallback}`;
}

export const SKIN_STORAGE_KEY = 'cv_console_skin';

// Modo de presentación de la consola en la TV:
//  - 'marco'  : la rockola (textura) llena la pantalla, el video va en el hueco (~59% del ancho)
//  - 'limpio' : el video llena toda la pantalla, código en la esquina (máximo tamaño)
export type ViewMode = 'marco' | 'limpio';
export const VIEW_STORAGE_KEY = 'cv_console_view';
