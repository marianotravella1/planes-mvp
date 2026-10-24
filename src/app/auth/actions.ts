"use server";

import { redirect } from "next/navigation";
import { safeNextPath, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Ingreso con código de un solo uso: la persona escribe su mail, recibe un código y lo tipea acá.
// No hay que abrir ningún link ni confirmar el mail aparte: la primera vez crea la cuenta.
export type OtpState =
  | { status: "idle" }
  | { status: "code_sent"; email: string; error?: string }
  | { status: "error"; message: string; email: string };

const ERRORS: Record<string, string> = {
  email_address_invalid: "Ese mail no parece válido. Revisalo.",
  email_address_not_authorized: "Todavía no podemos mandar códigos a ese mail. Falta configurar el envío de mails.",
  over_email_send_rate_limit: "Mandamos muchos códigos en poco tiempo. Esperá unos minutos y probá de nuevo.",
  over_request_rate_limit: "Hubo muchos intentos seguidos. Esperá un minuto y probá de nuevo.",
  otp_expired: "El código venció o no es correcto. Pedí uno nuevo.",
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

async function sendCode(email: string) {
  const supabase = await createClient();
  // emailRedirectTo queda por si la plantilla del mail también trae el link.
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await siteUrl()}/auth/confirm` },
  });
}

export async function authenticate(prev: OtpState, formData: FormData): Promise<OtpState> {
  const intent = String(formData.get("intent") ?? "send");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (intent === "change") return { status: "idle" };
  if (!isEmail(email)) return { status: "error", message: "Revisá el mail.", email };

  if (intent === "send" || intent === "resend") {
    const { error } = await sendCode(email);
    if (error) {
      console.error("sendCode", error.code, error.message);
      const message = (error.code && ERRORS[error.code]) || "No pudimos mandar el código. Probá de nuevo en un momento.";
      return intent === "resend" ? { status: "code_sent", email, error: message } : { status: "error", message, email };
    }
    return { status: "code_sent", email };
  }

  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { status: "code_sent", email, error: "Escribí el código completo." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    console.error("verifyOtp", error.code, error.message);
    return {
      status: "code_sent",
      email,
      error: (error.code && ERRORS[error.code]) || "Ese código no es correcto. Revisalo o pedí uno nuevo.",
    };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
