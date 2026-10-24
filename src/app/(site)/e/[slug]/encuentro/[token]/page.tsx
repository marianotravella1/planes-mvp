import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentDeviceHash } from "@/lib/device";
import { readEncounterToken } from "@/lib/encounter-token";
import { firstName } from "@/lib/format";
import { getDeviceParticipant, getEvent, getParticipantName, isEventMember } from "@/lib/queries";
import { eventPath } from "@/lib/site";
import { ConfirmEncounter } from "./confirm-encounter";

export const metadata: Metadata = { title: "Encuentro", robots: { index: false } };

// Lo que abre el QR si se escanea con la cámara del teléfono en lugar de hacerlo desde Tiki.
export default function EncounterPage(props: PageProps<"/e/[slug]/encuentro/[token]">) {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Encounter {...props} />
    </Suspense>
  );
}

async function Encounter({ params }: PageProps<"/e/[slug]/encuentro/[token]">) {
  await connection();
  const { slug, token } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const check = readEncounterToken(event.id, decodeURIComponent(token));
  if (check.status !== "ok") {
    return (
      <Notice
        title={check.status === "expired" ? "Ese QR ya cambió" : "Ese QR no es válido"}
        text="Los QR de encuentro cambian cada 30 segundos. Abrí Tiki y escaneá desde el botón Llegué."
        href={`${eventPath(slug)}/llegue`}
        action="Abrir Llegué"
      />
    );
  }

  const me = await getDeviceParticipant(await currentDeviceHash());
  if (!me || !(await isEventMember(event.id, me.id))) {
    return (
      <Notice
        title="Abrilo desde tu Tiki"
        text="Este navegador no está anotado en el plan. Abrí el plan desde el teléfono con el que te sumaste y escaneá desde el botón Llegué. Si todavía no te sumaste, hacelo primero."
        href={eventPath(slug)}
        action="Ir al plan"
      />
    );
  }

  const name = (await getParticipantName(check.participantId)) ?? "alguien del plan";
  return <ConfirmEncounter slug={slug} token={decodeURIComponent(token)} name={firstName(name)} />;
}

function Notice({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <section className="card-glow">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-lg text-muted">{text}</p>
      <Link href={href} className="btn-primary mt-5 w-full">
        {action}
      </Link>
    </section>
  );
}
