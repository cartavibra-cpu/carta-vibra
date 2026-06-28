'use client';
import { useState, useEffect } from 'react';

// Detecta viewport angosto (celular). Arranca en false para que el render del
// servidor y el primer render del cliente coincidan (sin hydration mismatch);
// se ajusta apenas monta. Pensado para estilos en línea, donde los media queries
// de CSS no pueden pisar el style inline.
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}
