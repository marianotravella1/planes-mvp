"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { authenticate, type AuthMode, type AuthState } from "@/app/auth/actions";

type Props = { next: string };

/** Ingreso con usuario y contraseña, sin mails. Crear la cuenta y entrar son la misma pantalla. */
export function LoginCard({ next }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, { mode: "signup" });
  const [mode, setMode] = useState<AuthMode>(state.mode);
  const [showPassword, setShowPassword] = useState(false);
  const signup = mode === "signup";

  return (
    <section className="card-glow" aria-labelledby="login-title">
      <h2 id="login-title" className="font-display text-2xl font-extrabold">
        {signup ? "Creá tu cuenta para organizar" : "Entrá para armar el plan"}
      </h2>
      <p className="mt-2 text-muted">
        {signup
          ? "Solo un usuario y una contraseña. Para sumarte a un plan no hace falta cuenta."
          : "Con el usuario y la contraseña que elegiste."}
      </p>

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />
        <div>
          <label htmlFor="username" className="field-label">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="valen.rosario"
            maxLength={30}
            required
            defaultValue={state.username}
            aria-invalid={state.fieldErrors?.username ? true : undefined}
            aria-describedby={state.fieldErrors?.username ? "username-error" : undefined}
          />
          {state.fieldErrors?.username && (
            <p id="username-error" className="field-error">
              {state.fieldErrors.username}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="input pr-14"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={6}
              aria-invalid={state.fieldErrors?.password ? true : undefined}
              aria-describedby={state.fieldErrors?.password ? "password-error" : "password-hint"}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p id="password-error" className="field-error">
              {state.fieldErrors.password}
            </p>
          ) : (
            signup && (
              <p id="password-hint" className="field-hint">
                Al menos 6 caracteres.
              </p>
            )
          )}
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 font-medium text-danger">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full text-lg" disabled={pending}>
          {pending ? "Un momento..." : signup ? "Crear cuenta" : "Entrar"}
          {!pending && <ArrowRight aria-hidden className="size-5" />}
        </button>
      </form>

      <p className="mt-4 text-center text-muted">
        {signup ? "¿Ya tenés cuenta? " : "¿Primera vez? "}
        <button
          type="button"
          className="min-h-11 font-semibold text-primary-bright underline"
          onClick={() => setMode(signup ? "login" : "signup")}
        >
          {signup ? "Entrá" : "Creá una cuenta"}
        </button>
      </p>
    </section>
  );
}
