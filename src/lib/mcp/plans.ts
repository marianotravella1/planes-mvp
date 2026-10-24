import { ARGENTINA_UTC_OFFSET, TIME_ZONE } from "@/lib/config";
import { db, dbErrorMessage } from "@/lib/db";
import { firstName, formatDateTime, formatIsoLocal } from "@/lib/format";
import { googleMapsDirectionsUrl } from "@/lib/maps";
import { normalizePhone } from "@/lib/phone";
import { planDraftQuery, type PlanDraft } from "@/lib/plan-draft";
import { McpUserError, type McpReader } from "./guard";

// Lo que el MCP sabe hacer con los planes. Las lecturas reciben la conexión de solo lectura
// (readAsMcp); sumarse usa la misma función SQL que la web.

const PAGE_SIZE = 20;
// Mismo mensaje para un código mal escrito y para un plan que no existe.
export const PLAN_NOT_FOUND = "No encontramos ese plan. Usá list_plans para ver los planes y sus códigos.";

/** El código del plan a partir del código o del link completo; null si no puede ser un plan. */
export function planSlug(value: string) {
  const slug = value.match(/\/e\/([a-z0-9]{4,16})(?:[/?#]|$)/)?.[1] ?? value.trim().toLowerCase();
  return /^[a-z0-9]{4,16}$/.test(slug) ? slug : null;
}

type PlanStatus = "abierto" | "lleno" | "terminado";

function planStatus(plan: { isFinished: boolean; capacity: number | null; joined: number }): PlanStatus {
  if (plan.isFinished) return "terminado";
  if (plan.capacity !== null && plan.joined >= plan.capacity) return "lleno";
  return "abierto";
}

function readCursor(cursor: string | undefined) {
  if (!cursor) return 0;
  const offset = Number(Buffer.from(cursor, "base64url").toString("utf8").replace(/^o:/, ""));
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000)
    throw new McpUserError("Ese cursor ya no sirve. Pedí la lista de nuevo, sin cursor.");
  return offset;
}

const writeCursor = (offset: number) => Buffer.from(`o:${offset}`).toString("base64url");

type PlanRow = {
  slug: string;
  title: string;
  placeName: string | null;
  address: string;
  startsAt: Date;
  capacity: number | null;
  joined: number;
  isFinished: boolean;
};

export type ListPlansInput = { query?: string; date?: string; past?: boolean; cursor?: string };

/** Lista compacta en JSON, con el código de cada plan para pedir el detalle. */
export async function listPlans(sql: McpReader, baseUrl: string, input: ListPlansInput) {
  const offset = readCursor(input.cursor);
  const pattern = input.query ? `%${input.query.replace(/[\\%_]/g, "\\$&")}%` : null;
  const newestFirst = Boolean(input.past && !input.date);

  const rows = await sql<PlanRow[]>`
    select
      e.slug, e.title, e.place_name, e.address, e.starts_at, e.capacity,
      (select count(*)::int from app.event_members m where m.event_id = e.id) as joined,
      e.starts_at < now() - interval '6 hours' as is_finished
    from app.events e
    where ${
      input.date
        ? sql`(e.starts_at at time zone ${TIME_ZONE})::date = ${input.date}::date`
        : input.past
          ? sql`e.starts_at <= now() - interval '3 hours'`
          : sql`e.starts_at > now() - interval '3 hours'`
    }
    ${
      pattern
        ? sql`and (e.title ilike ${pattern} or e.description ilike ${pattern} or e.place_name ilike ${pattern} or e.address ilike ${pattern})`
        : sql``
    }
    order by ${newestFirst ? sql`e.starts_at desc` : sql`e.starts_at`}, e.id
    limit ${PAGE_SIZE + 1} offset ${offset}
  `;

  return JSON.stringify({
    plans: rows.slice(0, PAGE_SIZE).map((row) => ({
      slug: row.slug,
      title: row.title,
      startsAt: formatIsoLocal(row.startsAt),
      when: formatDateTime(row.startsAt),
      place: row.placeName,
      address: row.address,
      joined: row.joined,
      capacity: row.capacity,
      spotsLeft: row.capacity === null ? null : Math.max(0, row.capacity - row.joined),
      status: planStatus(row),
      url: `${baseUrl}/e/${row.slug}`,
    })),
    nextCursor: rows.length > PAGE_SIZE ? writeCursor(offset + PAGE_SIZE) : null,
  });
}

type PlanDetail = PlanRow & {
  id: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  pointsReward: number;
  hostName: string;
  checkedIn: number;
  encounters: number;
};

const STATUS_TEXT: Record<PlanStatus, string> = {
  abierto: "Abierto, se puede sumar gente",
  lleno: "Lleno, no quedan lugares",
  terminado: "Terminado",
};

function peopleText(joined: number, capacity: number | null) {
  if (capacity === null) return `Van ${joined}, sin límite de gente`;
  const left = Math.max(0, capacity - joined);
  const leftText = left === 0 ? "no quedan lugares" : left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`;
  return `Van ${joined} de ${capacity}, ${leftText}`;
}

/** Detalle del plan en markdown: lo mismo que ve cualquiera en la página del plan sin cuenta. */
export async function planMarkdown(sql: McpReader, baseUrl: string, slug: string) {
  const [plan] = await sql<PlanDetail[]>`
    select
      e.id, e.slug, e.title, e.description, e.address, e.place_name, e.lat, e.lng, e.starts_at,
      e.capacity, e.points_reward, h.name as host_name,
      (select count(*)::int from app.event_members m where m.event_id = e.id) as joined,
      (select count(*)::int from app.event_members m where m.event_id = e.id and m.checked_in_at is not null) as checked_in,
      (select count(*)::int from app.encounters en where en.event_id = e.id) as encounters,
      e.starts_at < now() - interval '6 hours' as is_finished
    from app.events e
    join app.participants h on h.id = e.host_id
    where e.slug = ${slug}
  `;
  if (!plan) throw new McpUserError(PLAN_NOT_FOUND);

  const members = await sql<{ name: string; isHost: boolean; checkedIn: boolean }[]>`
    select p.name, m.role = 'host' as is_host, m.checked_in_at is not null as checked_in
    from app.event_members m
    join app.participants p on p.id = m.participant_id
    where m.event_id = ${plan.id}
    order by m.joined_at
  `;

  const url = `${baseUrl}/e/${plan.slug}`;
  const memberText = (member: (typeof members)[number]) => {
    const notes = [member.isHost && "organiza", member.checkedIn && "ya llegó"].filter(Boolean);
    return notes.length ? `${firstName(member.name)} (${notes.join(", ")})` : firstName(member.name);
  };

  const lines = [
    `# ${plan.title}`,
    "",
    `- **Cuándo:** ${formatDateTime(plan.startsAt)}, hora de Argentina (${formatIsoLocal(plan.startsAt)})`,
    `- **Dónde:** ${plan.placeName ? `${plan.placeName}, ${plan.address}` : plan.address}`,
    `- **Cómo llegar:** ${googleMapsDirectionsUrl(plan)}`,
    `- **Organiza:** ${firstName(plan.hostName)}`,
    `- **Gente:** ${peopleText(plan.joined, plan.capacity)}`,
    `- **Estado:** ${STATUS_TEXT[planStatus(plan)]}`,
    `- **Link del plan:** ${url}`,
  ];
  if (plan.description) {
    lines.push("", "## Descripción (la escribió quien organiza)", "", plan.description);
  }
  lines.push("", "## Quiénes van", "", members.length ? members.map(memberText).join(", ") : "Todavía nadie.");
  if (plan.checkedIn > 0 || plan.encounters > 0) {
    lines.push("", `Llegaron ${plan.checkedIn} y hubo ${plan.encounters} encuentros entre personas del plan.`);
  }
  lines.push(
    "",
    "## Cómo sumarse",
    "",
    `Con join_plan, usando el nombre y el celular de la persona, o desde ${url}. No hace falta cuenta. ` +
      `Al llegar, en la página del plan se toca Llegué y se escanea el QR de otra persona del plan: ` +
      `así queda confirmada la asistencia y cada una suma ${plan.pointsReward} puntos.`,
  );
  return lines.join("\n");
}

/** Planes que vienen, para el listado de resources (plan://código). */
export function upcomingPlans(sql: McpReader) {
  return sql<{ slug: string; title: string; startsAt: Date; placeName: string | null; address: string }[]>`
    select e.slug, e.title, e.starts_at, e.place_name, e.address
    from app.events e
    where e.starts_at > now() - interval '3 hours'
    order by e.starts_at, e.id
    limit 50
  `;
}

export type JoinPlanInput = { slug: string; name: string; phone: string };

const JOIN_ERRORS: Record<string, string> = {
  event_not_found: PLAN_NOT_FOUND,
  event_full: "El plan se llenó. Buscá otro con list_plans.",
  event_finished: "Ese plan ya terminó.",
};

/**
 * Suma a una persona sin cuenta, con la misma función que usa la web. Desde el chat no hay
 * navegador que vincular: el celular queda vinculado cuando la persona abre el plan y pone su número.
 */
export async function joinPlan(baseUrl: string, input: JoinPlanInput) {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) throw new McpUserError("El nombre tiene que tener entre 2 y 40 letras.");
  const phone = normalizePhone(input.phone);
  if (!phone)
    throw new McpUserError("No pudimos leer ese teléfono. Pedí el celular con característica, por ejemplo 341 555 1234.");

  let result: { alreadyMember: boolean; membersCount: number };
  try {
    [result] = await db()<{ alreadyMember: boolean; membersCount: number }[]>`
      select already_member, members_count from app.join_event(${input.slug}, ${name}, ${phone}, null)
    `;
  } catch (error) {
    const message = dbErrorMessage(error);
    if (message && JOIN_ERRORS[message]) throw new McpUserError(JOIN_ERRORS[message]);
    throw error;
  }

  const [plan] = await db()<{ title: string; startsAt: Date; placeName: string | null; address: string; pointsReward: number }[]>`
    select e.title, e.starts_at, e.place_name, e.address, e.points_reward from app.events e where e.slug = ${input.slug}
  `;
  const url = `${baseUrl}/e/${input.slug}`;
  const who = firstName(name);

  return [
    result.alreadyMember
      ? `${who} ya estaba en la lista de «${plan.title}».`
      : `Listo: ${who} quedó en la lista de «${plan.title}». Ya van ${result.membersCount}.`,
    `Es el ${formatDateTime(plan.startsAt)} en ${plan.placeName ?? plan.address}.`,
    "",
    `Para tener el plan en el celular, hay que abrir ${url} y poner el mismo número: Tiki reconoce a la persona. ` +
      `Al llegar, se toca Llegué y se escanea el QR de otra persona del plan para confirmar la asistencia y sumar ${plan.pointsReward} puntos.`,
  ].join("\n");
}

/**
 * Crear un plan pide cuenta. Esta tool no crea nada: arma el link a /crear con el formulario
 * completo, y ahí Tiki pide iniciar sesión (o crear la cuenta) antes de publicar.
 */
export function createPlanLink(baseUrl: string, draft: PlanDraft) {
  const startsAt = new Date(`${draft.date}T${draft.time}:00${ARGENTINA_UTC_OFFSET}`);
  if (Number.isNaN(startsAt.getTime())) throw new McpUserError("Revisá la fecha y la hora del plan.");
  if (startsAt.getTime() < Date.now() - 60 * 60 * 1000)
    throw new McpUserError("Ese horario ya pasó. Elegí otro día u horario.");
  if (startsAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000)
    throw new McpUserError("Elegí una fecha dentro de los próximos seis meses.");

  const link = `${baseUrl}/crear?${planDraftQuery(draft)}`;
  return [
    `Para publicar «${draft.title}» hace falta una cuenta de Tiki, y la sesión se inicia en la web.`,
    "",
    `Link para publicarlo: ${link}`,
    "",
    "Al abrirlo, Tiki pide iniciar sesión o crear una cuenta con usuario y contraseña. Después aparece el formulario " +
      "con todo cargado: se revisa y se toca Publicar. Ahí el plan queda creado, con su link y su QR para compartir.",
  ].join("\n");
}
