import { createBrowserClient } from "@supabase/ssr";

// Cliente para Client Components. Se crea dentro de la función, nunca a nivel de módulo.
export function createClient() {
  // Next solo inlinea NEXT_PUBLIC_* con acceso literal a process.env.X.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return createBrowserClient(url, key);
}
