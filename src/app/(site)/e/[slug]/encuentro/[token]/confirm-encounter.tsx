"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, MessageCircleQuestion, Users } from "lucide-react";
import type { MeetResult } from "../../llegue/actions";
import { meet } from "../../llegue/actions";

/** Confirmación del encuentro cuando el QR se escaneó con la cámara del teléfono. */
export function ConfirmEncounter({ slug, token, name }: { slug: string; token: string; name: string }) {
  const [result, setResult] = useState<MeetResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.status === "met") {
    return (
      <section className="card-glow text-center" role="status">
        <CircleCheck aria-hidden className="mx-auto size-12 text-success" />
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
          {result.alreadyMet ? `Ya te habías encontrado con ${result.name}` : `¡Te encontraste con ${result.name}!`}
        </h1>
        {result.points > 0 && <p className="mt-2 text-lg text-muted">Sumaste {result.points} puntos.</p>}
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-bright">
            <MessageCircleQuestion aria-hidden className="size-4" />
            Para arrancar la charla
          </p>
          <p className="mt-1 text-lg font-semibold">{result.question}</p>
        </div>
        <Link href={`/e/${slug}/llegue`} className="btn-primary mt-6 w-full">
          Encontrarme con alguien más
        </Link>
      </section>
    );
  }

  return (
    <section className="card-glow text-center">
      <Users aria-hidden className="mx-auto size-12 text-primary-bright" />
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Encuentro con {name}</h1>
      <p className="mt-2 text-lg text-muted">Confirmá que están juntos en el plan.</p>
      {result?.status === "error" && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
          {result.message}
        </p>
      )}
      <button
        type="button"
        className="btn-primary mt-6 w-full text-lg"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await meet(slug, token)))}
      >
        {pending ? "Confirmando..." : "Confirmar encuentro"}
      </button>
      <Link href={`/e/${slug}/llegue`} className="btn-secondary mt-3 w-full">
        Abrir mi QR
      </Link>
    </section>
  );
}
