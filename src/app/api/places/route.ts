import type { NextRequest } from "next/server";
import { MAP_CENTER } from "@/lib/config";

// Sugerencias de direcciones con Photon (datos de OpenStreetMap), sin API key.
// Pasa por el servidor para poder cambiar de proveedor (por ejemplo Google Places) sin tocar el cliente.

export type PlaceSuggestion = {
  id: string;
  label: string;
  detail: string;
  placeName: string | null;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
};

function toSuggestion({ geometry, properties: p }: PhotonFeature): PlaceSuggestion {
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const isPlace = Boolean(p.name) && p.osm_key !== "place" && p.osm_key !== "highway";
  const label = (isPlace ? p.name : street || p.name) ?? "";
  const detailParts = isPlace ? [street, p.city] : [p.district !== p.city ? p.district : null, p.city];
  return {
    id: `${p.osm_type}${p.osm_id}`,
    label,
    detail: [...detailParts, p.state].filter(Boolean).join(", "),
    placeName: isPlace ? (p.name ?? null) : null,
    lat: geometry.coordinates[1],
    lng: geometry.coordinates[0],
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 120) {
    return Response.json({ results: [] });
  }

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lat", String(MAP_CENTER.lat));
  url.searchParams.set("lon", String(MAP_CENTER.lng));

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "planes-mvp/0.1 (hackaton Shippear Rosario)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return Response.json({ results: [] }, { status: 502 });

    const data = (await response.json()) as { features: PhotonFeature[] };
    const results = data.features
      .filter((feature) => feature.properties.countrycode === "AR")
      .map(toSuggestion)
      .filter((suggestion) => suggestion.label)
      .slice(0, 6);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] }, { status: 504 });
  }
}
