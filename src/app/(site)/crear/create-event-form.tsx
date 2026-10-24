"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Infinity as InfinityIcon, Minus, Plus, UsersRound } from "lucide-react";
import { AddressInput } from "@/components/address-input";
import type { EventField, EventFormState } from "@/lib/event-form";

type Place = { lat: number; lng: number };

type Props = {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  mode: "create" | "edit";
  today: string;
  // Valores con los que arranca el formulario (al editar, los del plan).
  initial?: Partial<Record<EventField, string>>;
  initialPlace?: Place | null;
  // true si la cuenta ya tiene nombre y teléfono guardados: no se vuelven a pedir.
  hostLocked: boolean;
  knownName: string;
  knownPhone: string;
};

const stepperButton =
  "inline-flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/10";

export function CreateEventForm({
  action,
  mode,
  today,
  initial,
  initialPlace,
  hostLocked,
  knownName,
  knownPhone,
}: Props) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(action, {});
  const values = state.values ?? initial ?? {};
  const errors = state.fieldErrors ?? {};
  const [capacity, setCapacity] = useState(() => Number(values.capacity) || 6);
  const [unlimited, setUnlimited] = useState(values.capacityMode === "unlimited");

  const errorProps = (field: EventField) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {};
  const errorText = (field: EventField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <fieldset className="card space-y-5">
        <legend className="sr-only">El plan</legend>

        <div>
          <label htmlFor="title" className="field-label">
            Qué plan es
          </label>
          <input
            id="title"
            name="title"
            className="input"
            placeholder="Birra después de la hackatón"
            maxLength={80}
            required
            defaultValue={values.title}
            {...errorProps("title")}
          />
          {errorText("title")}
        </div>

        <div>
          <AddressInput
            defaultPlaceName={values.placeName}
            defaultAddress={values.address}
            defaultSelected={state.values ? null : initialPlace}
            invalid={Boolean(errors.address)}
            describedBy={errors.address ? "address-error" : undefined}
          />
          {errorText("address")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="field-label">
              Día
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className="input"
              min={today}
              required
              defaultValue={values.date ?? today}
              {...errorProps("date")}
            />
            {errorText("date")}
          </div>
          <div>
            <label htmlFor="time" className="field-label">
              Horario
            </label>
            <input
              id="time"
              name="time"
              type="time"
              className="input"
              required
              defaultValue={values.time}
              {...errorProps("time")}
            />
            {errorText("time")}
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Cuánta gente</legend>
          <input type="hidden" name="capacityMode" value={unlimited ? "unlimited" : "limited"} />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cuánta gente">
            {[
              { value: false, label: "Con cupo", Icon: UsersRound },
              { value: true, label: "Sin límite", Icon: InfinityIcon },
            ].map(({ value, label, Icon }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={unlimited === value}
                onClick={() => setUnlimited(value)}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 font-semibold transition-colors ${
                  unlimited === value
                    ? "border-primary-bright bg-primary/20 text-foreground"
                    : "border-white/15 bg-white/5 text-muted hover:bg-white/10"
                }`}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </button>
            ))}
          </div>

          {unlimited ? (
            <p className="field-hint">Se puede sumar toda la gente que quiera.</p>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className={stepperButton}
                  aria-label="Una persona menos"
                  onClick={() => setCapacity((value) => Math.max(2, value - 1))}
                >
                  <Minus aria-hidden className="size-5" />
                </button>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  className="input w-24 text-center text-lg font-semibold tabular-nums"
                  min={2}
                  max={500}
                  required
                  aria-label="Cantidad total de personas"
                  value={capacity}
                  onChange={(event) => setCapacity(Number(event.target.value))}
                  aria-describedby={errors.capacity ? "capacity-error" : "capacity-hint"}
                  aria-invalid={errors.capacity ? true : undefined}
                />
                <button
                  type="button"
                  className={stepperButton}
                  aria-label="Una persona más"
                  onClick={() => setCapacity((value) => Math.min(500, value + 1))}
                >
                  <Plus aria-hidden className="size-5" />
                </button>
              </div>
              <p id="capacity-hint" className="field-hint">
                En total, contándote a vos. Cuando se llena, nadie más se puede sumar.
              </p>
              {errorText("capacity")}
            </>
          )}
        </fieldset>

        <div>
          <label htmlFor="description" className="field-label">
            Descripción <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            className="input min-h-28 py-3"
            maxLength={600}
            placeholder="Nos juntamos en la puerta y vamos caminando. Cada uno paga lo suyo."
            defaultValue={values.description}
            {...errorProps("description")}
          />
          {errorText("description")}
        </div>
      </fieldset>

      {mode === "edit" ? null : hostLocked ? (
        <p className="text-muted">
          Organizás como <strong className="text-foreground">{knownName}</strong> ({knownPhone}).
        </p>
      ) : (
        <fieldset className="card space-y-5">
          <legend className="sr-only">Quién organiza</legend>
          <div>
            <h2 className="font-display text-xl font-bold">Quién organiza</h2>
            <p className="mt-1 text-muted">Lo pedimos una sola vez. Tu número no se muestra a nadie.</p>
          </div>

          <div>
            <label htmlFor="hostName" className="field-label">
              Tu nombre
            </label>
            <input
              id="hostName"
              name="hostName"
              className="input"
              autoComplete="given-name"
              maxLength={40}
              required
              defaultValue={values.hostName ?? knownName}
              {...errorProps("hostName")}
            />
            {errorText("hostName")}
          </div>

          <div>
            <label htmlFor="hostPhone" className="field-label">
              Tu teléfono
            </label>
            <input
              id="hostPhone"
              name="hostPhone"
              type="tel"
              inputMode="tel"
              className="input"
              autoComplete="tel"
              placeholder="341 555 1234"
              required
              defaultValue={values.hostPhone ?? knownPhone}
              {...errorProps("hostPhone")}
            />
            {errorText("hostPhone")}
          </div>
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 font-medium text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full text-lg" disabled={pending}>
        {pending ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Publicar el plan"}
        {!pending && <ArrowRight aria-hidden className="size-5" />}
      </button>
    </form>
  );
}
