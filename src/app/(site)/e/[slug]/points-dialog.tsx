"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp-icon";
import type { JoinState } from "./actions";

type Joined = Extract<JoinState, { status: "joined" }>;

/** El cartel que aparece al sumarse: cuántos puntos sumó y cuántos tiene en total. */
export function PointsDialog({
  result,
  inviteUrl,
  pointsReward,
}: {
  result: Joined;
  inviteUrl: string;
  pointsReward: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const close = () => dialog.current?.close();
  const earned = result.pointsAwarded > 0;

  let title = "¡Listo, estás en la lista!";
  let detail: string | null =
    pointsReward > 0
      ? `Cuando llegues, tocá Llegué y escaneá el QR de otra persona del plan. Así se confirma que fuiste y sumás ${pointsReward} puntos.`
      : null;
  if (result.alreadyMember) {
    title = "Ya estabas en la lista";
    detail = "Los puntos de este plan ya los sumaste.";
  } else if (earned) {
    title = `¡Sumaste ${result.pointsAwarded} puntos!`;
    detail =
      result.deviceLinked && result.balance !== null
        ? `Ahora tenés ${result.balance} puntos para canjear por descuentos en lugares aliados.`
        : "Quedaron en tu número. Para verlos y canjearlos, abrí la app desde el teléfono donde te anotaste la primera vez.";
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="points-title"
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-primary/30 bg-card p-0 text-foreground shadow-[0_0_60px_rgb(220_38_38/0.35)] backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      onClick={(event) => {
        // Tocar el fondo cierra el cartel.
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="animate-pop-in bg-linear-to-b from-primary/20 to-transparent p-6 text-center">
        {earned && (
          <div
            aria-hidden
            className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-linear-to-br from-primary-bright to-primary font-display text-3xl font-extrabold text-white shadow-[0_0_40px_rgb(220_38_38/0.6)]"
          >
            +{result.pointsAwarded}
          </div>
        )}
        <h2 id="points-title" className="font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h2>
        {detail && <p className="mt-2 text-lg text-muted">{detail}</p>}

        <div className="mt-6 space-y-3">
          {earned && result.deviceLinked && (
            <Link href="/puntos" className="btn-primary w-full">
              <Coins aria-hidden className="size-5" />
              Ver mis puntos
            </Link>
          )}
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
            <WhatsappIcon className="size-5" />
            Invitar por WhatsApp
          </a>
          <button type="button" className="btn-secondary w-full" onClick={close} autoFocus>
            Listo
          </button>
        </div>
      </div>
    </dialog>
  );
}
