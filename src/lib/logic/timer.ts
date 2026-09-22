/**
 * Cronometro e timer di recupero.
 *
 * Regola che tiene tutto (design §6.6, §10.5): **il tempo si ricalcola da `Date.now()`
 * confrontato con un timestamp salvato, mai da un contatore che si incrementa.**
 * Un `setInterval` serve solo a ridisegnare. Se la scheda va in background, se il
 * telefono si blocca, se l'app viene chiusa e riaperta, il numero resta giusto.
 */

/** Ultimi secondi in cui la pill passa in allarme (§4.4). */
export const REST_WARNING_MS = 10_000;

export interface RestTimerSnapshot {
  startedAt: string | null | undefined;
  durationSec: number | null | undefined;
  pausedAt: string | null | undefined;
  /** millisecondi di pausa gia' consumati e ripresi */
  pausedMs: number;
}

export type RestPhase = "idle" | "running" | "warning" | "paused" | "expired";

/** Millisecondi che mancano alla fine del recupero. `null` se non c'e' un timer. */
export function restRemainingMs(
  snapshot: RestTimerSnapshot,
  now: number,
): number | null {
  const { startedAt, durationSec } = snapshot;
  if (!startedAt || durationSec == null || durationSec <= 0) return null;

  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;

  const reference = snapshot.pausedAt ? Date.parse(snapshot.pausedAt) : now;
  const consumed = reference - start - (snapshot.pausedMs ?? 0);
  const remaining = durationSec * 1000 - consumed;
  return Math.max(0, remaining);
}

export function restPhase(snapshot: RestTimerSnapshot, now: number): RestPhase {
  const remaining = restRemainingMs(snapshot, now);
  if (remaining === null) return "idle";
  if (remaining <= 0) return "expired";
  if (snapshot.pausedAt) return "paused";
  if (remaining <= REST_WARNING_MS) return "warning";
  return "running";
}

export interface SessionClock {
  startedAt: string;
  pausedMs: number;
  pausedAt?: string | null;
  endedAt?: string | null;
}

/** Durata effettiva della sessione, al netto delle pause. */
export function elapsedSessionMs(clock: SessionClock, now: number): number {
  const start = Date.parse(clock.startedAt);
  if (Number.isNaN(start)) return 0;

  let reference = now;
  if (clock.endedAt) reference = Date.parse(clock.endedAt);
  else if (clock.pausedAt) reference = Date.parse(clock.pausedAt);

  return Math.max(0, reference - start - (clock.pausedMs ?? 0));
}

/** Cronometro di sessione: `0:48:12` (§5.5). */
export function formatStopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/** Conto alla rovescia: `1:28`. Arrotonda per eccesso, cosi' `0:00` significa finito. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** Sintesi: `48 min`, con spazio non separabile (§11.3). */
export function formatMinutes(ms: number): string {
  return `${Math.round(Math.max(0, ms) / 60_000)} min`;
}

/** Testo per gli annunci `aria-live` del timer (§8.5). */
export function speakDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(minutes === 1 ? "1 minuto" : `${minutes} minuti`);
  if (seconds > 0) parts.push(seconds === 1 ? "1 secondo" : `${seconds} secondi`);
  if (parts.length === 0) return "0 secondi";
  return parts.join(" e ");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
