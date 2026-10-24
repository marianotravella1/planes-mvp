import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Si la URL de retorno no está en la lista permitida de Supabase, el link mágico vuelve a la raíz
  // con ?code=. Lo derivamos a la ruta que completa el ingreso.
  if (pathname === "/") {
    if (!searchParams.has("code")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

// Solo las rutas que usan la cuenta: el resto de la app funciona sin sesión.
export const config = {
  matcher: ["/", "/crear", "/auth/:path*"],
};
