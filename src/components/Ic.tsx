import React from 'react';

// Íconos SVG limpios para controles de reproducción.
// Heredan el color del texto (currentColor) → combinan con el tema/botón.
type IcName =
  | 'prev' | 'next' | 'play' | 'pause' | 'stop'
  | 'volume' | 'mute' | 'cc' | 'chevleft'
  | 'gear' | 'mic' | 'phone' | 'chevup' | 'chevdown' | 'fullscreen' | 'refresh'
  | 'music' | 'lock' | 'ban' | 'copy' | 'chat' | 'mail' | 'sliders' | 'check';

export function Ic({ name, size = 18 }: { name: IcName; size?: number }) {
  const s: React.CSSProperties = { width: size, height: size, display: 'block', flexShrink: 0 };
  switch (name) {
    case 'prev':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor" aria-hidden="true">
          <rect x="5" y="5" width="2.5" height="14" rx="1.1" />
          <path d="M19 5.7c0-.9-1-1.4-1.7-.9l-8.2 6a1.1 1.1 0 0 0 0 1.8l8.2 6c.7.5 1.7 0 1.7-.9V5.7z" />
        </svg>
      );
    case 'next':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor" aria-hidden="true">
          <path d="M5 5.7c0-.9 1-1.4 1.7-.9l8.2 6a1.1 1.1 0 0 1 0 1.8l-8.2 6c-.7.5-1.7 0-1.7-.9V5.7z" />
          <rect x="16.5" y="5" width="2.5" height="14" rx="1.1" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor" aria-hidden="true">
          <path d="M7 5.2c0-1 1.1-1.6 1.9-1l10.2 6.8a1.2 1.2 0 0 1 0 2L8.9 19.8c-.8.5-1.9-.1-1.9-1V5.2z" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor" aria-hidden="true">
          <rect x="6.4" y="5" width="3.7" height="14" rx="1.3" />
          <rect x="13.9" y="5" width="3.7" height="14" rx="1.3" />
        </svg>
      );
    case 'stop':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2.6" />
        </svg>
      );
    case 'volume':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.2v5.6h3.4L13 19V5L7.4 9.2H4z" fill="currentColor" stroke="none" />
          <path d="M16.4 9a4.4 4.4 0 0 1 0 6" />
          <path d="M18.8 6.6a7.8 7.8 0 0 1 0 10.8" />
        </svg>
      );
    case 'mute':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.2v5.6h3.4L13 19V5L7.4 9.2H4z" fill="currentColor" stroke="none" />
          <path d="M17 9.6l4.2 4.8M21.2 9.6L17 14.4" />
        </svg>
      );
    case 'cc':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5.2" width="18" height="13.6" rx="3" />
          <path d="M10.2 10.4a2.4 2.4 0 1 0 0 3.2M17.8 10.4a2.4 2.4 0 1 0 0 3.2" strokeLinecap="round" />
        </svg>
      );
    case 'chevleft':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 5l-7 7 7 7" />
        </svg>
      );
    case 'chevup':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 15l7-7 7 7" />
        </svg>
      );
    case 'chevdown':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 9l7 7 7-7" />
        </svg>
      );
    case 'gear':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 2.6l1.5 2.3 2.7-.6.4 2.7 2.5 1.1-1 2.6 1 2.6-2.5 1.1-.4 2.7-2.7-.6L12 21.4l-1.5-2.3-2.7.6-.4-2.7-2.5-1.1 1-2.6-1-2.6 2.5-1.1.4-2.7 2.7.6z" />
        </svg>
      );
    case 'mic':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M8.5 21h7" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
          <path d="M10.5 18.4h3" />
        </svg>
      );
    case 'fullscreen':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 11a8 8 0 0 0-14.3-4.4M4 5v3.5h3.5" />
          <path d="M4 13a8 8 0 0 0 14.3 4.4M20 19v-3.5h-3.5" />
        </svg>
      );
    case 'music':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 17.5V5l10-2v10" />
          <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case 'ban':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M6.2 6.2l11.6 11.6" />
        </svg>
      );
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2.4" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      );
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-8L6.5 20v-2.5H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5z" />
        </svg>
      );
    case 'mail':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
          <path d="M4 7.2l8 5.3 8-5.3" />
        </svg>
      );
    case 'sliders':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
          <circle cx="9" cy="7" r="2.1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="12" r="2.1" fill="currentColor" stroke="none" />
          <circle cx="7.5" cy="17" r="2.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.3 12.4l2.5 2.5 4.9-5.4" />
        </svg>
      );
    default:
      return null;
  }
}

export default Ic;
