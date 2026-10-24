import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRight, CalendarClock, Coins, MapPin } from "lucide-react";
import { capacityLabel } from "@/components/capacity";
import { formatWhen } from "@/lib/format";
import { getUpcomingEvents } from "@/lib/queries";
import { eventPath } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="pt-4">
        <h1 className="font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
          <span className="text-gradient">Armá un plan</span> y sumá gente con ganas de lo mismo
        </h1>
        <p className="mt-5 text-lg text-muted">
          Un partido al que le falta gente o una birra después del laburo. Lo publicás y se suma quien quiera. Para
          sumarse no hace falta cuenta.
        </p>
        <Link href="/crear" className="btn-primary mt-8 w-full text-lg sm:w-auto">
          Armar un plan
          <ArrowRight aria-hidden className="size-5" />
        </Link>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="size-2 rounded-full bg-success shadow-[0_0_8px_rgb(34_197_94/0.8)]" />
          Cada plan al que te sumás te da puntos para canjear
        </p>
      </section>

      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="font-display text-2xl font-extrabold">
          Planes que vienen
        </h2>
        <Suspense fallback={<div className="card mt-4 h-28 animate-pulse" />}>
          <UpcomingEvents />
        </Suspense>
      </section>

      <section className="card-glow flex items-start gap-4">
        <Coins aria-hidden className="mt-1 size-7 shrink-0 text-primary-bright" />
        <div>
          <h2 className="font-display text-xl font-extrabold">Cada plan suma puntos</h2>
          <p className="mt-1 text-muted">
            Cuando te sumás a un plan ganás puntos para canjear por descuentos en lugares aliados.
          </p>
        </div>
      </section>
    </div>
  );
}

async function UpcomingEvents() {
  await connection();
  const events = await getUpcomingEvents();

  if (events.length === 0) {
    return (
      <p className="card mt-4 text-muted">
        Todavía no hay planes publicados.{" "}
        <Link href="/crear" className="font-semibold text-primary-bright underline">
          Armá el primero
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {events.map((event) => {
        const full = event.capacity !== null && event.membersCount >= event.capacity;
        return (
          <li key={event.slug}>
            <Link
              href={eventPath(event.slug)}
              className="card block transition-colors hover:border-primary/40 hover:bg-card"
            >
              <p className="font-display text-xl font-bold">{event.title}</p>
              <p className="mt-2 flex items-center gap-2 text-muted">
                <CalendarClock aria-hidden className="size-4 shrink-0 text-primary-bright" />
                {formatWhen(event.startsAt)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-muted">
                <MapPin aria-hidden className="size-4 shrink-0 text-primary-bright" />
                <span className="truncate">{event.placeName ?? event.address}</span>
              </p>
              <p className={`mt-3 text-sm font-semibold ${full ? "text-danger" : "text-primary-bright"}`}>
                Van {event.membersCount}. {capacityLabel(event.membersCount, event.capacity)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
