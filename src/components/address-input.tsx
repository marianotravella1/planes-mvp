"use client";

import { useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { PlaceSuggestion } from "@/app/api/places/route";

type Selected = { placeName: string | null; lat: number; lng: number };

type Props = {
  defaultAddress?: string;
  invalid?: boolean;
  describedBy?: string;
};

/** Campo de dirección con sugerencias. Si no se elige ninguna, se guarda el texto tal cual. */
export function AddressInput({ defaultAddress = "", invalid, describedBy }: Props) {
  const [query, setQuery] = useState(defaultAddress);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const controller = useRef<AbortController>(undefined);
  const listId = useId();

  function search(text: string) {
    clearTimeout(timer.current);
    controller.current?.abort();
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const abort = new AbortController();
      controller.current = abort;
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(text)}`, { signal: abort.signal });
        const data = (await response.json()) as { results: PlaceSuggestion[] };
        setSuggestions(data.results);
        setActive(-1);
        setOpen(true);
      } catch {
        // Sin conexión o pedido cancelado: el campo sigue funcionando como texto libre.
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 300);
  }

  function choose(suggestion: PlaceSuggestion) {
    clearTimeout(timer.current);
    controller.current?.abort();
    const address = [suggestion.label, suggestion.detail].filter(Boolean).join(", ");
    setQuery(address.slice(0, 200));
    setSelected({ placeName: suggestion.placeName, lat: suggestion.lat, lng: suggestion.lng });
    setOpen(false);
    setLoading(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div>
      <div className="relative">
        <input
          id="address"
          name="address"
          className="input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder="Bar, cancha, plaza o dirección"
          required
          minLength={3}
          maxLength={200}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            search(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        <input type="hidden" name="placeName" value={selected?.placeName ?? ""} />
        <input type="hidden" name="lat" value={selected?.lat ?? ""} />
        <input type="hidden" name="lng" value={selected?.lng ?? ""} />

        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-lg border border-white/15 bg-card py-1 shadow-2xl shadow-black/60"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 ${index === active ? "bg-primary/20" : "hover:bg-white/5"}`}
                // mousedown en lugar de click para que el blur del input no cierre la lista antes.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(suggestion);
                }}
              >
                <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-bright" />
                <span>
                  <span className="block font-semibold">{suggestion.label}</span>
                  {suggestion.detail && <span className="block text-sm text-muted">{suggestion.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="field-hint" aria-live="polite">
        {loading
          ? "Buscando direcciones..."
          : selected
            ? "Listo, el lugar queda marcado justo en el mapa de Google."
            : "Elegí una sugerencia para marcar el lugar justo en el mapa. Sugerencias de OpenStreetMap."}
      </p>
    </div>
  );
}
