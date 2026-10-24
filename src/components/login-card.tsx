"use client";

import { useActionState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { authenticate, type OtpState } from "@/app/auth/actions";

type Props = { next: string; linkFailed?: boolean };

/** Ingreso sin contraseña en dos pasos: mail y después el código que llega a ese mail. */
export function LoginCard({ next, linkFailed }: Props) {
  const [state, formAction, pending] = useActionState<OtpState, FormData>(authenticate, { status: "idle" });

  if (state.status === "code_sent") {
    return (
      <section className="card-glow" aria-labelledby="login-title">
        <h2 id="login-title" className="font-display text-2xl font-extrabold">
          Escribí el código
        </h2>
        <p className="mt-2 text-muted">
          Te lo mandamos a <strong className="text-foreground">{state.email}</strong>. Si no aparece, fijate en spam.
        </p>

        <form action={formAction} className="mt-5 space-y-4" noValidate>
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="token" className="field-label">
              Código
            </label>
            <input
              id="token"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              autoFocus
              className="input text-center font-display text-3xl font-extrabold tracking-[0.4em] tabular-nums"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "token-error" : undefined}
            />
            {state.error && (
              <p id="token-error" role="alert" className="field-error">
                {state.error}
              </p>
            )}
          </div>
          <button type="submit" name="intent" value="verify" className="btn-primary w-full text-lg" disabled={pending}>
            {pending ? "Verificando..." : "Entrar"}
            {!pending && <ArrowRight aria-hidden className="size-5" />}
          </button>
          <div className="flex justify-between gap-3 text-sm">
            <button
              type="submit"
              name="intent"
              value="resend"
              className="min-h-11 font-semibold text-primary-bright underline"
              disabled={pending}
            >
              Mandarme otro código
            </button>
            <button
              type="submit"
              name="intent"
              value="change"
              className="min-h-11 font-semibold text-muted underline"
              disabled={pending}
            >
              Cambiar el mail
            </button>
          </div>
        </form>
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
        Para organizar necesitás una cuenta, sin contraseña. Te mandamos un código al mail, lo escribís acá y listo. Para
        sumarte a un plan no hace falta.
      </p>

      {linkFailed && !error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
          Ese link ya venció. Pedí un código nuevo.
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
        <button type="submit" name="intent" value="send" className="btn-primary w-full text-lg" disabled={pending}>
          <Mail aria-hidden className="size-5" />
          {pending ? "Mandando..." : "Mandame el código"}
        </button>
      </form>
    </section>
  );
}
