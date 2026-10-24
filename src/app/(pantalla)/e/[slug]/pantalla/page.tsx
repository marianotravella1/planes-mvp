import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { firstName, formatWhen } from "@/lib/format";
import { getEvent, getEventStats } from "@/lib/queries";
import { eventPath, qrSvg, siteUrl } from "@/lib/site";
import { LiveCount } from "./live-count";

export const metadata: Metadata = { title: "Pantalla" };

// Vista para el proyector: QR enorme sobre blanco (para que se lea de lejos) y contador en vivo.
export default function ScreenPage(props: PageProps<"/e/[slug]/pantalla">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Screen {...props} />
    </Suspense>
  );
}

async function Screen({ params }: PageProps<"/e/[slug]/pantalla">) {
  await connection();
  const { slug } = await params;
  const [event, stats, baseUrl] = await Promise.all([getEvent(slug), getEventStats(slug), siteUrl()]);
  if (!event || !stats) notFound();

  const url = `${baseUrl}${eventPath(slug)}`;
  const qr = await qrSvg(url);

  return (
    <div className="grid min-h-screen grid-cols-1 items-center gap-10 p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-14">
      <div className="flex flex-col items-center">
        <div
          className="aspect-square w-full max-w-[min(72vh,100%)] rounded-2xl bg-white p-2 shadow-[0_0_80px_rgb(220_38_38/0.35)] [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label={`Código QR para sumarse a ${event.title}`}
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </div>

      <div>
        <p className="text-2xl font-semibold text-primary-bright">Escaneá y sumate en {APP_NAME}</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-balance lg:text-7xl">
          {event.title}
        </h1>
        <p className="mt-4 text-3xl">
          {formatWhen(event.startsAt)} en <strong>{event.placeName ?? event.address}</strong>
        </p>
        <p className="mt-1 text-2xl text-muted">Organiza {firstName(event.hostName)}</p>
        <div className="mt-10">
          <LiveCount slug={slug} initial={{ ...stats, recentNames: stats.recentNames.map(firstName) }} />
        </div>
      </div>
    </div>
  );
}
