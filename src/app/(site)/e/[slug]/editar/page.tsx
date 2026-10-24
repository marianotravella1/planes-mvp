import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { LoginCard } from "@/components/login-card";
import { getSessionUser } from "@/lib/auth";
import { dayKey, formatTime } from "@/lib/format";
import { getEvent, getHostProfile } from "@/lib/queries";
import { eventPath } from "@/lib/site";
import { CreateEventForm } from "../../../crear/create-event-form";
import { updateEvent } from "../manage-actions";

export const metadata: Metadata = { title: "Editar el plan" };

export default function EditPage(props: PageProps<"/e/[slug]/editar">) {
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        Editá el <span className="text-gradient">plan</span>
      </h1>
      <p className="mt-2 mb-8 text-lg text-muted">Los cambios se ven al instante para quienes ya se sumaron.</p>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <EditContent {...props} />
      </Suspense>
    </>
  );
}

async function EditContent({ params }: PageProps<"/e/[slug]/editar">) {
  await connection();
  const { slug } = await params;
  const [event, user] = await Promise.all([getEvent(slug), getSessionUser()]);
  if (!event) notFound();
  if (!user) return <LoginCard next={`${eventPath(slug)}/editar`} />;

  const host = await getHostProfile(user.id);
  if (host?.id !== event.hostId) {
    return (
      <section className="card">
        <p>Solo quien organiza este plan lo puede editar.</p>
        <Link href={eventPath(slug)} className="btn-secondary mt-4 w-full">
          Volver al plan
        </Link>
      </section>
    );
  }

  return (
    <>
      <Link href={eventPath(slug)} className="mb-6 inline-flex min-h-11 items-center gap-2 font-semibold text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Volver al plan
      </Link>
      <CreateEventForm
        action={updateEvent.bind(null, slug)}
        mode="edit"
        today={dayKey(new Date())}
        initial={{
          title: event.title,
          placeName: event.placeName ?? "",
          address: event.address,
          date: dayKey(event.startsAt),
          time: formatTime(event.startsAt),
          capacityMode: event.capacity === null ? "unlimited" : "limited",
          capacity: event.capacity === null ? "" : String(event.capacity),
          description: event.description ?? "",
        }}
        initialPlace={event.lat !== null && event.lng !== null ? { lat: event.lat, lng: event.lng } : null}
        hostLocked
        knownName={host.name}
        knownPhone=""
      />
    </>
  );
}
