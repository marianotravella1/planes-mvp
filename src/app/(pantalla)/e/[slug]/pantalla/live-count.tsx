"use client";

import { useEffect, useState } from "react";

type Stats = { count: number; capacity: number | null; recentNames: string[] };

/** Consulta el contador cada 3 segundos. Más liviano que mantener 500 conexiones en tiempo real. */
export function LiveCount({ slug, initial }: { slug: string; initial: Stats }) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch(`/api/e/${slug}/stats`, { cache: "no-store" });
        if (response.ok && !cancelled) setStats((await response.json()) as Stats);
      } catch {
        // Si se corta la red, sigue mostrando el último número.
      }
    };
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug]);

  const left = stats.capacity === null ? null : Math.max(0, stats.capacity - stats.count);

  return (
    <div>
      <p
        className="text-gradient font-display leading-none font-extrabold tabular-nums drop-shadow-[0_0_30px_rgb(220_38_38/0.5)]"
        style={{ fontSize: "clamp(5rem, 14vw, 12rem)" }}
      >
        {stats.count}
      </p>
      <p className="mt-2 text-3xl font-semibold">
        {stats.count === 1 ? "persona ya se sumó" : "personas ya se sumaron"}
      </p>
      {left !== null && (
        <p className="mt-1 text-2xl text-muted">
          {left === 0 ? "Se llenó" : left === 1 ? "Queda 1 lugar" : `Quedan ${left} lugares`}
        </p>
      )}
      {stats.recentNames.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Últimas personas que se sumaron">
          {stats.recentNames.map((name, index) => (
            <li
              key={`${name}-${index}`}
              className="rounded-full border border-primary/30 bg-primary/15 px-4 py-1.5 text-xl font-semibold"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
