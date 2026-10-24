"use server";

import { redirect } from "next/navigation";
import { ARGENTINA_UTC_OFFSET } from "@/lib/config";
import { db, dbErrorMessage, isUniqueViolation } from "@/lib/db";
import { ensureDeviceHash } from "@/lib/device";
import { newEventSlug } from "@/lib/ids";
import { normalizePhone } from "@/lib/phone";
import { getHostProfile } from "@/lib/queries";
import { getSessionUser } from "@/lib/supabase/server";

export type CreateEventField =
  | "title"
  | "address"
  | "date"
  | "time"
  | "capacityMode"
  | "capacity"
  | "description"
  | "hostName"
  | "hostPhone";

export type CreateEventState = {
  error?: string;
  fieldErrors?: Partial<Record<CreateEventField, string>>;
  values?: Partial<Record<CreateEventField, string>>;
};

const text = (value: FormDataEntryValue | null) => String(value ?? "").replace(/\s+/g, " ").trim();
const optionalNumber = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const values = {
    title: text(formData.get("title")),
    address: text(formData.get("address")),
    date: text(formData.get("date")),
    time: text(formData.get("time")),
    capacityMode: text(formData.get("capacityMode")) === "unlimited" ? "unlimited" : "limited",
    capacity: text(formData.get("capacity")),
    description: String(formData.get("description") ?? "").trim(),
    hostName: text(formData.get("hostName")),
    hostPhone: text(formData.get("hostPhone")),
  };

  const user = await getSessionUser();
  if (!user) return { error: "Tu sesión venció. Volvé a entrar con el link que te mandamos al mail.", values };
  const host = await getHostProfile(user.id);

  const placeName = text(formData.get("placeName")) || null;
  const lat = optionalNumber(formData.get("lat"));
  const lng = optionalNumber(formData.get("lng"));
  // La sugerencia elegida trae "Lugar, calle y ciudad": el nombre del lugar se guarda aparte.
  const address =
    placeName && values.address.startsWith(`${placeName}, `)
      ? values.address.slice(placeName.length + 2)
      : values.address;

  const fieldErrors: CreateEventState["fieldErrors"] = {};

  if (values.title.length < 3) fieldErrors.title = "Contá en pocas palabras qué plan es.";
  else if (values.title.length > 80) fieldErrors.title = "Usá 80 caracteres como máximo.";

  if (values.address.length < 3) fieldErrors.address = "Poné dónde se juntan.";

  const startsAt = new Date(`${values.date}T${values.time}:00${ARGENTINA_UTC_OFFSET}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) fieldErrors.date = "Elegí el día.";
  if (!/^\d{2}:\d{2}$/.test(values.time)) fieldErrors.time = "Elegí el horario.";
  if (!fieldErrors.date && !fieldErrors.time) {
    if (Number.isNaN(startsAt.getTime())) fieldErrors.date = "La fecha no es válida.";
    else if (startsAt.getTime() < Date.now() - 60 * 60 * 1000) fieldErrors.time = "Ese horario ya pasó.";
    else if (startsAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000)
      fieldErrors.date = "Elegí una fecha dentro de los próximos seis meses.";
  }

  let capacity: number | null = null;
  if (values.capacityMode === "limited") {
    capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500)
      fieldErrors.capacity = "Tiene que ser un número entre 2 y 500.";
  }

  if (values.description.length > 600) fieldErrors.description = "Usá 600 caracteres como máximo.";

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
          ${candidate}, ${values.title}, ${values.description || null}, ${address}, ${placeName},
          ${lat}, ${lng}, ${startsAt}, ${capacity}, ${user.id},
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
