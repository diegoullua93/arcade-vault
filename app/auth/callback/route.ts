import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de Supabase: confirmación de correo, recuperación de contraseña y Google.
// Intercambia el `code` (PKCE) por una sesión y redirige a `next` (saneado).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Detrás de un proxy inverso el origen real llega en x-forwarded-host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = forwardedHost
    ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`
    : origin;

  const fail = () => NextResponse.redirect(new URL("/auth?error=callback", base));

  if (!code) return fail();

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] callback:", error.message);
      return fail();
    }

    // La recuperación de contraseña va directa a su pantalla; el resto exige perfil.
    if (!next.startsWith("/auth/restablecer")) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (!profile) {
          const to = new URL("/auth/username", base);
          to.searchParams.set("next", next);
          return NextResponse.redirect(to);
        }
      }
    }

    return NextResponse.redirect(new URL(next, base));
  } catch (err) {
    console.error("[auth] callback:", err);
    return fail();
  }
}
