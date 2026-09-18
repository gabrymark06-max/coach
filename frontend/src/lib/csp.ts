/** Content-Security-Policy del frontend (QA produzione, D4).
 *
 * L'app rende nel DOM testo scritto dall'utente e testo prodotto dall'LLM: la CSP è la seconda linea di difesa
 * dietro l'escaping di React, non la prima.
 *
 * Due scelte da dichiarare, perché non sono gratis:
 * - `'unsafe-inline'` su `script-src`. Next inietta gli script di bootstrap e il payload RSC come `<script>` inline.
 *   L'alternativa è un nonce per richiesta, che richiede un middleware su ogni rotta e rende dinamica ogni pagina:
 *   la landing (ISR) e `/prezzi` (Data Cache) perderebbero la cache che oggi le tiene in piedi mentre Render dorme.
 *   Il rischio che `'unsafe-inline'` lascia aperto è l'XSS riflesso; quello che chiude comunque è lo script di terza
 *   parte iniettato da un'origine esterna, che qui è lo scenario realistico.
 * - Nessun `'unsafe-eval'`: React in produzione non ne ha bisogno, e senza eval un payload che riesce a entrare nel
 *   DOM non diventa codice.
 *
 * `connect-src` è l'elenco chiuso delle origini con cui il browser può parlare: il sito e l'API.
 */

const SELF = "'self'";

function apiSource(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(apiUrl: string): string {
  const api = apiSource(apiUrl);
  const directives: string[] = [
    `default-src ${SELF}`,
    // vedi il commento in testa al file: inline sì, eval no
    `script-src ${SELF} 'unsafe-inline'`,
    `style-src ${SELF} 'unsafe-inline'`,
    `img-src ${SELF} data: blob:`,
    `font-src ${SELF}`,
    `connect-src ${[SELF, api].filter(Boolean).join(" ")}`,
    `worker-src ${SELF}`,
    `manifest-src ${SELF}`,
    "object-src 'none'",
    `base-uri ${SELF}`,
    `form-action ${SELF}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}
