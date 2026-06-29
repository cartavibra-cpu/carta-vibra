// Skins de la vista "ambiente" (la rockola que se proyecta).
// Dos por defecto: neón-moderna (la marca) y retro-jukebox (cálida).
// El código SIEMPRE va en gradiente con CLASE fija (estable, no se rompe al cambiar de skin).

export type SkinName = 'neon' | 'retro';

export type Skin = {
  name: SkinName;
  label: string;
  // fondo CSS de fallback (se usa atrás del video si la textura no cargó)
  bgFallback: string;
  // textura de fondo del modo SIN pantalla completa (poné el archivo en /public/textures/)
  texture: string;
  // clase del código en gradiente (estable)
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
  // glow del código (formato text-shadow / drop-shadow)
  codeGlow: string;
  // marco del video
  frameGlow: string;
  frameBorder: string;
};

export const SKINS: Record<SkinName, Skin> = {
  neon: {
    name: 'neon',
    label: 'Neón',
    bgFallback:
      'radial-gradient(900px 620px at 50% 18%, rgba(0,212,255,.14), transparent 62%), ' +
      'radial-gradient(760px 520px at 84% 108%, rgba(94,46,255,.16), transparent 60%), ' +
      'repeating-radial-gradient(circle at 50% 42%, rgba(255,255,255,.022) 0 1px, transparent 1px 26px), ' +
      '#05060d',
    texture: '/textures/rockola-neon.jpg',
    gradClass: 'cv-grad-code',
    cardBg: 'rgba(6,8,16,.42)',
    cardBorder: 'rgba(0,212,255,.22)',
    accent: '#00D4FF',
    accent2: '#6EF3B2',
    liveColor: '#00D4FF',
    waveColor: '#00D4FF',
    labelColor: '#9BE8FF',
    textOnVideo: '#FFFFFF',
    codeGlow: '0 2px 26px rgba(0,212,255,.5)',
    frameGlow: '0 0 0 1px rgba(0,212,255,.18), 0 50px 130px -40px rgba(0,212,255,.5), 0 0 90px -20px rgba(94,46,255,.4)',
    frameBorder: 'rgba(0,212,255,.22)',
  },
  retro: {
    name: 'retro',
    label: 'Retro',
    bgFallback:
      'radial-gradient(900px 620px at 50% 16%, rgba(242,180,92,.16), transparent 62%), ' +
      'radial-gradient(820px 560px at 84% 110%, rgba(232,116,59,.16), transparent 60%), ' +
      'repeating-radial-gradient(circle at 50% 42%, rgba(255,220,170,.025) 0 1px, transparent 1px 26px), ' +
      '#130c07',
    texture: '/textures/rockola-retro.jpg',
    gradClass: 'cv-grad-code-retro',
    cardBg: 'rgba(18,11,6,.46)',
    cardBorder: 'rgba(242,180,92,.3)',
    accent: '#F2B45C',
    accent2: '#FFD98A',
    liveColor: '#F2B45C',
    waveColor: '#F2B45C',
    labelColor: '#F2C98C',
    textOnVideo: '#FFF4E6',
    codeGlow: '0 2px 26px rgba(242,180,92,.55)',
    frameGlow: '0 0 0 1px rgba(242,180,92,.24), 0 50px 130px -40px rgba(232,116,59,.5), 0 0 90px -20px rgba(242,180,92,.4)',
    frameBorder: 'rgba(242,180,92,.24)',
  },
};

export function getSkin(name: string | null | undefined): Skin {
  return name === 'retro' ? SKINS.retro : SKINS.neon;
}

// Fondo del modo SIN pantalla completa: textura encima del fallback CSS.
// Si la textura no existe (404), el navegador muestra el fallback de abajo.
export function bgWithTexture(skin: Skin): string {
  return `url("${skin.texture}") center / cover no-repeat, ${skin.bgFallback}`;
}

export const SKIN_STORAGE_KEY = 'cv_console_skin';
