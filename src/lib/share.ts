/** Abre WhatsApp con el mensaje listo para mandar (en el celular, la app; en la compu, WhatsApp Web). */
export function whatsappShareUrl(text: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}
