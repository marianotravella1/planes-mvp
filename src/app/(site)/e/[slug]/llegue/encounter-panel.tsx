"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, MessageCircleQuestion, ScanLine, TriangleAlert } from "lucide-react";
import { QrScanner } from "@/components/qr-scanner";
import { tokenFromEncounterUrl } from "@/lib/encounter-url";
import { meet } from "./actions";

type Encounter = { id: string; name: string; scannedByMe: boolean; question: string };
export type Mine = { checkedIn: boolean; points: number; encounters: Encounter[] };

type Overlay =
  | { kind: "met"; name: string; points: number; alreadyMet: boolean; question: string }
  | { kind: "scanned_me"; name: string; points: number; question: string }
  | { kind: "error"; message: string };

type Props = {
  slug: string;
  placeLabel: string;
  pointsReward: number;
  myName: string;
  initial: Mine;
};

/**
 * Pantalla "Llegué": muestra tu QR (cambia cada 30 segundos) y abre la cámara para escanear el de
 * otra persona. Cualquiera de los dos que escanee confirma la llegada de ambos.
 */
export function EncounterPanel({ slug, placeLabel, pointsReward, myName, initial }: Props) {
  const [mine, setMine] = useState(initial);
  const [qr, setQr] = useState<{ svg: string; expiresAt: number } | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [pending, startTransition] = useTransition();
  const known = useRef(new Set(initial.encounters.map((encounter) => encounter.id)));
  const lastPoints = useRef(initial.points);
  const clockOffset = useRef(0);

  // Pide un QR nuevo cada vez que vence el anterior.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/e/${slug}/mi-qr`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { svg: string; expiresAt: number; serverNow: number };
        if (cancelled) return;
        clockOffset.current = data.serverNow - Date.now();
        setQr({ svg: data.svg, expiresAt: data.expiresAt });
        setQrFailed(false);
        timer = setTimeout(load, Math.max(1000, data.expiresAt - data.serverNow + 300));
      } catch {
        if (cancelled) return;
        setQrFailed(true);
        timer = setTimeout(load, 3000);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  // Reloj para la cuenta regresiva del QR.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => clearInterval(id);
  }, []);

  // Avisa cuando otra persona escanea tu QR.
  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/e/${slug}/mis-encuentros`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as Mine;
        const fresh = data.encounters.filter((encounter) => !known.current.has(encounter.id));
        fresh.forEach((encounter) => known.current.add(encounter.id));
        const gained = Math.max(0, data.points - lastPoints.current);
        lastPoints.current = data.points;
        setMine(data);
        const incoming = fresh.find((encounter) => !encounter.scannedByMe);
        if (incoming) {
          setOverlay(
            (current) =>
              current ?? { kind: "scanned_me", name: incoming.name, points: gained, question: incoming.question },
          );
        }
      } catch {
        // Si se corta la red, lo vuelve a intentar en el próximo ciclo.
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug]);

  function onScan(text: string) {
    setScanning(false);
    const parsed = tokenFromEncounterUrl(slug, text);
    if (parsed.status !== "ok") {
      setOverlay({
        kind: "error",
        message: parsed.status === "other_event" ? "Ese QR es de otro plan." : "Ese QR no es el de un encuentro de Tiki.",
      });
      return;
    }
    startTransition(async () => {
      const result = await meet(slug, parsed.token);
      if (result.status === "error") {
        setOverlay({ kind: "error", message: result.message });
        return;
      }
      known.current.add(result.encounterId);
      setOverlay({
        kind: "met",
        name: result.name,
        points: result.points,
        alreadyMet: result.alreadyMet,
        question: result.question,
      });
      const response = await fetch(`/api/e/${slug}/mis-encuentros`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as Mine;
        lastPoints.current = data.points;
        setMine(data);
      }
    });
  }

  const secondsLeft = qr && now !== null ? Math.min(30, Math.max(0, Math.ceil((qr.expiresAt - now) / 1000))) : null;
  const metCount = mine.encounters.length;

  return (
    <div className="space-y-5">
      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
      {overlay && (
        <ResultOverlay
          overlay={overlay}
          onClose={() => setOverlay(null)}
          onScanAgain={() => {
            setOverlay(null);
            setScanning(true);
          }}
        />
      )}

      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Encontrate con <span className="text-gradient">alguien</span>
        </h1>
        {!mine.checkedIn && (
          <p className="mt-2 text-lg text-muted">
            Escaneá el QR de otra persona del plan, o que escanee el tuyo. Así queda confirmado que llegaste a{" "}
            {placeLabel} y sumás {pointsReward} puntos.
          </p>
        )}
      </header>

      {mine.checkedIn && (
        <section className="card flex items-start gap-3 border-success/40" role="status">
          <CircleCheck aria-hidden className="mt-0.5 size-7 shrink-0 text-success" />
          <div>
            <p className="font-display text-xl font-extrabold">Llegaste a {placeLabel}</p>
            <p className="mt-1 text-muted">
              Sumaste {mine.points} puntos en este plan. Cada persona nueva que conocés suma 10 más, hasta 5.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="my-qr-title" className="card-glow text-center">
        <h2 id="my-qr-title" className="font-display text-2xl font-extrabold">
          Tu QR, {myName}
        </h2>
        <div
          className="mx-auto mt-4 aspect-square w-full max-w-72 overflow-hidden rounded-xl bg-white p-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label="Tu QR de encuentro"
          dangerouslySetInnerHTML={qr ? { __html: qr.svg } : undefined}
        />
        <p className="mt-3 text-muted" aria-live="polite">
          {qrFailed
            ? "No pudimos cargar tu QR. Probamos de nuevo..."
            : secondsLeft !== null
              ? `Cambia en ${secondsLeft} s. Mostraselo a alguien del plan.`
              : "Cargando tu QR..."}
        </p>
      </section>

      <button type="button" className="btn-primary w-full text-lg" onClick={() => setScanning(true)} disabled={pending}>
        <ScanLine aria-hidden className="size-5" />
        {pending ? "Registrando..." : "Escanear el QR de alguien"}
      </button>

      <section aria-labelledby="met-title" className="card">
        <h2 id="met-title" className="font-display text-xl font-extrabold">
          {metCount === 0 ? "Todavía no te encontraste con nadie" : `Te encontraste con ${metCount}`}
        </h2>
        {metCount > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {mine.encounters.map((encounter) => (
              <li key={encounter.id} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-medium">
                {encounter.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href={`/e/${slug}`} className="btn-secondary w-full">
        <ArrowLeft aria-hidden className="size-5" />
        Volver al plan
      </Link>
    </div>
  );
}

function ResultOverlay({
  overlay,
  onClose,
  onScanAgain,
}: {
  overlay: Overlay;
  onClose: () => void;
  onScanAgain: () => void;
}) {
  const isError = overlay.kind === "error";
  const title =
    overlay.kind === "met"
      ? overlay.alreadyMet
        ? `Ya te habías encontrado con ${overlay.name}`
        : `¡Te encontraste con ${overlay.name}!`
      : overlay.kind === "scanned_me"
        ? `${overlay.name} escaneó tu QR`
        : "No se pudo registrar";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="animate-pop-in w-full max-w-md rounded-2xl border border-primary/30 bg-card bg-linear-to-b from-primary/20 to-transparent p-6 text-center shadow-[0_0_60px_rgb(220_38_38/0.35)]">
        {isError ? (
          <TriangleAlert aria-hidden className="mx-auto size-12 text-danger" />
        ) : overlay.points > 0 ? (
          <div
            aria-hidden
            className="mx-auto flex size-24 items-center justify-center rounded-full bg-linear-to-br from-primary-bright to-primary font-display text-3xl font-extrabold text-white shadow-[0_0_40px_rgb(220_38_38/0.6)]"
          >
            +{overlay.points}
          </div>
        ) : (
          <CircleCheck aria-hidden className="mx-auto size-12 text-success" />
        )}

        <h2 id="result-title" className="mt-4 font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h2>
        {overlay.kind === "error" && <p className="mt-2 text-lg text-muted">{overlay.message}</p>}
        {overlay.kind !== "error" && overlay.points > 0 && (
          <p className="mt-2 text-lg text-muted">Sumaste {overlay.points} puntos.</p>
        )}

        {overlay.kind !== "error" && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary-bright">
              <MessageCircleQuestion aria-hidden className="size-4" />
              Para arrancar la charla
            </p>
            <p className="mt-1 text-lg font-semibold">{overlay.question}</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button type="button" className="btn-primary w-full" onClick={isError ? onScanAgain : onClose} autoFocus>
            {isError ? "Probar de nuevo" : "Listo"}
          </button>
          {!isError && (
            <button type="button" className="btn-secondary w-full" onClick={onScanAgain}>
              <ScanLine aria-hidden className="size-5" />
              Escanear a otra persona
            </button>
          )}
          {isError && (
            <button type="button" className="btn-secondary w-full" onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
