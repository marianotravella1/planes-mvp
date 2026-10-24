import { createHmac, timingSafeEqual } from "node:crypto";

// El QR de cada persona cambia cada 30 segundos y vale para un solo plan. Va firmado, así nadie
// puede armar el de otra persona, y una captura mandada por WhatsApp vence enseguida.
const SLOT_SECONDS = 30;

function secret() {
  const value = process.env.ENCOUNTER_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("Falta ENCOUNTER_SECRET.");
  return "solo-para-desarrollo";
}

const currentSlot = (now = Date.now()) => Math.floor(now / 1000 / SLOT_SECONDS);

const sign = (eventId: string, participantId: string, slot: number) =>
  createHmac("sha256", secret()).update(`${eventId}:${participantId}:${slot}`).digest("base64url").slice(0, 16);

export function createEncounterToken(eventId: string, participantId: string) {
  const slot = currentSlot();
  return {
    token: `${participantId}.${slot}.${sign(eventId, participantId, slot)}`,
    expiresAt: (slot + 1) * SLOT_SECONDS * 1000,
  };
}

export type TokenCheck = { status: "ok"; participantId: string } | { status: "expired" | "invalid" };

/** Acepta el QR del intervalo actual y del anterior: vale entre 30 y 60 segundos. */
export function readEncounterToken(eventId: string, token: string): TokenCheck {
  const match = token.match(/^(\d{1,18})\.(\d{1,12})\.([A-Za-z0-9_-]{16})$/);
  if (!match) return { status: "invalid" };
  const [, participantId, slotText, signature] = match;
  const slot = Number(slotText);

  const expected = Buffer.from(sign(eventId, participantId, slot));
  if (!timingSafeEqual(Buffer.from(signature), expected)) return { status: "invalid" };

  const now = currentSlot();
  if (slot !== now && slot !== now - 1) return { status: "expired" };
  return { status: "ok", participantId };
}
