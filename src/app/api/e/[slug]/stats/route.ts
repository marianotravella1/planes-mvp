import { firstName } from "@/lib/format";
import { getEventStats } from "@/lib/queries";

// Contador para la pantalla del proyector. Se consulta cada pocos segundos.
export async function GET(_request: Request, { params }: RouteContext<"/api/e/[slug]/stats">) {
  const { slug } = await params;
  const stats = await getEventStats(slug);
  if (!stats) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { count: stats.count, capacity: stats.capacity, recentNames: stats.recentNames.map(firstName) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
