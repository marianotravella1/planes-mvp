"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";

// La web no puede saber si el conector está en la cuenta de Claude: Claude llama al MCP desde sus
// servidores, sin nada que lo ate a este navegador. Se recuerda acá si la persona ya lo conectó.
const KEY = "tiki-claude-conectado";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markClaudeConnected() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Sin almacenamiento, la tarjeta se sigue mostrando.
  }
  listeners.forEach((listener) => listener());
}

/** Muestra la tarjeta de Claude completa hasta que la persona lo conecta; después, una línea corta. */
export function ClaudeCardGate({ children }: { children: ReactNode }) {
  const connected = useSyncExternalStore(subscribe, read, () => false);
  const [open, setOpen] = useState(false);

  if (!connected || open) {
    return (
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-claude-connect]"))
            markClaudeConnected();
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-2 text-muted">
      <CircleCheck aria-hidden className="size-5 text-success" />
      Ya conectaste Tiki con Claude.
      <button
        type="button"
        className="min-h-11 font-semibold text-primary-bright underline"
        onClick={() => setOpen(true)}
      >
        Ver cómo conectarlo
      </button>
    </p>
  );
}
