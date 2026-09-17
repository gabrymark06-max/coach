// Memoria leggera della seduta di oggi (QA M1): /oggi/seduta la legge in modo sincrono al mount e chiede
// GET /sessions/{id} in parallelo a GET /today invece che dopo. Vale solo per il giorno in cui è stata scritta.
const KEY = "fitcoach.today.v1";

type Hint = { v: 1; session_id: string; date: string };

/** Data locale in formato YYYY-MM-DD, come `TodayOut.date` (contratto §4). */
export function localDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readTodayHint(now: Date = new Date()): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as Partial<Hint>;
    if (h.v !== 1 || typeof h.session_id !== "string" || h.date !== localDate(now)) return null;
    return h.session_id;
  } catch {
    return null;
  }
}

export function writeTodayHint(sessionId: string, date: string): void {
  if (typeof window === "undefined") return;
  try {
    const h: Hint = { v: 1, session_id: sessionId, date };
    window.localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // storage pieno o negato: si torna ai due round-trip, nessun errore per l'utente
  }
}

export function clearTodayHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
