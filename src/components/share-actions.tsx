"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { whatsappShareUrl } from "@/lib/share";
import { WhatsappIcon } from "./whatsapp-icon";

type Props = { url: string; title: string; text: string };

export function ShareActions({ url, title, text }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, text, url });
    } catch {
      // Si la persona cierra el menú de compartir no hacemos nada más.
    }
  }

  return (
    <div className="space-y-3">
      <a href={whatsappShareUrl(text, url)} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
        <WhatsappIcon className="size-5" />
        Compartir por WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? <Check aria-hidden className="size-5 text-success" /> : <Copy aria-hidden className="size-5" />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <button type="button" className="btn-secondary" onClick={share}>
          <Share2 aria-hidden className="size-5" />
          Otras apps
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copiado" : ""}
      </span>
    </div>
  );
}
