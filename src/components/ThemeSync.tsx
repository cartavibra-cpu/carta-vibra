'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { applyCvTheme, readGlobalTheme } from '@/lib/theme';

// Rutas con tema propio del local (leen venue.theme). No se les impone la paleta global.
const VENUE_ROUTES = ['/console', '/control', '/widget'];

/**
 * Mantiene la paleta global (identidad) aplicada en todo el "chrome"
 * (landing, panel, secciones). Al navegar client-side desde la consola
 * de vuelta al panel, reafirma la paleta global → el tema del local ya
 * no queda pegado en el <html>.
 */
export default function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    const isVenue = VENUE_ROUTES.some((r) => pathname === r || (pathname?.startsWith(r + '/') ?? false));
    if (!isVenue) applyCvTheme(readGlobalTheme());
  }, [pathname]);
  return null;
}
