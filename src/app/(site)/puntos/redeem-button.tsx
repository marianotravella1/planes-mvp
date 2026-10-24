"use client";

import { useActionState, useState } from "react";
import { redeemReward, type RedeemState } from "./actions";

type Props = { rewardId: string; costPoints: number; balance: number };

/** Pide confirmación antes de gastar los puntos, para evitar canjes por un toque sin querer. */
export function RedeemButton({ rewardId, costPoints, balance }: Props) {
  const [state, formAction, pending] = useActionState<RedeemState, FormData>(redeemReward, {});
  const [confirming, setConfirming] = useState(false);
  const missing = costPoints - balance;

  if (missing > 0) {
    return (
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-linear-to-r from-primary to-primary-bright" style={{ width: `${Math.round((balance / costPoints) * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-muted">Te faltan {missing} puntos</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="rewardId" value={rewardId} />
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Se descuentan {costPoints} puntos y te damos un código para mostrar en el local.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Canjeando..." : "Confirmar"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary w-full" onClick={() => setConfirming(true)}>
          Canjear
        </button>
      )}
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
