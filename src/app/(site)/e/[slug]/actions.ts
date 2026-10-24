"use server";

import { revalidatePath } from "next/cache";
import { db, dbErrorMessage } from "@/lib/db";
import { ensureDeviceHash } from "@/lib/device";
import { normalizePhone } from "@/lib/phone";

export type JoinState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: { name?: string; phone?: string };
      values: { name: string; phone: string };
    }
  | {
      status: "joined";
      // Cambia en cada respuesta para que el cartel de puntos se muestre de nuevo.
      at: number;
      name: string;
      alreadyMember: boolean;
      pointsAwarded: number;
      balance: number | null;
      deviceLinked: boolean;
    };

type JoinResult = {
  participantId: string;
  deviceLinked: boolean;
  alreadyMember: boolean;
  pointsAwarded: number;
  balance: number | null;
  membersCount: number;
  capacity: number;
};

const ERRORS: Record<string, string> = {
  event_full: "Se llenó justo. Fijate si hay otro plan que te guste.",
  event_finished: "Este plan ya pasó.",
  event_not_found: "No encontramos este plan.",
};

export async function joinEvent(slug: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  const values = {
    name: String(formData.get("name") ?? "").replace(/\s+/g, " ").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  };

  const fieldErrors: { name?: string; phone?: string } = {};
  if (values.name.length < 2 || values.name.length > 40) fieldErrors.name = "Poné tu nombre (entre 2 y 40 letras).";
  const phone = normalizePhone(values.phone);
  if (!phone) fieldErrors.phone = "Revisá el número. Por ejemplo: 341 555 1234.";
  if (fieldErrors.name || !phone) return { status: "error", fieldErrors, values };

  const tokenHash = await ensureDeviceHash();

  try {
    const [result] = await db()<JoinResult[]>`
      select * from app.join_event(${slug}, ${values.name}, ${phone}, ${tokenHash})
    `;
    revalidatePath(`/e/${slug}`);
    return {
      status: "joined",
      at: Date.now(),
      name: values.name,
      alreadyMember: result.alreadyMember,
      pointsAwarded: result.pointsAwarded,
      balance: result.balance,
      deviceLinked: result.deviceLinked,
    };
  } catch (error) {
    const message = dbErrorMessage(error);
    if (message && ERRORS[message]) {
      revalidatePath(`/e/${slug}`);
      return { status: "error", message: ERRORS[message], values };
    }
    console.error("joinEvent", error);
    return { status: "error", message: "No pudimos anotarte. Probá de nuevo en un momento.", values };
  }
}
