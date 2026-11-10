import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Paso 2 del SPEC 12: solo refresca la sesión. Las redirecciones de rutas protegidas llegan en el paso 7.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  // Excluye estáticos, imágenes optimizadas, iconos y los binarios de /public/games.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
