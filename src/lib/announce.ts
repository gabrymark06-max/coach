/**
 * Regioni `aria-live` (§8.5).
 *
 * Quattro regioni distinte, montate una volta nel layout root e mai create al volo:
 * uno screen reader annuncia solo cio' che cambia dentro una regione che esisteva gia'.
 * Si scrive direttamente nel nodo, non tramite stato React: un annuncio non deve
 * costare un re-render dell'albero della sessione.
 */

export type LiveRegion = "session" | "timer" | "pr" | "system";

const REGION_IDS: Record<LiveRegion, string> = {
  session: "sr-session",
  timer: "sr-timer",
  pr: "sr-pr",
  system: "sr-system",
};

export function announce(region: LiveRegion, message: string): void {
  if (typeof document === "undefined") return;
  const node = document.getElementById(REGION_IDS[region]);
  if (!node) return;
  // Stesso testo due volte di fila non verrebbe riletto: si svuota prima.
  if (node.textContent === message) node.textContent = "";
  node.textContent = message;
}

export { REGION_IDS };
