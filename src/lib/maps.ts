type Place = { address: string; placeName?: string | null; lat: number | null; lng: number | null };

function query({ address, placeName, lat, lng }: Place) {
  if (lat !== null && lng !== null) return `${lat},${lng}`;
  return placeName ? `${placeName}, ${address}` : address;
}

/** Abre Google Maps (la app en Android) con el recorrido hasta el lugar. No requiere API key. */
export function googleMapsDirectionsUrl(place: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query(place))}`;
}

/**
 * Mapa embebido de Google sin API key. Con una key de Google Cloud conviene pasar a la
 * Maps Embed API oficial (https://www.google.com/maps/embed/v1/place?key=...&q=...).
 */
export function googleMapsEmbedUrl(place: Place) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query(place))}&z=16&hl=es&output=embed`;
}
