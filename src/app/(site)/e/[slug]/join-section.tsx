"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Coins } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp-icon";
import { whatsappShareUrl } from "@/lib/share";
import type { JoinState } from "./actions";
import { PointsDialog } from "./points-dialog";

type Props = {
  joinAction: (prev: JoinState, formData: FormData) => Promise<JoinState>;
  pointsReward: number;
  isMember: boolean;
  isHost: boolean;
  isFull: boolean;
  isFinished: boolean;
  knownName: string | null;
  knownPhone: string | null;
  balance: number | null;
  share: { url: string; text: string };
};

/**
 * Siempre se renderiza en el mismo lugar del árbol: así, cuando la página se actualiza
 * después de sumarse, el estado de la acción sigue vivo y el cartel de puntos no se pierde.
 */
export function JoinSection(props: Props) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(props.joinAction, { status: "idle" });
  const [editing, setEditing] = useState(false);

  const joined = props.isMember || state.status === "joined";
  const errorState = state.status === "error" ? state : null;
  const inviteUrl = whatsappShareUrl(props.share.text, props.share.url);

  return (
    <section aria-labelledby="join-title" className={joined ? "card" : "card-glow"}>
      {state.status === "joined" && <PointsDialog key={state.at} result={state} inviteUrl={inviteUrl} />}

      {joined ? (
        <div className="space-y-4">
          <h2 id="join-title" className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <CircleCheck aria-hidden className="size-7 text-success" />
            {props.isHost ? "Organizás este plan" : "Ya estás en la lista"}
          </h2>
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
            <WhatsappIcon className="size-5" />
            Invitar por WhatsApp
          </a>
          {props.balance !== null && props.balance > 0 && (
            <Link href="/puntos" className="btn-secondary w-full">
              <Coins aria-hidden className="size-5 text-primary-bright" />
              Tenés {props.balance} puntos para canjear
            </Link>
          )}
        </div>
      ) : props.isFinished ? (
        <h2 id="join-title" className="font-display text-2xl font-extrabold">
          Este plan ya pasó
        </h2>
      ) : props.isFull ? (
        <div>
          <h2 id="join-title" className="font-display text-2xl font-extrabold">
            Se llenó
          </h2>
          <p className="mt-2 text-muted">No quedan lugares. Fijate si hay otro plan que te guste.</p>
          <Link href="/" className="btn-secondary mt-4 w-full">
            Ver otros planes
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4" noValidate>
          <div>
            <h2 id="join-title" className="font-display text-2xl font-extrabold">
              Sumate
            </h2>
            {props.pointsReward > 0 && (
              <p className="mt-1 flex items-center gap-2 text-muted">
                <Coins aria-hidden className="size-5 shrink-0 text-primary-bright" />
                Sumás {props.pointsReward} puntos para canjear en lugares aliados.
              </p>
            )}
          </div>

          {props.knownName && props.knownPhone && !editing && !errorState ? (
            <>
              <input type="hidden" name="name" value={props.knownName} />
              <input type="hidden" name="phone" value={props.knownPhone} />
              <p>
                Te sumás como <strong>{props.knownName}</strong> ({props.knownPhone}).{" "}
                <button
                  type="button"
                  className="font-semibold text-primary-bright underline"
                  onClick={() => setEditing(true)}
                >
                  Usar otros datos
                </button>
              </p>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="name" className="field-label">
                  Tu nombre
                </label>
                <input
                  id="name"
                  name="name"
                  className="input"
                  autoComplete="given-name"
                  maxLength={40}
                  required
                  defaultValue={errorState?.values.name ?? props.knownName ?? ""}
                  aria-invalid={errorState?.fieldErrors?.name ? true : undefined}
                  aria-describedby={errorState?.fieldErrors?.name ? "name-error" : undefined}
                />
                {errorState?.fieldErrors?.name && (
                  <p id="name-error" className="field-error">
                    {errorState.fieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="phone" className="field-label">
                  Tu teléfono
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  className="input"
                  autoComplete="tel"
                  placeholder="341 555 1234"
                  required
                  defaultValue={errorState?.values.phone ?? ""}
                  aria-invalid={errorState?.fieldErrors?.phone ? true : undefined}
                  aria-describedby={errorState?.fieldErrors?.phone ? "phone-error" : "phone-hint"}
                />
                {errorState?.fieldErrors?.phone ? (
                  <p id="phone-error" className="field-error">
                    {errorState.fieldErrors.phone}
                  </p>
                ) : (
                  <p id="phone-hint" className="field-hint">
                    No hace falta crear una cuenta. Tu número no se muestra a nadie.
                  </p>
                )}
              </div>
            </>
          )}

          {errorState?.message && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 font-medium text-danger">
              {errorState.message}
            </p>
          )}

          <button type="submit" className="btn-primary w-full text-lg" disabled={pending}>
            {pending ? "Anotándote..." : "Me sumo"}
            {!pending && <ArrowRight aria-hidden className="size-5" />}
          </button>
        </form>
      )}
    </section>
  );
}
