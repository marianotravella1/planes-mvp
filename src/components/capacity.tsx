type Props = { count: number; capacity: number | null };

/** Cuántos van y cuántos lugares quedan. Sin cupo, solo el conteo. */
export function Capacity({ count, capacity }: Props) {
  if (capacity === null) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-extrabold">Van {count}</p>
        <p className="font-semibold text-muted">Sin límite de gente</p>
      </div>
    );
  }

  const left = Math.max(0, capacity - count);
  const percent = Math.min(100, Math.round((count / capacity) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-extrabold">
          Van {count} de {capacity}
        </p>
        <p className={`font-semibold ${left === 0 ? "text-danger" : "text-primary-bright"}`}>
          {capacityLabel(count, capacity)}
        </p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Lugares ocupados"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={count}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-primary to-primary-bright shadow-[0_0_12px_rgb(248_113_113/0.6)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function capacityLabel(count: number, capacity: number | null) {
  if (capacity === null) return "Sin límite de gente";
  const left = Math.max(0, capacity - count);
  return left === 0 ? "Se llenó" : left === 1 ? "Queda 1 lugar" : `Quedan ${left} lugares`;
}
