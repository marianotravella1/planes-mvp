import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Normaliza un teléfono a E.164 (+5493415551234). Acepta formatos como "341 555-1234",
 * "0341 15 555 1234" o "+54 9 341 5551234". En Argentina se asume celular y se agrega
 * el 9, porque así se escribe el número para WhatsApp.
 */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), "AR");
  if (!parsed?.isValid()) return null;

  if (parsed.country === "AR" && !parsed.nationalNumber.startsWith("9")) {
    const mobile = parsePhoneNumberFromString(`+549${parsed.nationalNumber}`);
    if (mobile?.isValid()) return mobile.number;
  }
  return parsed.number;
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
