import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginCard } from "@/components/login-card";
import { getSessionUser } from "@/lib/auth";
import { currentDeviceHash } from "@/lib/device";
import { dayKey } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { getDeviceParticipant, getHostProfile } from "@/lib/queries";
import { createEvent } from "./actions";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Armar un plan" };

export default function CreatePage() {
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        Armá un <span className="text-gradient">plan</span>
      </h1>
      <p className="mt-2 mb-8 text-lg text-muted">
        Lo publicás, compartís el link o el QR y se suma gente con ganas de lo mismo.
      </p>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <CreateContent />
      </Suspense>
    </>
  );
}

async function CreateContent() {
  await connection();
  const user = await getSessionUser();

  if (!user) return <LoginCard next="/crear" />;

  const [host, me] = await Promise.all([
    getHostProfile(user.id),
    currentDeviceHash().then(getDeviceParticipant),
  ]);
  // Quien organiza por primera vez completa nombre y teléfono; si ya se anotó desde este celular, se precargan.
  const known = host ?? me;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          Entraste como <strong className="text-foreground">{user.username}</strong>
        </span>
        <form action="/auth/salir" method="post">
          <button type="submit" className="min-h-11 font-semibold text-primary-bright underline">
            Salir
          </button>
        </form>
      </div>
      <CreateEventForm
        action={createEvent}
        mode="create"
        today={dayKey(new Date())}
        hostLocked={Boolean(host)}
        knownName={known?.name ?? ""}
        knownPhone={known ? formatPhone(known.phoneE164) : ""}
      />
    </>
  );
}
