"use client";

import { useEffect, useState } from "react";
import { TIME_ZONE } from "@/lib/config";

const clockFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Reloj con segundos y cuenta regresiva. Le muestra a quien atiende que la pantalla está viva:
 * en una captura vieja la hora queda congelada.
 */
export function LiveClock({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (now === null) return <p className="h-16" aria-hidden />;

  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div aria-live="off">
      <p className="font-display text-4xl font-extrabold tabular-nums">{clockFormat.format(now)}</p>
      <p className={`mt-1 text-lg font-semibold ${remaining === 0 ? "text-danger" : "text-muted"}`}>
        {remaining === 0 ? "Este código venció" : `Vence en ${minutes}:${String(seconds).padStart(2, "0")}`}
      </p>
    </div>
  );
}
