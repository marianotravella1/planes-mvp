"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteEvent, removeMember, type ManageState } from "./manage-actions";

/** Cruz para quitar a una persona del plan. Pide confirmación antes. */
export function RemoveMemberButton({
  slug,
  participantId,
  name,
}: {
  slug: string;
  participantId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<ManageState, FormData>(
    removeMember.bind(null, slug, participantId),
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Quitar a ${name} del plan? Se le descuentan los puntos que sumó por este plan.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={pending}
        aria-label={`Quitar a ${name}`}
        title={state.error ?? `Quitar a ${name}`}
        className="-my-1 -mr-3 ml-1 inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-danger disabled:opacity-50"
      >
        <X aria-hidden className="size-4" />
      </button>
    </form>
  );
}

/** Editar y eliminar el plan, solo para quien lo organiza. */
export function HostActions({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<ManageState, FormData>(deleteEvent.bind(null, slug), {});

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/e/${slug}/editar`} className="btn-secondary">
          <Pencil aria-hidden className="size-5" />
          Editar
        </Link>
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!window.confirm("¿Eliminar el plan? Se borra la lista de gente y no se puede deshacer.")) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={pending}
            className="btn-secondary w-full border-danger/40 text-danger hover:bg-danger/10"
          >
            <Trash2 aria-hidden className="size-5" />
            {pending ? "Eliminando..." : "Eliminar"}
          </button>
        </form>
      </div>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
    </div>
  );
}
