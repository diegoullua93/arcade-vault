import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { updateSession } from "@/lib/supabase/proxy";

// SPEC 12: refresca la sesión de Supabase y aplica las reglas de acceso.
//   /perfil           sin sesión            -> /auth?next=/perfil
//   /auth             con sesión y perfil   -> next (saneado) o /biblioteca
//   /auth             con sesión sin perfil -> /auth/username
//   /auth/username    sin sesión            -> /auth
//   /auth/username    con sesión y perfil   -> next (saneado) o /biblioteca
// El resto de rutas (incluidas /auth/callback, /auth/olvide y /auth/restablecer) solo refrescan.
// La comprobación de perfil se hace únicamente en /auth y /auth/username para no
// añadir una consulta a cada petición.
export async function proxy(request: NextRequest) {
  const { response, userId, supabase } = await updateSession(request);
  const { pathname, searchParams } = request.nextUrl;
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  // Una redirección debe llevar las cookies que acaba de refrescar la sesión.
  const redirectTo = (to: string) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (path === "/perfil") {
    return userId ? response : redirectTo("/auth?next=/perfil");
  }

  if (path === "/auth" || path === "/auth/username") {
    if (!userId) return path === "/auth/username" ? redirectTo("/auth") : response;
    if (!supabase) return response;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    const next = safeNext(searchParams.get("next"));

    if (profile) return redirectTo(next);
    if (path === "/auth") {
      return redirectTo(`/auth/username?next=${encodeURIComponent(next)}`);
    }
  }

  return response;
}

export const config = {
  // Excluye estáticos, imágenes optimizadas, iconos y los binarios de /public/games.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
