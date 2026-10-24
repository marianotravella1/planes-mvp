import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarClock, MapPin, Monitor, Navigation, PartyPopper } from "lucide-react";
import { Capacity } from "@/components/capacity";
import { ShareActions } from "@/components/share-actions";
import { currentDeviceHash } from "@/lib/device";
import { firstName, formatWhen, initials } from "@/lib/format";
import { googleMapsDirectionsUrl, googleMapsEmbedUrl } from "@/lib/maps";
import { formatPhone } from "@/lib/phone";
import { getSessionUser } from "@/lib/auth";
import { getDeviceParticipant, getEvent, getEventMembers, getHostProfile } from "@/lib/queries";
import { eventPath, qrSvg, siteUrl } from "@/lib/site";
import { joinEvent } from "./actions";
import { HostActions, RemoveMemberButton } from "./host-controls";
import { JoinSection } from "./join-section";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Plan no encontrado" };
  const count =
    event.capacity === null ? `Van ${event.membersCount}` : `Van ${event.membersCount} de ${event.capacity}`;
  const description = `${formatWhen(event.startsAt)} en ${event.placeName ?? event.address}. ${count}.`;
  return { title: event.title, description, openGraph: { title: event.title, description } };
}

export default function EventPage(props: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventContent {...props} />
    </Suspense>
  );
}

async function EventContent({ params, searchParams }: PageProps<"/e/[slug]">) {
  await connection();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const event = await getEvent(slug);
  if (!event) notFound();

  const [me, members, baseUrl, account] = await Promise.all([
    currentDeviceHash().then(getDeviceParticipant),
    getEventMembers(event.id),
    siteUrl(),
    getSessionUser().then((user) => (user ? getHostProfile(user.id) : null)),
  ]);

  const url = `${baseUrl}${eventPath(slug)}`;
  const qr = await qrSvg(url);
  const isMember = Boolean(me && members.some((member) => member.participantId === me.id));
  // Para gestionar el plan hace falta la sesión de la cuenta que lo organiza.
  const canManage = account?.id === event.hostId;
  const isHost = canManage || me?.id === event.hostId;
  const isFull = event.capacity !== null && event.membersCount >= event.capacity;
  const when = formatWhen(event.startsAt);
  const where = event.placeName ?? event.address;
  const shareText = `${event.title}: ${when.toLowerCase()} en ${where}. Sumate acá:`;
  const justCreated = query.nuevo === "1";

  const share = (
    <section aria-labelledby="share-title" className="card space-y-4">
      <div>
        <h2 id="share-title" className="font-display text-2xl font-extrabold">
          Invitá gente
        </h2>
        <p className="mt-1 text-muted">Que escaneen el QR o mandales el link.</p>
      </div>
      <div
        className="mx-auto w-full max-w-64 overflow-hidden rounded-xl bg-white p-1 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        aria-label={`Código QR para sumarse a ${event.title}`}
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p className="text-center font-semibold break-all text-muted">{url.replace(/^https?:\/\//, "")}</p>
      <ShareActions url={url} title={event.title} text={shareText} />
      <Link href={`${eventPath(slug)}/pantalla`} className="btn-secondary w-full">
        <Monitor aria-hidden className="size-5" />
        Mostrar en pantalla grande
      </Link>
    </section>
  );

  return (
    <div className="space-y-5">
      {justCreated && (
        <p
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/15 px-5 py-4 font-semibold"
        >
          <PartyPopper aria-hidden className="mt-0.5 size-6 shrink-0 text-primary-bright" />
          Tu plan está publicado. Compartilo por WhatsApp o mostrá el QR para que se sume gente.
        </p>
      )}

      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance">{event.title}</h1>
        <p className="mt-2 text-lg text-muted">Organiza {firstName(event.hostName)}</p>
      </header>

      {canManage && <HostActions slug={slug} />}

      {justCreated && share}

      <section className="card space-y-4">
        <p className="flex items-start gap-3 text-lg">
          <CalendarClock aria-hidden className="mt-1 size-5 shrink-0 text-primary-bright" />
          <span className="font-semibold">{when}</span>
        </p>
        <div className="flex items-start gap-3 text-lg">
          <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-primary-bright" />
          <div>
            {event.placeName && <p className="font-semibold">{event.placeName}</p>}
            <p className={event.placeName ? "text-base text-muted" : "font-semibold"}>{event.address}</p>
          </div>
        </div>
        <iframe
          title={`Mapa de ${where}`}
          src={googleMapsEmbedUrl(event)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-52 w-full rounded-xl border border-white/10"
        />
        <a
          href={googleMapsDirectionsUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full"
        >
          <Navigation aria-hidden className="size-5 text-primary-bright" />
          Cómo llegar con Google Maps
        </a>
        {event.description && (
          <p className="border-t border-white/10 pt-4 whitespace-pre-line text-muted">{event.description}</p>
        )}
      </section>

      <section className="card">
        <Capacity count={event.membersCount} capacity={event.capacity} />
      </section>

      <JoinSection
        joinAction={joinEvent.bind(null, slug)}
        pointsReward={event.pointsReward}
        isMember={isMember}
        isHost={isHost}
        isFull={isFull}
        isFinished={event.isFinished}
        knownName={me?.name ?? null}
        knownPhone={me ? formatPhone(me.phoneE164) : null}
        balance={isMember && me ? me.balance : null}
        share={{ url, text: shareText }}
      />

      <section aria-labelledby="members-title" className="card">
        <h2 id="members-title" className="font-display text-2xl font-extrabold">
          Quiénes van
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {members.map((member) => (
            <li
              key={member.participantId}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pr-4 pl-1"
            >
              <span
                aria-hidden
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                  member.role === "host" ? "bg-primary text-white" : "bg-white/10 text-foreground"
                }`}
              >
                {initials(member.name)}
              </span>
              <span className="font-medium">
                {firstName(member.name)}
                {(member.role === "host" || me?.id === member.participantId) && (
                  <span className="text-muted">
                    {" "}
                    (
                    {[member.role === "host" && "organiza", me?.id === member.participantId && "vos"]
                      .filter(Boolean)
                      .join(", ")}
                    )
                  </span>
                )}
              </span>
              {canManage && member.role !== "host" && (
                <RemoveMemberButton slug={slug} participantId={member.participantId} name={firstName(member.name)} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {!justCreated && share}
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando el plan">
      <div className="h-10 w-3/4 animate-pulse rounded-xl bg-white/10" />
      <div className="card h-48 animate-pulse" />
      <div className="card h-40 animate-pulse" />
    </div>
  );
}
