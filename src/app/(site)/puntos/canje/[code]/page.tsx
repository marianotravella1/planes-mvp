import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Store } from "lucide-react";
import { currentDeviceHash } from "@/lib/device";
import { getDeviceParticipant, getRedemption } from "@/lib/queries";
import { LiveClock } from "./live-clock";

export const metadata: Metadata = { title: "Tu código" };

export default function RedemptionPage(props: PageProps<"/puntos/canje/[code]">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <RedemptionCode {...props} />
    </Suspense>
  );
}

async function RedemptionCode({ params }: PageProps<"/puntos/canje/[code]">) {
  await connection();
  const { code } = await params;
  const me = await getDeviceParticipant(await currentDeviceHash());
  // Solo el navegador de quien canjeó puede ver el código.
  const redemption = me && /^[A-Z0-9]{6}$/.test(code) ? await getRedemption(code, me.id) : null;
  if (!redemption) notFound();

  return (
    <div className="space-y-6">
      <section className="card-glow text-center">
        <p className="text-lg text-muted">Mostrá esta pantalla en el local</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{redemption.rewardTitle}</h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-lg">
          <Store aria-hidden className="size-5 text-primary-bright" />
          {redemption.businessName}
        </p>
        {redemption.rewardDescription && <p className="mt-1 text-muted">{redemption.rewardDescription}</p>}

        <p
          className="mx-auto mt-6 w-fit rounded-xl bg-white px-6 py-4 font-display text-5xl font-extrabold tracking-[0.2em] text-background tabular-nums shadow-[0_0_40px_rgb(220_38_38/0.45)]"
          aria-label={`Código ${redemption.code.split("").join(" ")}`}
        >
          {redemption.code}
        </p>
        <p className="mt-3 text-lg">A nombre de {redemption.participantName}</p>

        <div className="mt-6 border-t border-white/10 pt-6">
          <LiveClock expiresAt={redemption.expiresAt.toISOString()} />
        </div>
      </section>

      <Link href="/puntos" className="btn-secondary w-full">
        Volver a mis puntos
      </Link>
    </div>
  );
}
