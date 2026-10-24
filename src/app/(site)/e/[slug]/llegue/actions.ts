"use server";

import { revalidatePath } from "next/cache";
import { db, dbErrorMessage } from "@/lib/db";
import { currentDeviceHash } from "@/lib/device";
import { readEncounterToken } from "@/lib/encounter-token";
import { firstName } from "@/lib/format";
import { icebreakerFor } from "@/lib/icebreakers";
import { getEvent } from "@/lib/queries";

export type MeetResult =
  | { status: "met"; encounterId: string; name: string; points: number; alreadyMet: boolean; question: string }
  | { status: "error"; message: string };

const ERRORS: Record<string, string> = {
  too_early: "Todavía es temprano: los encuentros se habilitan 2 horas antes del plan.",
  event_finished: "Este plan ya terminó.",
  event_not_found: "No encontramos este plan.",
  device_not_linked: "Abrí Tiki desde el teléfono con el que te sumaste a este plan.",
  scanner_not_member: "Primero sumate al plan, después escaneá.",
  scanned_not_member: "Esa persona no está anotada en este plan. Que se sume y vuelvan a probar.",
  same_person: "Ese es tu propio QR. Escaneá el de otra persona del plan.",
};

type EncounterRow = {
  encounterId: string;
  otherName: string;
  alreadyMet: boolean;
  scannerPoints: number;
  scannedPoints: number;
};

/** Quien escanea confirma el encuentro con la dueña o el dueño del QR. */
export async function meet(slug: string, token: string): Promise<MeetResult> {
  const event = await getEvent(slug);
  if (!event) return { status: "error", message: ERRORS.event_not_found };

  const check = readEncounterToken(event.id, token);
  if (check.status !== "ok") {
    return {
      status: "error",
      message:
        check.status === "expired"
          ? "Ese QR ya cambió. Pedile que te lo muestre de nuevo."
          : "Ese QR no es de un encuentro de este plan.",
    };
  }

  const tokenHash = await currentDeviceHash();
  if (!tokenHash) return { status: "error", message: ERRORS.device_not_linked };

  try {
    const [row] = await db()<EncounterRow[]>`
      select * from app.record_encounter(${slug}, ${tokenHash}, ${check.participantId})
    `;
    revalidatePath(`/e/${slug}`);
    return {
      status: "met",
      encounterId: row.encounterId,
      name: firstName(row.otherName),
      points: row.scannerPoints,
      alreadyMet: row.alreadyMet,
      question: icebreakerFor(row.encounterId),
    };
  } catch (error) {
    const message = dbErrorMessage(error);
    if (message && ERRORS[message]) return { status: "error", message: ERRORS[message] };
    console.error("meet", error);
    return { status: "error", message: "No pudimos registrar el encuentro. Probá de nuevo." };
  }
}
