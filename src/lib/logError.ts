'use client';
import { supa } from './supabaseClient';

// Registra un error en Supabase (best-effort). NUNCA debe romper la app:
// si el logging falla, se traga el error en silencio.
//
// Dedupe por sesión: si el mismo error (mismo contexto + mensaje) ya se registró
// en esta carga de página, no lo vuelve a mandar. Así un error que se repite
// (ej: YouTube caído en cada tecla) no llena la tabla. El Set se reinicia al recargar.
const seen = new Set<string>();

export async function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    if (!message) return;

    const key = context + '|' + message;
    if (seen.has(key)) return;
    seen.add(key);

    const sb = supa();
    if (!sb) return;

    const stack = error instanceof Error ? error.stack || '' : '';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    // intentar deducir el slug del local desde la URL
    let venueSlug: string | null = null;
    const m = url.match(/\/(?:widget|control|venues)\/([^/?#]+)/);
    if (m) { try { venueSlug = decodeURIComponent(m[1]); } catch { venueSlug = m[1]; } }

    await sb.rpc('log_error', {
      p_context: context,
      p_message: message,
      p_stack: stack,
      p_url: url,
      p_user_agent: ua,
      p_venue_slug: venueSlug,
      p_extra: (extra ?? null) as never,
    });
  } catch {
    // el logging jamás debe interrumpir al usuario
  }
}
