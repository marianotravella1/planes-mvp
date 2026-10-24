/** Abre WhatsApp con el mensaje listo para mandar (en el celular, la app; en la compu, WhatsApp Web). */
/**
 * Abre Claude con el formulario de conector personalizado ya completo. Anthropic no documenta este
 * link: si deja de andar, Claude muestra igual sus conectores y quedan los pasos a mano.
 */
export function claudeConnectorUrl(mcpUrl: string) {
  const params = new URLSearchParams({ modal: "add-custom-connector", connectorName: "Tiki", connectorUrl: mcpUrl });
  return `https://claude.ai/customize/connectors?${params}`;
}

export function whatsappShareUrl(text: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}
