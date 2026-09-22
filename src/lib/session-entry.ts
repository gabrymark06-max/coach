/**
 * "Si entra in sessione apposta, mai per sbaglio" (§6.1).
 *
 * `/sessione` e' esclusa dalle pagine riavviabili: ricaricando l'app con una sessione
 * attiva si deve atterrare su `/allenamento` con la `SessionBar` visibile, non dentro
 * la sessione. Questo flag vive nel modulo, quindi si azzera a ogni ricarica: se e'
 * falso, in sessione ci si e' arrivati da un indirizzo, non da un tocco.
 */
let intentional = false;

export function markSessionEntry(): void {
  intentional = true;
}

export function enteredSessionOnPurpose(): boolean {
  return intentional;
}

export function clearSessionEntry(): void {
  intentional = false;
}
