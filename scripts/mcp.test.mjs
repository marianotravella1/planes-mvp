// Pruebas del MCP público contra el servidor de desarrollo y la base local.
//   npm run dev            (en otra terminal)
//   npm run test:mcp
// Crea un plan de prueba (código mcptest) y lo borra al terminar.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import postgres from "postgres";

const MCP_URL = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";
const SLUG = "mcptest";
const HOST_PHONE = "+5493415550101";
const GUEST_PHONE = "+5493415550202";
const OTHER_PHONE = "+5493415550303";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const client = new Client({ name: "tiki-tests", version: "1.0.0" });

const text = (result) => result.content.map((block) => block.text ?? "").join("\n");
const call = (name, args = {}) => client.callTool({ name, arguments: args });

async function cleanUp() {
  await sql`delete from app.events where slug = ${SLUG}`;
  await sql`delete from app.participants where phone_e164 in (${HOST_PHONE}, ${GUEST_PHONE}, ${OTHER_PHONE})`;
}

before(async () => {
  await cleanUp();
  const [host] = await sql`
    insert into app.participants (name, phone_e164) values ('Ramona Prueba', ${HOST_PHONE}) returning id
  `;
  const [event] = await sql`
    insert into app.events (slug, title, description, host_id, address, place_name, starts_at, capacity)
    values (${SLUG}, 'Prueba del MCP', 'Plan de prueba', ${host.id}, 'Pellegrini 1200, Rosario', 'Bar de prueba',
            now() + interval '1 day', 3)
    returning id
  `;
  await sql`insert into app.event_members (event_id, participant_id, role) values (${event.id}, ${host.id}, 'host')`;
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
});

after(async () => {
  await client.close();
  await cleanUp();
  await sql.end();
});

describe("tools", () => {
  test("expone las cuatro tools, y solo join_plan escribe", async () => {
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    assert.deepEqual(Object.keys(byName).sort(), ["create_plan", "find_plans_in_rosario", "get_plan", "join_plan"]);
    assert.equal(byName.find_plans_in_rosario.annotations.readOnlyHint, true);
    assert.equal(byName.get_plan.annotations.readOnlyHint, true);
    assert.equal(byName.create_plan.annotations.readOnlyHint, true);
    assert.equal(byName.join_plan.annotations.readOnlyHint, false);
  });

  test("find_plans_in_rosario trae el plan con sus datos públicos y sin teléfonos", async () => {
    const result = await call("find_plans_in_rosario", { query: "MCP" });
    assert.equal(result.isError, undefined);
    const body = JSON.parse(text(result));
    const plan = body.plans.find((item) => item.slug === SLUG);
    assert.ok(plan, "el plan de prueba aparece");
    assert.equal(plan.title, "Prueba del MCP");
    assert.equal(plan.status, "abierto");
    assert.equal(plan.spotsLeft, 2);
    assert.match(plan.startsAt, /-03:00$/);
    assert.ok(plan.url.endsWith(`/e/${SLUG}`));
    assert.doesNotMatch(text(result), /555010/);
  });

  test("find_plans_in_rosario tolera comodines de SQL en la búsqueda", async () => {
    const result = await call("find_plans_in_rosario", { query: "%_%" });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(text(result)).plans, []);
  });

  test("get_plan acepta el código o el link y no muestra teléfonos", async () => {
    for (const plan of [SLUG, `https://planes-mvp.vercel.app/e/${SLUG}?nuevo=1`]) {
      const result = await call("get_plan", { plan });
      assert.equal(result.isError, undefined);
      const body = text(result);
      assert.match(body, /^# Prueba del MCP/);
      assert.match(body, /\*\*Organiza:\*\* Ramona/);
      assert.match(body, /Ramona \(organiza\)/);
      assert.doesNotMatch(body, /555010|Prueba \(organiza\)/);
    }
  });

  test("get_plan responde igual a un código inexistente y a uno inválido", async () => {
    const missing = await call("get_plan", { plan: "noexiste1" });
    const invalid = await call("get_plan", { plan: "../../etc" });
    assert.equal(missing.isError, true);
    assert.equal(text(missing), text(invalid));
    assert.match(text(missing), /No encontramos ese plan/);
  });

  test("join_plan suma a la persona una sola vez", async () => {
    const first = await call("join_plan", { plan: SLUG, name: "Juli Prueba", phone: "341 555-0202" });
    assert.equal(first.isError, undefined, text(first));
    assert.match(text(first), /Listo: Juli quedó en la lista de «Prueba del MCP»/);
    assert.doesNotMatch(text(first), /555-?0202/);

    const again = await call("join_plan", { plan: SLUG, name: "Juli Prueba", phone: "+54 9 341 555 0202" });
    assert.match(text(again), /ya estaba en la lista/);

    const detail = text(await call("get_plan", { plan: SLUG }));
    assert.match(detail, /Juli/);
    assert.match(detail, /Van 2 de 3/);
  });

  test("join_plan rechaza un teléfono que no se puede leer", async () => {
    const result = await call("join_plan", { plan: SLUG, name: "Alguien", phone: "123456" });
    assert.equal(result.isError, true);
    assert.match(text(result), /No pudimos leer ese teléfono/);
  });

  test("join_plan avisa cuando el plan se llenó", async () => {
    await call("join_plan", { plan: SLUG, name: "Tercera Persona", phone: OTHER_PHONE });
    const full = await call("join_plan", { plan: SLUG, name: "Cuarta Persona", phone: "+5493415550404" });
    assert.equal(full.isError, true);
    assert.match(text(full), /se llenó/);
    const listed = JSON.parse(text(await call("find_plans_in_rosario", { query: "MCP" }))).plans.find((p) => p.slug === SLUG);
    assert.equal(listed.status, "lleno");
  });

  test("create_plan no publica nada: devuelve el link a /crear con el formulario completo", async () => {
    const [{ count: before }] = await sql`select count(*)::int as count from app.events`;
    const result = await call("create_plan", {
      title: "Fútbol 5, faltan 4",
      date: "2099-01-01",
      time: "18:30",
      address: "Pellegrini 1200, Rosario",
    });
    assert.equal(result.isError, true, "una fecha a más de seis meses se rechaza");

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ok = await call("create_plan", {
      title: "Fútbol 5, faltan 4",
      date: tomorrow,
      time: "18:30",
      address: "Pellegrini 1200, Rosario",
      placeName: "Club de prueba",
      capacity: 10,
    });
    assert.equal(ok.isError, undefined, text(ok));
    const link = new URL(text(ok).match(/https?:\/\/\S+\/crear\?\S+/)[0]);
    assert.equal(link.searchParams.get("titulo"), "Fútbol 5, faltan 4");
    assert.equal(link.searchParams.get("fecha"), tomorrow);
    assert.equal(link.searchParams.get("hora"), "18:30");
    assert.equal(link.searchParams.get("lugar"), "Club de prueba");
    assert.equal(link.searchParams.get("cupo"), "10");
    const [{ count: afterCount }] = await sql`select count(*)::int as count from app.events`;
    assert.equal(afterCount, before);

    // Sin sesión, /crear pide entrar y conserva el plan para después del ingreso.
    const page = await (await fetch(new URL(link.pathname + link.search, MCP_URL))).text();
    assert.match(page, /Creá tu cuenta para organizar/);
    assert.match(page, /name="next" value="\/crear\?titulo=/);
  });
});

describe("cómo lo encuentra un cliente", () => {
  test("el servidor se presenta con título, descripción e ícono", () => {
    const info = client.getServerVersion();
    assert.equal(info.name, "tiki");
    assert.match(info.title, /Rosario/);
    assert.match(info.description, /conocer gente/);
    assert.ok(info.icons?.[0]?.src.endsWith("/icon.png"));
    assert.match(client.getInstructions(), /antes de buscar en la web/);
  });

  test("la búsqueda de planes nombra Rosario y las preguntas típicas, en español y en inglés", async () => {
    const { tools } = await client.listTools();
    const find = tools.find((tool) => tool.name === "find_plans_in_rosario");
    for (const word of ["Rosario", "conocer gente", "hoy", "fútbol", "birra", "antes de buscar en la web", "meet new people"]) {
      assert.ok(find.description.includes(word), `falta "${word}" en la descripción`);
    }
  });

  test("ofrece prompts para pedir planes de hoy y armar uno", async () => {
    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map((prompt) => prompt.name).sort(), ["armar_un_plan", "planes_de_hoy"]);
    const { messages } = await client.getPrompt({ name: "planes_de_hoy" });
    assert.match(messages[0].content.text, /Tiki/);
  });
});

describe("resources", () => {
  test("cada plan es un resource plan://código con el mismo detalle que get_plan", async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.some((resource) => resource.uri === `plan://${SLUG}`));
    const { contents } = await client.readResource({ uri: `plan://${SLUG}` });
    assert.match(contents[0].text, /^# Prueba del MCP/);
  });
});

describe("base de datos", () => {
  test("el registro guarda la operación y el plan, sin nombre ni teléfono", async () => {
    const rows = await sql`
      select operation, params::text as params from app.mcp_requests
      where operation = 'join_plan' and params->>'plan' = ${SLUG}
    `;
    assert.ok(rows.length >= 2);
    for (const row of rows) assert.doesNotMatch(row.params, /Juli|555|0202/);
  });

  test("el rol del MCP no lee teléfonos ni puntos y no escribe", async () => {
    const asReader = (query) =>
      sql.begin("read only", async (tx) => {
        await tx`set local role tiki_mcp_reader`;
        return tx.unsafe(query);
      });
    await assert.rejects(asReader("select phone_e164 from app.participants limit 1"), /permission denied/);
    await assert.rejects(asReader("select count(*) from app.points_ledger"), /permission denied/);
    await assert.rejects(asReader("select count(*) from app.accounts"), /permission denied/);
    await assert.rejects(asReader("select count(*) from app.mcp_requests"), /permission denied/);
    await assert.rejects(asReader(`update app.events set title = title where slug = '${SLUG}'`), /permission denied|read-only/);
    const [{ count }] = await asReader("select count(*)::int as count from app.event_members");
    assert.ok(count > 0);
  });

  test("el límite por minuto corta al pedido 121 de un mismo cliente", async () => {
    const key = "f".repeat(64);
    try {
      let result = "ok";
      for (let i = 0; i < 121 && result === "ok"; i++) {
        [{ result }] = await sql`
          select app.log_mcp_request(${key}, 'find_plans_in_rosario', null, 'test', 120, null, 30) as result
        `;
      }
      assert.equal(result, "too_many_requests");
      const [{ count }] = await sql`select count(*)::int as count from app.mcp_requests where client_key = ${key}`;
      assert.equal(count, 120);
    } finally {
      await sql`delete from app.mcp_requests where client_key = ${key}`;
    }
  });
});
