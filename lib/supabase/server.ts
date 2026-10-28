import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para Server Components, Server Actions y Route Handlers.
// Crear uno nuevo en cada petición: nunca como constante de módulo ni global.
export async function createClient() {
  // Next solo inlinea NEXT_PUBLIC_* con acceso literal a process.env.X.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component, donde no se pueden escribir cookies.
          // Se ignora: el refresco de sesión llegará con el spec de Auth.
        }
      },
    },
  });
}
