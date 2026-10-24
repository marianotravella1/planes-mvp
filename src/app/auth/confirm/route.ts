import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site";

// Destino del link mágico. Acepta las dos variantes de Supabase:
// ?code= (plantilla de mail por defecto) y ?token_hash=&type= (plantilla personalizada).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("auth/confirm code", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    if (error) console.error("auth/confirm token_hash", error.message);
  }

  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = ok ? next : "/crear";
  if (!ok) target.searchParams.set("error", "link");
  return NextResponse.redirect(target);
}
