import { createMcpHandler } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerTikiMcp } from "@/lib/mcp/server";

// MCP público de Tiki (ver docs/mcp.md). Streamable HTTP sin estado: cada pedido arma su servidor.
const mcpHandler = createMcpHandler(registerTikiMcp, {
  serverInfo: { name: "tiki", version: "1.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

// No usa cookies ni credenciales, así que se puede llamar desde cualquier origen (por ejemplo,
// clientes MCP que corren en el navegador).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

async function handler(request: Request) {
  const response = await mcpHandler(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { handler as DELETE, handler as GET, handler as POST };
