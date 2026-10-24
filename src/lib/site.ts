import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * URL base para links y QR. Si NEXT_PUBLIC_SITE_URL no está definida usa el host del pedido,
 * así un QR generado desde http://192.168.x.x:3000 funciona en celulares de la misma red.
 */
export async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}

export function eventPath(slug: string) {
  return `/e/${slug}`;
}

/** Solo rutas internas: evita que un link de ingreso redirija a otro sitio. */
export function safeNextPath(value: string | null | undefined, fallback = "/crear") {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** QR como SVG: módulos oscuros sobre blanco y margen de cuatro módulos para que se lea de lejos. */
export function qrSvg(text: string) {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#0A0A0A", light: "#FFFFFF" },
  });
}
