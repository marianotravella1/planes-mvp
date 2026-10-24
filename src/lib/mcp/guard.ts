import { createHmac } from "node:crypto";
import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import { getPublicOrigin } from "mcp-handler";
import type postgres from "postgres";
import { db } from "@/lib/db";

// Los conectores de claude.ai llaman desde las IP de Anthropic, así que mucha gente comparte la
// misma IP: los límites son generosos y sirven para frenar scripts, no a quien usa Claude.
const REQUESTS_PER_MINUTE = 120;
const BUCKET_PER_HOUR = 30;
// Tope por respuesta, para no llenar el contexto del modelo.
const MAX_RESPONSE_CHARS = 50_000;

/** Error que el modelo puede leer y explicarle a la persona. */
export class McpUserError extends Error {}

export type McpOperation = {
  name: string;
  // Solo datos que no identifican a nadie: quedan en el registro.
  params?: Record<string, unknown>;
  // Pedidos con un límite propio por hora, por ejemplo sumarse a un mismo plan.
  bucket?: string;
};

export type McpReader = postgres.TransactionSql;

function logSecret() {
  const value = process.env.MCP_LOG_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("Falta MCP_LOG_SECRET.");
  return "solo-para-desarrollo";
}

/** La IP del pedido como HMAC: alcanza para los límites sin guardar la IP. */
function clientKey(request: Request | undefined) {
  const ip =
    request?.headers.get("x-real-ip") ?? request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";
  return createHmac("sha256", logSecret()).update(ip).digest("hex");
}

const LIMIT_MESSAGES: Record<string, string> = {
  too_many_requests: "Hubo demasiadas consultas seguidas. Esperá un minuto y probá de nuevo.",
  bucket_full: "Se anotó mucha gente a este plan desde el chat en la última hora. Probá más tarde o sumate desde el link.",
};

/**
 * Puerta única del MCP: límite de uso y registro de cada pedido. Toda tool y todo resource
 * pasan por acá; un camino que sirva datos sin pasar por esta función queda fuera del límite
 * y sin rastro en el registro.
 */
async function admit(ctx: ServerContext, operation: McpOperation) {
  const request = ctx.http?.req;
  const params = operation.params ? db().json(operation.params as postgres.JSONValue) : null;
  const [row] = await db()<{ result: string }[]>`
    select app.log_mcp_request(
      ${clientKey(request)}::text, ${operation.name}::text, ${params}::jsonb,
      ${request?.headers.get("user-agent") ?? null}::text, ${REQUESTS_PER_MINUTE}::int,
      ${operation.bucket ?? null}::text, ${BUCKET_PER_HOUR}::int
    ) as result
  `;
  if (row?.result !== "ok") throw new McpUserError(LIMIT_MESSAGES[row?.result ?? ""] ?? LIMIT_MESSAGES.too_many_requests);
}

/**
 * Lecturas del MCP: transacción de solo lectura con el rol tiki_mcp_reader, que solo ve las
 * columnas públicas (ver la migración del MCP).
 */
export async function readAsMcp<T>(run: (sql: McpReader) => Promise<T>): Promise<T> {
  const result = await db().begin("read only", async (sql) => {
    await sql`set local role tiki_mcp_reader`;
    return run(sql);
  });
  return result as T;
}

/** Recorta las respuestas largas, para no llenar el contexto del modelo. */
export function fitMcpText(text: string) {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return `${text.slice(0, MAX_RESPONSE_CHARS)}\n\n(Respuesta recortada: pasaba los ${MAX_RESPONSE_CHARS} caracteres.)`;
}

const INTERNAL_ERROR = "Tiki tuvo un problema para responder. Probá de nuevo en un rato.";

/** Corre una tool con los controles del MCP. Los errores vuelven como texto que el modelo puede explicar. */
export async function runMcpTool(
  ctx: ServerContext,
  operation: McpOperation,
  run: () => Promise<string>,
): Promise<CallToolResult> {
  try {
    await admit(ctx, operation);
    return { content: [{ type: "text", text: fitMcpText(await run()) }] };
  } catch (error) {
    if (error instanceof McpUserError) return { content: [{ type: "text", text: error.message }], isError: true };
    console.error(`mcp ${operation.name}`, error);
    return { content: [{ type: "text", text: INTERNAL_ERROR }], isError: true };
  }
}

/** Lo mismo para los resources, que informan los errores como errores del protocolo. */
export async function runMcpResource<T>(ctx: ServerContext, operation: McpOperation, run: () => Promise<T>) {
  try {
    await admit(ctx, operation);
    return await run();
  } catch (error) {
    if (error instanceof McpUserError) throw new Error(error.message);
    console.error(`mcp ${operation.name}`, error);
    throw new Error(INTERNAL_ERROR);
  }
}

/** Origen público para los links que devuelve el MCP. */
export function publicBaseUrl(ctx: ServerContext) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const request = ctx.http?.req;
  return request ? getPublicOrigin(request) : "http://localhost:3000";
}
