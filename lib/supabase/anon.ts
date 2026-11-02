import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cliente sin cookies para leer dentro de `use cache`, que no admite `cookies()`.
// Solo para datos públicos. Se crea dentro de la función, nunca a nivel de módulo.
export function createAnonClient() {
  // Next solo inlinea NEXT_PUBLIC_* con acceso literal a process.env.X.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
