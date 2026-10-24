"use client";

import { useActionState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { sendMagicLink, type MagicLinkState } from "@/app/auth/actions";

type Props = { next: string; linkFailed?: boolean };

/** Ingreso sin contraseña: Supabase manda un link al mail y al abrirlo queda la sesión iniciada. */
export function LoginCard({ next, linkFailed }: Props) {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <section className="card-glow text-center" aria-live="polite">
        <MailCheck aria-hidden className="mx-auto size-10 text-primary-bright" />
        <h2 className="mt-3 font-display text-2xl font-extrabold">Revisá tu mail</h2>
        <p className="mt-2 text-muted">
          Te mandamos un link a <strong className="text-foreground">{state.email}</strong>. Abrilo desde este mismo
          teléfono y volvés acá con la sesión iniciada.
        </p>
      </section>
    );
  }

  const error = state.status === "error" ? state : null;

  return (
    <section className="card-glow" aria-labelledby="login-title">
      <h2 id="login-title" className="font-display text-2xl font-extrabold">
        Entrá para armar el plan
      </h2>
      <p className="mt-2 text-muted">
        Para organizar necesitás una cuenta, sin contraseña. Te mandamos un link a tu mail y entrás con un toque. Para
        sumarte a un plan no hace falta.
      </p>

      {linkFailed && !error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
          Ese link ya venció o se abrió en otro navegador. Pedí uno nuevo.
        </p>
      )}

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="field-label">
            Tu mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            placeholder="vos@mail.com"
            required
            defaultValue={error?.email}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "email-error" : undefined}
          />
          {error && (
            <p id="email-error" className="field-error">
              {error.message}
            </p>
          )}
        </div>
        <button type="submit" className="btn-primary w-full text-lg" disabled={pending}>
          <Mail aria-hidden className="size-5" />
          {pending ? "Mandando..." : "Mandame el link"}
        </button>
      </form>
    </section>
  );
}
