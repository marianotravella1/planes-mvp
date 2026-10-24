import { currentDeviceHash } from "@/lib/device";
import { createEncounterToken } from "@/lib/encounter-token";
import { getDeviceParticipant, getEvent, isEventMember } from "@/lib/queries";
import { eventPath, qrSvg, siteUrl } from "@/lib/site";

// El QR de encuentro de quien abre la pantalla "Llegué". Se pide de nuevo cada vez que vence.
export async function GET(_request: Request, { params }: RouteContext<"/api/e/[slug]/mi-qr">) {
  const { slug } = await params;
  const [event, me] = await Promise.all([getEvent(slug), currentDeviceHash().then(getDeviceParticipant)]);
  if (!event) return Response.json({ error: "not_found" }, { status: 404 });
  if (!me || !(await isEventMember(event.id, me.id))) return Response.json({ error: "not_member" }, { status: 403 });

  const { token, expiresAt } = createEncounterToken(event.id, me.id);
  const url = `${await siteUrl()}${eventPath(slug)}/encuentro/${token}`;
  return Response.json(
    { svg: await qrSvg(url), expiresAt, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
