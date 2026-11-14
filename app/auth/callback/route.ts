import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { configuredSiteUrl, isSiteUrlRequired } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de Supabase: confirmación de correo, recuperación de contraseña y Google.
// Intercambia el `code` (PKCE) por una sesión y redirige a `next` (saneado).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // El destino sale de SITE_URL, no de cabeceras de la petición. Solo en desarrollo, sin ella, se usa
  // el origen de la petición. En producción sin SITE_URL se responde con una ruta relativa: ninguna
  // redirección absoluta puede apuntar a un Host ajeno.
  const fixed = configuredSiteUrl();
  const base = fixed ?? (isSiteUrlRequired() ? null : origin);

  const fail = () =>
    base
      ? NextResponse.redirect(new URL("/auth?error=callback", base))
      : new NextResponse(null, { status: 307, headers: { Location: "/auth?error=callback" } });

  if (!base) {
    console.error("[auth] callback: SITE_URL no está definida o no es una URL válida");
    return fail();
  }
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
