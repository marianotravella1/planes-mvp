// Se usa en el navegador: lee el token de un link de encuentro (lo que trae el QR).
export function tokenFromEncounterUrl(slug: string, text: string) {
  const match = text.trim().match(/\/e\/([a-z0-9]{4,16})\/encuentro\/([^/?#\s]+)/);
  if (!match) return { status: "not_encounter" as const };
  if (match[1] !== slug) return { status: "other_event" as const };
  return { status: "ok" as const, token: decodeURIComponent(match[2]) };
}
