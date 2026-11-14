"use server";

import { headers } from "next/headers";
import {
  normalizeUsername,
  safeNext,
  validateEmail,
  validatePassword,
  validateUsername,
  type AuthResult,
  type OAuthResult,
  type SignInInput,
  type SignUpInput,
  type UsernameInput,
} from "@/lib/auth";
import { configuredSiteUrl, isSiteUrlRequired } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Quita caracteres de control y recorta (los campos vienen de un formulario del navegador).
function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() : "";
}

// Origen del sitio para los enlaces de los correos y el retorno de OAuth. Sale de SITE_URL; solo en
// desarrollo, sin ella, del Host de la petición. En producción sin SITE_URL lanza (las acciones lo
// capturan, lo registran y responden `failed`).
async function getOrigin(): Promise<string> {
  const fixed = configuredSiteUrl();
  if (fixed) return fixed;
  if (isSiteUrlRequired()) throw new Error("SITE_URL no está definida o no es una URL válida");
  const host = (await headers()).get("host");
  if (!host) throw new Error("Falta la cabecera Host");
  return `http://${host}`;
}

async function callbackUrl(next?: string): Promise<string> {
  const url = new URL("/auth/callback", await getOrigin());
  if (next) url.searchParams.set("next", safeNext(next));
  return url.toString();
}

async function isUsernameAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  username: string,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("is_username_available", { p_username: username });
  return error ? null : data;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const username = normalizeUsername(clean(input?.username));
  const email = clean(input?.email);
  const password = typeof input?.password === "string" ? input.password : "";

  if (validateUsername(username)) return { ok: false, error: "invalid", field: "username" };
  if (validateEmail(email)) return { ok: false, error: "invalid", field: "email" };
  if (validatePassword(password)) return { ok: false, error: "invalid", field: "password" };

  try {
    const supabase = await createClient();

    const available = await isUsernameAvailable(supabase, username);
    if (available === null) return { ok: false, error: "failed" };
    if (!available) return { ok: false, error: "username_taken", field: "username" };

    // El trigger on_auth_user_created crea el perfil con este username.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: await callbackUrl(input?.next) },
    });
    if (error) {
      // Carrera: el índice único del perfil hizo fallar el trigger.
      if (/database error/i.test(error.message)) {
        return { ok: false, error: "username_taken", field: "username" };
      }
      console.error("[auth] signUp:", error.message);
      return { ok: false, error: "failed" };
    }

    // Si el correo ya estaba registrado, Supabase responde igual (no revela qué correos existen).
    return { ok: true };
  } catch (err) {
    console.error("[auth] signUp:", err);
    return { ok: false, error: "failed" };
  }
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  const email = clean(input?.email);
  const password = typeof input?.password === "string" ? input.password : "";

  if (validateEmail(email) || !password) return { ok: false, error: "credentials" };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "email_not_confirmed") return { ok: false, error: "not_confirmed" };
      // Mensaje genérico: no revela si el correo existe.
      if (error.code === "invalid_credentials") return { ok: false, error: "credentials" };
      console.error("[auth] signIn:", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[auth] signIn:", err);
    return { ok: false, error: "failed" };
  }
}

export async function signInWithGoogle(next?: string): Promise<OAuthResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: await callbackUrl(next), skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      console.error("[auth] google:", error?.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    console.error("[auth] google:", err);
    return { ok: false, error: "failed" };
  }
}

export async function requestPasswordReset(input: { email: string }): Promise<AuthResult> {
  const email = clean(input?.email);
  if (validateEmail(email)) return { ok: false, error: "invalid", field: "email" };

  try {
    const supabase = await createClient();
    // El enlace pasa por /auth/callback y aterriza en /auth/restablecer.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: await callbackUrl("/auth/restablecer"),
    });
    if (error) {
      console.error("[auth] reset:", error.message);
      return { ok: false, error: "failed" };
    }
    // Siempre éxito si el correo es válido: no revela si existe.
    return { ok: true };
  } catch (err) {
    console.error("[auth] reset:", err);
    return { ok: false, error: "failed" };
  }
}

export async function updatePassword(input: { password: string }): Promise<AuthResult> {
  const password = typeof input?.password === "string" ? input.password : "";
  if (validatePassword(password)) return { ok: false, error: "invalid", field: "password" };

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, error: "no_session" };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("[auth] updatePassword:", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[auth] updatePassword:", err);
    return { ok: false, error: "failed" };
  }
}

// Para quien entra sin perfil (p. ej. con Google): crea su fila en `profiles`.
export async function createProfile(input: UsernameInput): Promise<AuthResult> {
  const username = normalizeUsername(clean(input?.username));
  if (validateUsername(username)) return { ok: false, error: "invalid", field: "username" };

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, error: "no_session" };

    const available = await isUsernameAvailable(supabase, username);
    if (available === null) return { ok: false, error: "failed" };
    if (!available) return { ok: false, error: "username_taken", field: "username" };

    const { error } = await supabase.from("profiles").insert({ id: data.user.id, username });
    if (error) {
      // 23505: unique_violation (carrera de username, o el usuario ya tenía perfil).
      if (error.code === "23505") return { ok: false, error: "username_taken", field: "username" };
      console.error("[auth] createProfile:", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[auth] createProfile:", err);
    return { ok: false, error: "failed" };
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] signOut:", error.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[auth] signOut:", err);
    return { ok: false, error: "failed" };
  }
}
