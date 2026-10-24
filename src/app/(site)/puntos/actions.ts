"use server";

import { redirect } from "next/navigation";
import { REDEMPTION_VALID_MINUTES } from "@/lib/config";
import { db, dbErrorMessage, isUniqueViolation } from "@/lib/db";
import { currentDeviceHash } from "@/lib/device";
import { newRedemptionCode } from "@/lib/ids";

export type RedeemState = { error?: string };

const ERRORS: Record<string, string> = {
  insufficient_points: "Todavía no te alcanzan los puntos para este beneficio.",
  reward_not_found: "Este beneficio ya no está disponible.",
  device_not_linked: "Para canjear, abrí la app desde el teléfono donde te anotaste la primera vez.",
};

export async function redeemReward(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const rewardId = String(formData.get("rewardId") ?? "");
  if (!/^\d+$/.test(rewardId)) return { error: ERRORS.reward_not_found };

  const tokenHash = await currentDeviceHash();
  if (!tokenHash) return { error: ERRORS.device_not_linked };

  let code: string | null = null;
  for (let attempt = 0; attempt < 4 && !code; attempt++) {
    const candidate = newRedemptionCode();
    try {
      await db()`
        select * from app.redeem_reward(${tokenHash}, ${rewardId}, ${candidate}, ${REDEMPTION_VALID_MINUTES})
      `;
      code = candidate;
    } catch (error) {
      if (isUniqueViolation(error, "redemptions_code_key")) continue;
      const message = dbErrorMessage(error);
      if (message && ERRORS[message]) return { error: ERRORS[message] };
      console.error("redeemReward", error);
      return { error: "No pudimos hacer el canje. Probá de nuevo en un momento." };
    }
  }

  if (!code) return { error: "No pudimos hacer el canje. Probá de nuevo en un momento." };
  redirect(`/puntos/canje/${code}`);
}
