"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

/**
 * Cámara a pantalla completa que lee un QR. Usa el lector nativo del navegador si existe
 * (Chrome en Android) y si no, jsQR (Safari en iPhone). Devuelve el primer QR que encuentra.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const handleResult = useEffectEvent(onResult);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    let detector: Detector | null = null;
    const NativeDetector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    try {
      if (NativeDetector) detector = new NativeDetector({ formats: ["qr_code"] });
    } catch {
      detector = null;
    }

    async function read(element: HTMLVideoElement) {
      if (detector) {
        try {
          const codes = await detector.detect(element);
          if (codes[0]?.rawValue) return codes[0].rawValue;
          return null;
        } catch {
          detector = null;
        }
      }
      if (!context) return null;
      const scale = Math.min(1, 720 / Math.max(element.videoWidth, element.videoHeight));
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
    }

    async function tick() {
      if (stopped) return;
      const element = video.current;
      if (element && element.readyState >= 2 && element.videoWidth > 0) {
        const text = await read(element);
        if (text && !stopped) {
          handleResult(text);
          return;
        }
      }
      timer = setTimeout(tick, 150);
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const element = video.current;
        if (!element) return;
        element.srcObject = stream;
        await element.play();
        tick();
      } catch {
        if (!stopped) setError("No pudimos abrir la cámara. Dale permiso a la cámara para este sitio y probá de nuevo.");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Escanear un QR" className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 flex items-center justify-center">
          <div className="size-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
        </div>
        {error && (
          <p role="alert" className="absolute inset-x-4 top-1/3 rounded-xl bg-card p-4 text-center text-foreground">
            {error}
          </p>
        )}
      </div>
      <div className="space-y-3 bg-background p-4 pb-8">
        <p className="text-center text-lg font-semibold">Apuntá al QR del celular de la otra persona</p>
        <button type="button" className="btn-secondary w-full" onClick={onClose} autoFocus>
          <X aria-hidden className="size-5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
