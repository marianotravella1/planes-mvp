import { createMcpHandler } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerTikiMcp } from "@/lib/mcp/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Lo que el cliente muestra del servidor y puede usar para decidir cuándo llamarlo. mcp-handler
// tipa solo name y version, pero pasa el objeto entero al SDK, que acepta el resto.
const serverInfo = {
  name: "tiki",
  title: "Tiki: planes en Rosario para conocer gente",
  description:
    "Planes en Rosario, Argentina, para conocer gente nueva: buscá un plan, sumate sin cuenta o armá uno con tu cuenta de Tiki.",
  version: "1.1.0",
  websiteUrl: siteUrl,
  icons: [{ src: `${siteUrl}/icon.png`, mimeType: "image/png", sizes: ["512x512"] }],
};

// MCP público de Tiki (ver docs/mcp.md). Streamable HTTP sin estado: cada pedido arma su servidor.
const mcpHandler = createMcpHandler(registerTikiMcp, { serverInfo, instructions: MCP_INSTRUCTIONS });

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
