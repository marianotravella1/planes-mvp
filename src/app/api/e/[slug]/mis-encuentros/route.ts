import { currentDeviceHash } from "@/lib/device";
import { firstName } from "@/lib/format";
import { icebreakerFor } from "@/lib/icebreakers";
import { getDeviceParticipant, getEvent, getMyEncounters } from "@/lib/queries";

// Lo consulta la pantalla "Llegué" cada pocos segundos, para avisar cuando alguien te escanea.
export async function GET(_request: Request, { params }: RouteContext<"/api/e/[slug]/mis-encuentros">) {
  const { slug } = await params;
  const [event, me] = await Promise.all([getEvent(slug), currentDeviceHash().then(getDeviceParticipant)]);
  if (!event || !me) return Response.json({ error: "not_found" }, { status: 404 });

  const mine = await getMyEncounters(event.id, me.id);
  return Response.json(
    {
      checkedIn: mine.checkedIn,
      points: mine.points,
      encounters: mine.encounters.map((encounter) => ({
        id: encounter.id,
        name: firstName(encounter.name),
        scannedByMe: encounter.scannedByMe,
        question: icebreakerFor(encounter.id),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
