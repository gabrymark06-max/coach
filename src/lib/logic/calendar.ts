/**
 * La griglia di un mese — la parte del calendario (§4.27) che non ha bisogno del DOM,
 * e che quindi si puo' provare senza un browser.
 *
 * Settimana che comincia di **lunedi'**: e' la convenzione italiana, ed e' quella del
 * riferimento. Ogni griglia ha sempre 6 righe da 7 celle, anche quando il mese ne
 * riempirebbe 5: cosi' il calendario non cambia altezza passando da un mese all'altro,
 * e non c'e' un salto di layout a ogni freccia.
 */

export interface MonthKey {
  year: number;
  /** 1-based, come lo scrive un essere umano */
  month: number;
}

export interface CalendarCell {
  /** `2026-09-12` */
  day: string;
  dayOfMonth: number;
  /** falso per le code del mese precedente e del successivo */
  inMonth: boolean;
}

const ROWS = 6;
const COLS = 7;

/** `2026-09` — la forma che sta nella query string (§11.5). */
export function formatMonthKey({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Legge `?mese=2026-09`; qualunque cosa non torni ricade sul mese passato come base. */
export function parseMonthKey(raw: string | null, fallback: MonthKey): MonthKey {
  if (!raw) return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1970 || year > 3000 || month < 1 || month > 12) return fallback;
  return { year, month };
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const date = new Date(key.year, key.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthOf(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateOfDayKey(day: string): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, month - 1, dayOfMonth);
}

/** 42 celle: sei settimane piene, dal lunedi' che contiene il primo del mese. */
export function monthGrid(key: MonthKey): CalendarCell[] {
  const first = new Date(key.year, key.month - 1, 1);
  // getDay(): 0 = domenica. Con la settimana che parte di lunedi', domenica vale 6.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(key.year, key.month - 1, 1 - offset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < ROWS * COLS; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      day: dayKey(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === key.month - 1 && date.getFullYear() === key.year,
    });
  }
  return cells;
}

/** `settembre 2026` — minuscolo come vuole l'italiano, e come lo scrive `Intl`. */
const MONTH_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

export function monthLabel(key: MonthKey): string {
  return MONTH_FORMAT.format(new Date(key.year, key.month - 1, 1));
}

/** `12 settembre 2026`, per l'etichetta parlata della cella. */
const DAY_FORMAT = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function dayLabel(day: string): string {
  return DAY_FORMAT.format(dateOfDayKey(day));
}

/** Iniziale e nome per esteso dei sette giorni, da lunedi'. */
export const WEEKDAYS: { short: string; long: string }[] = [
  { short: "L", long: "lunedì" },
  { short: "M", long: "martedì" },
  { short: "M", long: "mercoledì" },
  { short: "G", long: "giovedì" },
  { short: "V", long: "venerdì" },
  { short: "S", long: "sabato" },
  { short: "D", long: "domenica" },
];

export type CalendarMove =
  | "prev-day"
  | "next-day"
  | "prev-week"
  | "next-week"
  | "week-start"
  | "week-end"
  | "prev-month"
  | "next-month";

/**
 * Dove va il fuoco premendo un tasto. Restituisce **sempre** un giorno, anche fuori dal
 * mese in vista: uscire dal mese con le frecce lo cambia, e chi chiama se ne accorge
 * confrontando il mese del risultato con quello di partenza (§4.27).
 */
export function moveFocus(day: string, move: CalendarMove): string {
  const date = dateOfDayKey(day);
  const shift = (days: number) =>
    dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));

  switch (move) {
    case "prev-day":
      return shift(-1);
    case "next-day":
      return shift(1);
    case "prev-week":
      return shift(-7);
    case "next-week":
      return shift(7);
    case "week-start":
      return shift(-((date.getDay() + 6) % 7));
    case "week-end":
      return shift(6 - ((date.getDay() + 6) % 7));
    case "prev-month":
    case "next-month": {
      const delta = move === "prev-month" ? -1 : 1;
      const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
      // 31 gennaio + 1 mese non e' il 3 marzo: si tronca all'ultimo giorno utile.
      const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      return dayKey(
        new Date(
          target.getFullYear(),
          target.getMonth(),
          Math.min(date.getDate(), lastDay),
        ),
      );
    }
  }
}

/**
 * La cella che entra nel tab order quando si apre un mese (roving tabindex): oggi se e'
 * in vista, altrimenti il primo giorno allenato, altrimenti il giorno 1.
 */
export function initialFocusDay(
  key: MonthKey,
  trainedDays: readonly string[],
  today: Date,
): string {
  if (monthOf(today).year === key.year && monthOf(today).month === key.month) {
    return dayKey(today);
  }
  const first = [...trainedDays].sort()[0];
  if (first) return first;
  return dayKey(new Date(key.year, key.month - 1, 1));
}
