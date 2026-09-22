/**
 * Formati (§5.5, §11.4). Niente numeri o date scritti a mano: tutto passa da `Intl`,
 * locale `it-IT`, con l'unica eccezione documentata del volume totale.
 */

/** Spazio stretto non separabile: tiene insieme il numero e la sua unita'. */
const NNBSP = " ";
const NBSP = " ";

const kgFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const intFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const dayFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const dayYearFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const fullFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
});
const relFormat = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });

/** `82,5` */
export function formatKgValue(value: number): string {
  return kgFormat.format(value);
}

/** `82,5 kg`, con lo spazio che non manda l'unita' a capo. */
export function formatKg(value: number): string {
  return `${kgFormat.format(value)}${NNBSP}kg`;
}

/**
 * Volume totale: `4 280 kg`.
 *
 * Unica eccezione a `Intl`: `it-IT` raggrupperebbe le migliaia col punto (`4.280`), che
 * in un'app di pesi si confonde col decimale. Quindi niente raggruppamento automatico e
 * spazio stretto inserito a mano.
 */
export function formatVolume(value: number): string {
  const rounded = Math.round(value);
  const digits = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(rounded);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

export function formatVolumeKg(value: number): string {
  return `${formatVolume(value)}${NNBSP}kg`;
}

export function formatInt(value: number): string {
  return intFormat.format(value);
}

/** `8 serie`, `1 serie` */
export function formatSets(count: number): string {
  return `${count}${NBSP}${count === 1 ? "serie" : "serie"}`;
}

export function formatExerciseCount(count: number): string {
  return `${count}${NBSP}${count === 1 ? "esercizio" : "esercizi"}`;
}

/** `14 set` entro l'anno, `14 set 2025` fuori. */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? dayFormat : dayYearFormat).format(date);
}

export function formatFull(iso: string): string {
  return fullFormat.format(new Date(iso));
}

/**
 * Date relative fino a 7 giorni (`3 giorni fa`), poi assolute (`14 set`).
 * Va chiamata dopo il mount: dipende da `Date.now()` (§11.7).
 */
export function formatRelativeDay(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.round((startOfDay(then) - startOfDay(now)) / 86_400_000);
  if (Math.abs(days) <= 7) return relFormat.format(days, "day");
  return formatDay(iso);
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Accetta la virgola come separatore decimale (§4.18). */
export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseInteger(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Per gli `aria-label`: "80 chili per 8 ripetizioni". */
export function speakSet(weightKg: number | null, reps: number | null): string {
  if (weightKg == null && reps == null) return "nessun valore";
  const parts: string[] = [];
  if (weightKg != null) parts.push(`${formatKgValue(weightKg)} chili`);
  if (reps != null) parts.push(`${reps} ripetizioni`);
  return parts.join(" per ");
}
