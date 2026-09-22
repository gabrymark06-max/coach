/**
 * "Si entra in sessione apposta, mai per sbaglio" (§6.1).
 *
 * `/sessione` e' esclusa dalle pagine riavviabili: ricaricando l'app con una sessione
 * attiva si deve atterrare su `/allenamento` con la `SessionBar` visibile, non dentro
 * la sessione.
 *
 * Il flag **non puo' vivere solo nel modulo**. Offline il service worker serve la
 * scocca e il router di Next, non potendo caricare il payload RSC, trasforma la
 * navigazione in un caricamento di pagina: il modulo riparte da zero e il tocco
 * dell'utente andrebbe perso, sbattendolo fuori dalla sessione che ha appena aperto.
 *
 * Quindi il marcatore e' un **istante** in `sessionStorage`, valido per pochi secondi:
 * abbastanza da attraversare una navigazione dura, troppo poco da sopravvivere a una
 * ricarica fatta dieci minuti dopo. Viene consumato alla prima lettura.
 */

const CHIAVE = "lifted:ingresso-sessione";
const VALIDITA_MS = 15_000;

let intentional = 0;

export function markSessionEntry(): void {
  intentional = Date.now();
  try {
    sessionStorage.setItem(CHIAVE, String(intentional));
  } catch {
    // navigazione privata con storage bloccato: resta il flag di modulo, che copre
    // la navigazione client normale
  }
}

/**
 * Una **ricarica** non e' mai un ingresso voluto, nemmeno se il marcatore e' fresco:
 * `performance` distingue il tipo di navigazione, e `reload` e' l'unico caso in cui
 * l'utente ha premuto aggiorna invece di toccare `AVVIA`.
 */
function eUnaRicarica(): boolean {
  if (typeof performance === "undefined") return false;
  const voce = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return voce?.type === "reload";
}

export function enteredSessionOnPurpose(now = Date.now()): boolean {
  if (intentional > 0 && now - intentional < VALIDITA_MS) {
    clearSessionEntry();
    return true;
  }
  if (eUnaRicarica()) {
    clearSessionEntry();
    return false;
  }
  let marcatore = 0;
  try {
    marcatore = Number(sessionStorage.getItem(CHIAVE)) || 0;
  } catch {
    marcatore = 0;
  }
  const valido = marcatore > 0 && now - marcatore < VALIDITA_MS;
  if (valido) clearSessionEntry();
  return valido;
}

export function clearSessionEntry(): void {
  intentional = 0;
  try {
    sessionStorage.removeItem(CHIAVE);
  } catch {
    // niente da pulire
  }
}
