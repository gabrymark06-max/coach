/**
 * Gli errori che l'app non sa gestire: **detti all'utente, e tenuti nei log.**
 *
 * Il secondo audit del QA e' costato un dump di IndexedDB rigiocato fuori dal browser
 * per trovare un `TypeError`, perche' un `catch` lo inghiottiva e mostrava «non riesco
 * a scrivere su questo dispositivo». Due danni in una riga sola: l'utente conclude che
 * il telefono e' rotto, e chi sviluppa non ha niente da leggere.
 *
 * Qui ci sono le due meta' della risposta:
 *  - `describeError` — la frase per l'utente: che cosa e' successo e che cosa puo' fare.
 *    Incolpa il dispositivo **solo** quando e' davvero il dispositivo (spazio finito);
 *  - `logError` — la traccia per chi sviluppa, con il punto dell'app da cui viene.
 *    E' l'unico `console` dell'app, ed e' voluto: senza, i difetti restano invisibili.
 */

const QUOTA = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);
const DATABASE = new Set([
  "DatabaseClosedError",
  "InvalidStateError",
  "AbortError",
  "UnknownError",
  "VersionError",
  "BlockedError",
  "TransactionInactiveError",
]);

/** Il nome tecnico dell'errore, quando ce n'e' uno. */
function nameOf(error: unknown): string | null {
  if (error instanceof Error) return error.name || null;
  if (typeof error === "object" && error != null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" && name.length > 0 ? name : null;
  }
  return null;
}

export function describeError(error: unknown): string {
  const name = nameOf(error);

  if (name != null && QUOTA.has(name)) {
    return "Lo spazio di questo dispositivo è finito: esporta i dati da Impostazioni → Dati, libera spazio e riprova.";
  }

  if (name != null && DATABASE.has(name)) {
    return "Il database dell'app non risponde: chiudi le altre schede di Lifted, ricarica la pagina e riprova.";
  }

  return `È un difetto dell'app, non del tuo telefono (${name ?? "errore sconosciuto"}). Ricarica la pagina e riprova: i dati restano dove sono.`;
}

/** La traccia per chi sviluppa: resta nella console anche quando l'utente ha già capito. */
export function logError(scope: string, error: unknown): void {
  console.error(`[lifted] ${scope}`, error);
}
