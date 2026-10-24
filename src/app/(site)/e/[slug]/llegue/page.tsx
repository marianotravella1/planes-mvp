import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentDeviceHash } from "@/lib/device";
import { firstName } from "@/lib/format";
import { icebreakerFor } from "@/lib/icebreakers";
import { getDeviceParticipant, getEvent, getMyEncounters, isEventMember } from "@/lib/queries";
import { eventPath } from "@/lib/site";
import { EncounterPanel } from "./encounter-panel";

export const metadata: Metadata = { title: "Llegué" };

export default function ArrivePage(props: PageProps<"/e/[slug]/llegue">) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Arrive {...props} />
    </Suspense>
  );
}

async function Arrive({ params }: PageProps<"/e/[slug]/llegue">) {
  await connection();
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const me = await getDeviceParticipant(await currentDeviceHash());
  const member = me ? await isEventMember(event.id, me.id) : false;
  const placeLabel = event.placeName ?? event.address;

  if (!me || !member) {
    return (
      <Notice
        slug={slug}
        title="Primero sumate al plan"
        text="Para confirmar que llegaste, abrí el plan desde el teléfono con el que te sumaste. Si todavía no te sumaste, hacelo ahora."
      />
    );
  }

  if (!event.encountersOpen) {
    return (
      <Notice
        slug={slug}
        title={event.isFinished ? "Este plan ya terminó" : "Todavía es temprano"}
        text={
          event.isFinished
            ? "Los encuentros se cerraron 6 horas después del inicio."
            : "Los encuentros se habilitan 2 horas antes del plan. Volvé cuando estés en el lugar."
        }
      />
    );
  }

  const mine = await getMyEncounters(event.id, me.id);
  return (
    <EncounterPanel
      slug={slug}
      placeLabel={placeLabel}
      pointsReward={event.pointsReward}
      myName={firstName(me.name)}
      initial={{
        checkedIn: mine.checkedIn,
        points: mine.points,
        encounters: mine.encounters.map((encounter) => ({
          id: encounter.id,
          name: firstName(encounter.name),
          scannedByMe: encounter.scannedByMe,
          question: icebreakerFor(encounter.id),
        })),
      }}
    />
  );
}

function Notice({ slug, title, text }: { slug: string; title: string; text: string }) {
  return (
    <section className="card-glow">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-lg text-muted">{text}</p>
      <Link href={eventPath(slug)} className="btn-primary mt-5 w-full">
        Ir al plan
      </Link>
    </section>
  );
}
