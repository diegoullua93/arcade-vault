// Origen público del sitio (solo servidor). SEC-04: los enlaces de los correos de Supabase y el
// retorno de OAuth no deben salir de cabeceras que controla quien hace la petición (Host,
// X-Forwarded-Host), o un atacante podría mandar un enlace de recuperación a su propio dominio.

// SITE_URL normalizada a su origen (sin barra final ni ruta), o null si falta o no es una URL.
export function configuredSiteUrl(): string | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// En producción SITE_URL es obligatoria. En desarrollo es opcional: sin ella se usa el origen de la
// petición, para no romper localhost con puertos variables ni las pruebas por LAN.
export function isSiteUrlRequired(): boolean {
  return process.env.NODE_ENV === "production";
}
