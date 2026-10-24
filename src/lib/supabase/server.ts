import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase solo se usa para las cuentas de quien organiza (link mágico por mail).
// Los planes, la gente y los puntos están en Postgres y se leen con src/lib/db.ts.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el proxy renueva la sesión.
          }
        },
      },
    },
  );
}

export type SessionUser = { id: string; email: string | null };

/** Quien inició sesión, verificado con getClaims. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
