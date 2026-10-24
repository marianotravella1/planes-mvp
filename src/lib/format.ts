import { ARGENTINA_UTC_OFFSET, TIME_ZONE } from "./config";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const longDayFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Fecha en formato AAAA-MM-DD según la hora de Argentina. */
export function dayKey(date: Date) {
  return dayKeyFormat.format(date);
}

export function formatTime(date: Date) {
  return timeFormat.format(date);
}

/** "Hoy", "Mañana" o "Jueves 30 de octubre". */
export function formatDay(date: Date, now = new Date()) {
  const key = dayKey(date);
  if (key === dayKey(now)) return "Hoy";
  if (key === dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return "Mañana";
  return capitalize(longDayFormat.format(date));
}

/** "Hoy, 18:45" */
export function formatWhen(date: Date, now = new Date()) {
  return `${formatDay(date, now)}, ${formatTime(date)}`;
}

/** "Sábado 25 de octubre, 18:45". Sin "Hoy" ni "Mañana", para textos que se pueden leer otro día. */
export function formatDateTime(date: Date) {
  return `${capitalize(longDayFormat.format(date))}, ${formatTime(date)}`;
}

/** "2026-10-25T18:45:00-03:00": ISO 8601 con la hora de Argentina. */
export function formatIsoLocal(date: Date) {
  return `${dayKey(date)}T${formatTime(date)}:00${ARGENTINA_UTC_OFFSET}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
