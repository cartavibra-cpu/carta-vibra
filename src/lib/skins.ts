// Skins de la vista "ambiente" (la rockola que se proyecta).
// Dos por defecto: neón-moderna (la marca) y retro-jukebox (cálida).
// El código SIEMPRE va en gradiente (identidad) — solo cambia el color según skin.

export type SkinName = 'neon' | 'retro';

export type Skin = {
  name: SkinName;
  label: string;
  // fondo de la página (atrás del video)
  bg: string;
  // panel semitransparente que va sobre el video
  panel: string;
  panelBorder: string;
  // acentos
  accent: string;
  accent2: string;
  liveColor: string;
  waveColor: string;
  labelColor: string;
  textOnVideo: string;
  // código (héroe en gradiente)
  codeGradient: string;
  codeGlow: string;
  // marco del video
  frameGlow: string;
  frameBorder: string;
};

export const SKINS: Record<SkinName, Skin> = {
  neon: {
    name: 'neon',
    label: 'Neón',
    bg: 'radial-gradient(1100px 760px at 50% 46%, rgba(0,212,255,.10), transparent 60%), #060810',
    panel: 'linear-gradient(0deg, rgba(6,8,16,.92) 0%, rgba(6,8,16,.78) 55%, rgba(6,8,16,0) 100%)',
    panelBorder: 'rgba(0,212,255,.22)',
    accent: '#00D4FF',
    accent2: '#6EF3B2',
    liveColor: '#00D4FF',
    waveColor: '#00D4FF',
    labelColor: '#9BE8FF',
    textOnVideo: '#FFFFFF',
    codeGradient: 'linear-gradient(92deg, #5E2EFF, #00D4FF 46%, #6EF3B2)',
    codeGlow: '0 2px 30px rgba(0,212,255,.45)',
    frameGlow: '0 0 0 1px rgba(0,212,255,.16), 0 40px 120px -40px rgba(0,212,255,.4)',
    frameBorder: 'rgba(0,212,255,.18)',
  },
  retro: {
    name: 'retro',
    label: 'Retro',
    bg: 'radial-gradient(1100px 760px at 50% 28%, rgba(242,180,92,.14), transparent 60%), radial-gradient(900px 640px at 82% 112%, rgba(232,116,59,.12), transparent 60%), #140d08',
    panel: 'linear-gradient(0deg, rgba(18,11,6,.93) 0%, rgba(18,11,6,.8) 55%, rgba(18,11,6,0) 100%)',
    panelBorder: 'rgba(242,180,92,.3)',
    accent: '#F2B45C',
    accent2: '#FFD98A',
    liveColor: '#F2B45C',
    waveColor: '#F2B45C',
    labelColor: '#F2C98C',
    textOnVideo: '#FFF4E6',
    codeGradient: 'linear-gradient(92deg, #E8743B, #F2B45C 48%, #FFE3A0)',
    codeGlow: '0 2px 30px rgba(242,180,92,.5)',
    frameGlow: '0 0 0 1px rgba(242,180,92,.22), 0 40px 120px -40px rgba(232,116,59,.45)',
    frameBorder: 'rgba(242,180,92,.22)',
  },
};

export function getSkin(name: string | null | undefined): Skin {
  return name === 'retro' ? SKINS.retro : SKINS.neon;
}

export const SKIN_STORAGE_KEY = 'cv_console_skin';
