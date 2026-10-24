"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Un texto para copiar, por ejemplo la dirección del conector de Claude. */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá la dirección:", value);
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        className="input min-w-0 flex-1"
        onFocus={(event) => event.currentTarget.select()}
      />
      <button type="button" className="btn-secondary shrink-0" onClick={copy}>
        {copied ? <Check aria-hidden className="size-5 text-success" /> : <Copy aria-hidden className="size-5" />}
        {copied ? "Copiada" : "Copiar"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Dirección copiada" : ""}
      </span>
    </div>
  );
}
