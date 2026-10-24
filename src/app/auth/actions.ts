"use server";

import { safeNextPath, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const ERRORS: Record<string, string> = {
  email_address_invalid: "Ese mail no parece válido. Revisalo.",
  email_address_not_authorized:
    "Ese mail todavía no puede recibir links. Falta configurar el envío de mails en Supabase.",
  over_email_send_rate_limit: "Mandamos muchos mails en poco tiempo. Esperá unos minutos y probá de nuevo.",
  over_request_rate_limit: "Hubo muchos intentos seguidos. Esperá un minuto y probá de nuevo.",
};

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { status: "error", message: "Revisá el mail.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    console.error("sendMagicLink", error.code, error.message);
    return {
      status: "error",
      message: (error.code && ERRORS[error.code]) || "No pudimos mandar el link. Probá de nuevo en un momento.",
      email,
    };
  }
  return { status: "sent", email };
}
