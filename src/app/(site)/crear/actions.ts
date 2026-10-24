"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, dbErrorMessage, isUniqueViolation } from "@/lib/db";
import { ensureDeviceHash } from "@/lib/device";
import { readEventForm, type EventFormState } from "@/lib/event-form";
import { newEventSlug } from "@/lib/ids";
import { normalizePhone } from "@/lib/phone";
import { getHostProfile } from "@/lib/queries";

export async function createEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const { values, fieldErrors, data } = readEventForm(formData);

  const user = await getSessionUser();
  if (!user) return { error: "Tu sesión venció. Volvé a entrar con tu usuario y contraseña.", values };
  const host = await getHostProfile(user.id);

  // La primera vez que alguien organiza se le piden nombre y teléfono; después quedan en su cuenta.
  let hostPhone: string | null = null;
  if (!host) {
    if (values.hostName.length < 2 || values.hostName.length > 40)
      fieldErrors.hostName = "Poné tu nombre (entre 2 y 40 letras).";
    hostPhone = normalizePhone(values.hostPhone);
    if (!hostPhone) fieldErrors.hostPhone = "Revisá el número. Por ejemplo: 341 555 1234.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const tokenHash = await ensureDeviceHash();
  let slug: string | null = null;

  // El slug es aleatorio; si choca con uno existente se prueba otro.
  for (let attempt = 0; attempt < 4 && !slug; attempt++) {
    const candidate = newEventSlug();
    try {
      await db()`
        select * from app.create_event(
          ${candidate}, ${data.title}, ${data.description}, ${data.address}, ${data.placeName},
          ${data.lat}, ${data.lng}, ${data.startsAt}, ${data.capacity}, ${user.id},
          ${host ? null : values.hostName}, ${hostPhone}, ${tokenHash}
        )
      `;
      slug = candidate;
    } catch (error) {
      if (isUniqueViolation(error, "events_slug_key")) continue;
      const message = dbErrorMessage(error);
      if (message === "event_in_past") return { fieldErrors: { time: "Ese horario ya pasó." }, values };
      if (message === "event_too_far")
        return { fieldErrors: { date: "Elegí una fecha dentro de los próximos seis meses." }, values };
      if (message === "phone_in_use")
        return {
          fieldErrors: {
            hostPhone:
              "Ese número ya se anotó desde otro celular. Entrá con tu cuenta desde ese teléfono para organizar.",
          },
          values,
        };
      console.error("createEvent", error);
      return { error: "No pudimos publicar el plan. Probá de nuevo en un momento.", values };
    }
  }

  if (!slug) return { error: "No pudimos publicar el plan. Probá de nuevo en un momento.", values };
  redirect(`/e/${slug}?nuevo=1`);
}
