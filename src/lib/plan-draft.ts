import type { EventField } from "./event-form";

// Un plan armado fuera de Tiki (por ejemplo desde Claude, con el MCP) llega a /crear con estos
// parámetros: el formulario se completa solo y quien organiza lo publica con su cuenta.
const PARAMS = {
  titulo: "title",
  fecha: "date",
  hora: "time",
  lugar: "placeName",
  direccion: "address",
  cupo: "capacity",
  descripcion: "description",
} as const satisfies Record<string, EventField>;

const UNLIMITED = "sin-limite";

export type PlanDraft = {
  title: string;
  date: string;
  time: string;
  address: string;
  placeName?: string;
  capacity?: number;
  description?: string;
};

export function planDraftQuery(draft: PlanDraft) {
  const params = new URLSearchParams({
    titulo: draft.title,
    fecha: draft.date,
    hora: draft.time,
    direccion: draft.address,
  });
  if (draft.placeName) params.set("lugar", draft.placeName);
  params.set("cupo", draft.capacity ? String(draft.capacity) : UNLIMITED);
  if (draft.description) params.set("descripcion", draft.description);
  return params.toString();
}

/** Valores iniciales del formulario a partir de la URL de /crear, o null si la URL no trae un plan. */
export function readPlanDraft(query: Record<string, string | string[] | undefined>) {
  const initial: Partial<Record<EventField, string>> = {};
  const params = new URLSearchParams();

  for (const [param, field] of Object.entries(PARAMS)) {
    const value = query[param];
    if (typeof value !== "string" || !value.trim()) continue;
    // El formulario valida al publicar; acá solo se evita cargar textos enormes.
    const clean = value.trim().slice(0, 600);
    params.set(param, clean);
    if (field === "capacity") {
      initial.capacityMode = clean === UNLIMITED ? "unlimited" : "limited";
      if (clean !== UNLIMITED) initial.capacity = clean;
    } else {
      initial[field] = clean;
    }
  }

  const queryString = params.toString();
  return queryString ? { initial, query: queryString } : null;
}
