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

/** `8 serie`, `1 serie` — invariabile, ma il posto giusto per chiederlo e' questo. */
export function formatSets(count: number): string {
  return `${count}${NBSP}serie`;
}

export function formatExerciseCount(count: number): string {
  return `${count}${NBSP}${count === 1 ? "esercizio" : "esercizi"}`;
}

/**
 * Gli accordi italiani, in un posto solo (QA MINORE 2).
 *
 * Erano scritti a mano a ogni punto d'uso — cioe' mai — e producevano «1 allenamenti»,
 * «1 serie completate», «su 1 settimane». Un'app in italiano che non sa dire *uno* si
 * qualifica da sola: sono le tre frasi che un utente nuovo incontra per prime.
 */
export function formatSessionCount(count: number): string {
  return `${formatInt(count)} ${count === 1 ? "allenamento" : "allenamenti"}`;
}

export function formatWeekCount(count: number): string {
  return `${formatInt(count)} ${count === 1 ? "settimana" : "settimane"}`;
}

export function formatMeasurementCount(count: number): string {
  return `${formatInt(count)} ${count === 1 ? "misurazione" : "misurazioni"}`;
}

export function formatRecordCount(count: number): string {
  return `${formatInt(count)} ${count === 1 ? "record" : "record"}`;
}

/**
 * `3 serie completate` / `1 serie completata`. «Serie» non cambia al plurale, il
 * participio si': il numero decide l'aggettivo, non il sostantivo.
 */
export function formatSetCount(
  count: number,
  participle: "completata" | "saltata" | "registrata",
): string {
  const plural = `${participle.slice(0, -1)}e`;
  return `${formatInt(count)} serie ${count === 1 ? participle : plural}`;
}

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/**
 * Durate **lunghe**, con la scala che rolla: `48 min` → `1 h 30 min` → `8 g 8 h`.
 *
 * `formatMinutes` (timer.ts) resta la forma giusta per la durata di una sessione, dove
 * i minuti sono l'unita' naturale. Sul totale di vita del profilo produceva
 * «12000 min», un numero che nessuno legge (QA MINORE 3). Mai tre unita' insieme: due
 * bastano sempre a dare la misura, la terza e' precisione che nessuno usa.
 */
export function formatDurationLong(ms: number): string {
  const total = Math.max(0, ms);

  if (total >= MS_DAY) {
    const days = Math.floor(total / MS_DAY);
    const hours = Math.round((total % MS_DAY) / MS_HOUR);
    // 23,7 ore arrotondate a 24 diventerebbero «8 g 24 h»
    if (hours === 24) return `${days + 1}${NNBSP}g`;
    return hours === 0 ? `${days}${NNBSP}g` : `${days}${NNBSP}g ${hours}${NNBSP}h`;
  }

  if (total >= MS_HOUR) {
    const hours = Math.floor(total / MS_HOUR);
    const minutes = Math.round((total % MS_HOUR) / MS_MIN);
    if (minutes === 60) return `${hours + 1}${NNBSP}h`;
    return minutes === 0
      ? `${hours}${NNBSP}h`
      : `${hours}${NNBSP}h ${minutes}${NNBSP}min`;
  }

  return `${Math.round(total / MS_MIN)}${NNBSP}min`;
}

/** `14 set` entro l'anno, `14 set 2025` fuori. */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? dayFormat : dayYearFormat).format(date);
}

/**
 * `giovedì 24 settembre` — la data come la dice la card «Oggi» (§4.24).
 *
 * Il giorno della settimana serve: «24 settembre» richiede un calendario per capire se
 * e' oggi, «giovedì 24 settembre» no. L'anno invece non serve mai su una card che parla
 * di oggi.
 */
const weekdayFormat = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatWeekdayDay(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

/**
 * `gio 24 set` — la data breve **con il giorno della settimana**.
 *
 * Serve dove una data sta accanto a dei numeri di allenamento: «24 set» da solo, in
 * un'app di pesi, si legge come ventiquattro serie. Tre lettere di giorno tolgono
 * l'ambiguita' senza rubare spazio.
 */
const shortWeekdayFormat = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatShortWeekdayDay(iso: string): string {
  return shortWeekdayFormat.format(new Date(iso));
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
