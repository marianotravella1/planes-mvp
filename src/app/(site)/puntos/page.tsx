import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Coins, Store, Ticket } from "lucide-react";
import { currentDeviceHash } from "@/lib/device";
import { firstName, formatTime, formatWhen } from "@/lib/format";
import { getActiveRedemptions, getDeviceParticipant, getLedger, getRewards, type LedgerEntry } from "@/lib/queries";
import { RedeemButton } from "./redeem-button";

export const metadata: Metadata = { title: "Mis puntos" };

export default function PointsPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Wallet />
    </Suspense>
  );
}

async function Wallet() {
  await connection();
  const me = await getDeviceParticipant(await currentDeviceHash());
  const rewards = await getRewards();

  if (!me) {
    return (
      <div className="space-y-8">
        <section className="card-glow text-center">
          <Coins aria-hidden className="mx-auto size-12 text-primary-bright" />
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Todavía no sumaste puntos</h1>
          <p className="mt-2 text-lg text-muted">
            Cada plan al que te sumás te da puntos para canjear por descuentos. Se guardan en el teléfono desde el que te
            anotaste.
          </p>
          <Link href="/" className="btn-primary mt-5 w-full">
            Ver planes
          </Link>
        </section>
        <RewardsList rewards={rewards} balance={0} canRedeem={false} />
      </div>
    );
  }

  const [ledger, active] = await Promise.all([getLedger(me.id), getActiveRedemptions(me.id)]);

  return (
    <div className="space-y-8">
      <section className="card-glow">
        <p className="text-lg text-muted">Hola, {firstName(me.name)}. Tenés</p>
        <p className="font-display text-7xl font-extrabold tabular-nums">
          <span className="text-gradient">{me.balance}</span>
        </p>
        <p className="text-lg text-muted">puntos para canjear</p>
      </section>

      {active.length > 0 && (
        <section aria-labelledby="active-title">
          <h2 id="active-title" className="font-display text-2xl font-extrabold">
            Códigos para usar
          </h2>
          <ul className="mt-4 space-y-3">
            {active.map((redemption) => (
              <li key={redemption.code}>
                <Link href={`/puntos/canje/${redemption.code}`} className="card-glow flex items-center gap-4">
                  <Ticket aria-hidden className="size-7 shrink-0 text-primary-bright" />
                  <span>
                    <span className="block font-semibold">{redemption.rewardTitle}</span>
                    <span className="block text-sm text-muted">
                      {redemption.businessName}, vence a las {formatTime(redemption.expiresAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RewardsList rewards={rewards} balance={me.balance} canRedeem />

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="font-display text-2xl font-extrabold">
          Movimientos
        </h2>
        {ledger.length === 0 ? (
          <p className="card mt-4 text-muted">Todavía no tenés movimientos.</p>
        ) : (
          <ul className="card mt-4 divide-y divide-white/10 py-1">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-medium">{ledgerLabel(entry)}</span>
                  <span className="block text-sm text-muted">{formatWhen(entry.createdAt)}</span>
                </span>
                <span className={`font-display text-xl font-bold tabular-nums ${entry.delta > 0 ? "text-primary-bright" : "text-foreground"}`}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type RewardsListProps = {
  rewards: Awaited<ReturnType<typeof getRewards>>;
  balance: number;
  canRedeem: boolean;
};

function RewardsList({ rewards, balance, canRedeem }: RewardsListProps) {
  return (
    <section aria-labelledby="rewards-title">
      <h2 id="rewards-title" className="font-display text-2xl font-extrabold">
        Beneficios en lugares aliados
      </h2>
      <ul className="mt-4 space-y-3">
        {rewards.map((reward) => (
          <li key={reward.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl font-bold">{reward.title}</p>
                <p className="mt-1 flex items-center gap-2 text-muted">
                  <Store aria-hidden className="size-4 shrink-0" />
                  {reward.businessName}
                </p>
                {reward.description && <p className="mt-1 text-sm text-muted">{reward.description}</p>}
              </div>
              <p className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-bold text-primary-bright tabular-nums">
                {reward.costPoints} pts
              </p>
            </div>
            {canRedeem && <RedeemButton rewardId={reward.id} costPoints={reward.costPoints} balance={balance} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ledgerLabel(entry: LedgerEntry) {
  const plan = entry.eventTitle ?? "un plan";
  switch (entry.reason) {
    case "attended_event":
      return `Llegaste a ${plan}`;
    case "met_person":
      return `Conociste a alguien en ${plan}`;
    case "removed_from_event":
      return `Te quitaron de ${plan}`;
    case "join_event":
      return `Te sumaste a ${plan}`;
    default:
      return `Canje: ${entry.rewardTitle ?? "beneficio"}`;
  }
}
