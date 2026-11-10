// Límites y validadores compartidos entre los formularios de acceso y las Server Actions.
// Los Server Actions son la fuente de verdad; el cliente solo los usa para avisar antes.

export const AUTH_LIMITS = {
  username: { min: 3, max: 10, pattern: /^[A-Z0-9_]+$/ },
  email: { max: 254 },
  password: { min: 8, max: 72 },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthField = "username" | "email" | "password";

// El username se guarda en mayúsculas (como los nombres del leaderboard).
export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateUsername(value: string): string | null {
  const { min, max, pattern } = AUTH_LIMITS.username;
  if (value.length < min || value.length > max) {
    return `El nombre debe tener entre ${min} y ${max} caracteres`;
  }
  if (!pattern.test(value)) return "Solo letras, números y guion bajo";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value || value.length > AUTH_LIMITS.email.max || !EMAIL_PATTERN.test(value)) {
    return "Correo electrónico no válido";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  const { min, max } = AUTH_LIMITS.password;
  if (value.length < min || value.length > max) {
    return `La contraseña debe tener entre ${min} y ${max} caracteres`;
  }
  return null;
}

// Evita open redirect: solo rutas relativas del propio sitio ("/perfil", no "//evil.com"
// ni "https://…" ni "/\evil.com").
export function safeNext(next: string | null | undefined, fallback = "/biblioteca"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}

// Resultados de las Server Actions de app/auth/actions.ts.
export type AuthError =
  | "invalid" // datos que no pasan la validación (ver `field`)
  | "username_taken"
  | "credentials" // correo o contraseña incorrectos (mensaje genérico)
  | "not_confirmed" // correo sin confirmar
  | "no_session" // la acción exige sesión y no la hay
  | "failed"; // error inesperado o límite de Supabase

export type AuthResult =
  | { ok: true }
  | { ok: false; error: AuthError; field?: AuthField };

export type OAuthResult = { ok: true; url: string } | { ok: false; error: "failed" };

// Texto de error para la UI (dice qué pasó y cómo arreglarlo).
export function authErrorMessage(error: AuthError, field?: AuthField): string {
  switch (error) {
    case "username_taken":
      return "Ese nombre ya está en uso. Elige otro.";
    case "credentials":
      return "Correo o contraseña incorrectos.";
    case "not_confirmed":
      return "Tu correo aún no está confirmado. Abre el enlace que te enviamos.";
    case "no_session":
      return "El enlace caducó. Pide uno nuevo.";
    case "invalid":
      return field === "username"
        ? validateUsername("") ?? "Nombre no válido"
        : field === "password"
          ? validatePassword("") ?? "Contraseña no válida"
          : "Correo electrónico no válido";
    default:
      return "No se pudo completar la acción. Inténtalo de nuevo en unos minutos.";
  }
}

export type SignUpInput = { username: string; email: string; password: string; next?: string };
export type SignInInput = { email: string; password: string };
export type UsernameInput = { username: string };
