import { ARGENTINA_UTC_OFFSET } from "./config";

// Lectura y validación del formulario de un plan, compartida entre crear y editar.

export type EventField =
  | "title"
  | "address"
  | "placeName"
  | "date"
  | "time"
  | "capacityMode"
  | "capacity"
  | "description"
  | "hostName"
  | "hostPhone";

export type EventFormState = {
  error?: string;
  fieldErrors?: Partial<Record<EventField, string>>;
  values?: Partial<Record<EventField, string>>;
};

export type EventData = {
  title: string;
  description: string | null;
  address: string;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: Date;
  capacity: number | null;
};

export const text = (value: FormDataEntryValue | null) => String(value ?? "").replace(/\s+/g, " ").trim();

const optionalNumber = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export function readEventForm(formData: FormData) {
  const values = {
    title: text(formData.get("title")),
    address: text(formData.get("address")),
    placeName: text(formData.get("placeName")),
    date: text(formData.get("date")),
    time: text(formData.get("time")),
    capacityMode: text(formData.get("capacityMode")) === "unlimited" ? "unlimited" : "limited",
    capacity: text(formData.get("capacity")),
    description: String(formData.get("description") ?? "").trim(),
    hostName: text(formData.get("hostName")),
    hostPhone: text(formData.get("hostPhone")),
  };

  const placeName = values.placeName.slice(0, 120) || null;
  const lat = optionalNumber(formData.get("lat"));
  const lng = optionalNumber(formData.get("lng"));
  // La sugerencia elegida trae "Lugar, calle y ciudad": el nombre del lugar se guarda aparte.
  const address =
    placeName && values.address.startsWith(`${placeName}, `)
      ? values.address.slice(placeName.length + 2)
      : values.address;

  const fieldErrors: NonNullable<EventFormState["fieldErrors"]> = {};

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

  const data: EventData = {
    title: values.title,
    description: values.description || null,
    address,
    placeName,
    lat,
    lng,
    startsAt,
    capacity,
  };
  return { values, fieldErrors, data };
}
