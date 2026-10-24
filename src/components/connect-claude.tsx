import { ExternalLink, MessagesSquare } from "lucide-react";
import { claudeConnectorUrl } from "@/lib/share";
import { siteUrl } from "@/lib/site";
import { ClaudeCardGate } from "./claude-card-gate";
import { CopyText } from "./copy-text";

/** Botón para sumar Tiki como conector de Claude (el MCP de /api/mcp). Sirve con o sin cuenta de Tiki. */
export async function ConnectClaude() {
  const mcpUrl = `${await siteUrl()}/api/mcp`;

  return (
    <ClaudeCardGate>
      <section aria-labelledby="claude-title" className="card-glow">
        <div className="flex items-start gap-4">
          <MessagesSquare
            aria-hidden
            className="mt-1 size-7 shrink-0 text-primary-bright"
          />
          <div>
            <h2
              id="claude-title"
              className="font-display text-xl font-extrabold"
            >
              Tiki en Claude
            </h2>
            <p className="mt-1 text-muted">
              Conectá Tiki con tu cuenta de Claude y pedile que te busque un
              plan o que te sume a uno, sin cuenta de Tiki. Para armar un plan,
              Claude te pasa un link para entrar con tu cuenta y publicarlo.
            </p>
          </div>
        </div>

        <a
          href={claudeConnectorUrl(mcpUrl)}
          target="_blank"
          rel="noopener noreferrer"
          data-claude-connect
          className="btn-primary mt-5 w-full sm:w-auto"
        >
          Conectar con Claude
          <ExternalLink aria-hidden className="size-5" />
        </a>

        <details className="mt-5 text-muted">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-foreground">
            Si Claude no abre el formulario
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Entrá a{" "}
              <a
                href="https://claude.ai/customize/connectors"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-bright underline"
              >
                los conectores de Claude
              </a>
              .
            </li>
            <li>Tocá + y elegí agregar un conector personalizado.</li>
            <li>Poné Tiki de nombre y pegá esta dirección.</li>
          </ol>
          <CopyText value={mcpUrl} label="Dirección del conector de Tiki" />
        </details>
      </section>
    </ClaudeCardGate>
  );
}
