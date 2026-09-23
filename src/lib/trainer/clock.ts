import type { ISODate } from "@/lib/db/schema";
import type { TrainerDay, TrainerProgram, TrainerWeek } from "@/lib/db/trainer-schema";

/**
 * Dove sta il programma **oggi**, e che cosa deve mostrare la dashboard.
 *
 * Funzioni pure sul programma e su un istante: e' cosi' che gli otto stati di §4.24 si
 * provano senza aspettare mercoledi'.
 *
 * La regola che governa tutto: **il programma non scavalca da solo una settimana
 * vuota.** Se una settimana e' passata senza un allenamento, l'orologio si ferma li' e
 * aspetta che l'utente scelga fra ripeterla, andare avanti o rigenerare (§4.24). Un
 * programma che avanza da solo mentre l'utente e' in vacanza gli propone, al ritorno,
 * carichi che non ha mai sollevato.
 */

export interface ProgramClock {
  /** la settimana in cui il programma sta davvero */
  derivedWeek: number;
  /** le settimane passate senza nemmeno un allenamento, in ordine */
  skippedWeeks: number[];
  /** il programma e' fermo e aspetta una scelta */
  awaitingChoice: boolean;
  /** tutte le settimane sono passate */
  finished: boolean;
}

export function programClock(program: TrainerProgram, now: ISODate): ProgramClock {
  const today = startOfDay(now);
  const skipped: number[] = [];
  let week = Math.max(1, program.currentWeek);
  let awaiting = false;

  while (week <= program.weeksTotal) {
    const end = weekEnd(program, week);
    if (today < end) break; // la settimana e' ancora in corso
    if (performedIn(program, week) > 0) {
      week += 1;
      continue;
    }
    // settimana passata a vuoto: si ferma qui e aspetta
    awaiting = true;
    break;
  }

  if (awaiting) {
    // la rincorsa all'indietro: quante settimane vuote di fila arrivano fin qui
    for (let index = week; index >= 1; index -= 1) {
      if (performedIn(program, index) > 0) break;
      if (today < weekEnd(program, index)) break;
      skipped.unshift(index);
    }
  }

  return {
    derivedWeek: Math.min(week, program.weeksTotal),
    skippedWeeks: skipped,
    awaitingChoice: awaiting,
    finished: week > program.weeksTotal,
  };
}

export type TodayFocus =
  | { kind: "pausa" }
  | { kind: "finito" }
  | { kind: "allenamento"; week: TrainerWeek; day: TrainerDay }
  | { kind: "fatto"; week: TrainerWeek; day: TrainerDay }
  | {
      kind: "riposo";
      next: { week: TrainerWeek; day: TrainerDay } | null;
    };

/**
 * Che cosa mette in cima la dashboard. Un dispatcher, esattamente come §4.24 lo
 * descrive: «non e' mai una pagina che non sa cosa dire».
 */
export function todayFocus(program: TrainerProgram, now: ISODate): TodayFocus {
  if (program.status === "paused") return { kind: "pausa" };
  if (program.status === "completed") return { kind: "finito" };

  const clock = programClock(program, now);
  if (clock.finished) return { kind: "finito" };

  const key = dayKey(now);
  const week = program.weeks.find((item) => item.index === clock.derivedWeek);

  const here = week?.days.find((day) => day.plannedFor && dayKey(day.plannedFor) === key);
  if (here) {
    return here.status === "completata"
      ? { kind: "fatto", week: week!, day: here }
      : { kind: "allenamento", week: week!, day: here };
  }

  return { kind: "riposo", next: nextPlanned(program, now, clock.derivedWeek) };
}

/** Il prossimo giorno ancora da fare, dalla settimana corrente in poi. */
export function nextPlanned(
  program: TrainerProgram,
  now: ISODate,
  fromWeek = 1,
): { week: TrainerWeek; day: TrainerDay } | null {
  const key = dayKey(now);
  for (const week of program.weeks) {
    if (week.index < fromWeek) continue;
    for (const day of week.days) {
      if (day.status !== "prevista") continue;
      if (day.plannedFor && dayKey(day.plannedFor) < key) continue;
      return { week, day };
    }
  }
  /*
    Nessun giorno futuro: se l'utente e' in ritardo, il «prossimo» e' il primo ancora
    aperto, anche se la sua data e' passata. Dire «non c'e' un prossimo allenamento» a
    chi ha saltato due giorni sarebbe falso.
  */
  for (const week of program.weeks) {
    if (week.index < fromWeek) continue;
    for (const day of week.days) {
      if (day.status === "prevista") return { week, day };
    }
  }
  return null;
}

/** I prossimi N allenamenti con la loro data: la card di riepilogo della colonna destra. */
export function upcoming(
  program: TrainerProgram,
  now: ISODate,
  count = 3,
): { week: TrainerWeek; day: TrainerDay }[] {
  const key = dayKey(now);
  const out: { week: TrainerWeek; day: TrainerDay }[] = [];
  for (const week of program.weeks) {
    for (const day of week.days) {
      if (day.status !== "prevista") continue;
      if (day.plannedFor && dayKey(day.plannedFor) < key) continue;
      out.push({ week, day });
      if (out.length === count) return out;
    }
  }
  return out;
}

export interface ProgramProgress {
  daysDone: number;
  /** i giorni la cui data e' gia' passata: il denominatore onesto dell'aderenza */
  daysDue: number;
  daysTotal: number;
  setsDone: number;
  setsPlannedTotal: number;
  /** 0-100 */
  adherence: number;
}

/**
 * I numeri del riepilogo. L'aderenza si misura sui giorni **gia' passati**, non su
 * tutto il ciclo: al terzo giorno di otto settimane, «4%» non e' un'informazione, e'
 * uno scoraggiamento.
 */
export function programProgress(program: TrainerProgram, now: ISODate): ProgramProgress {
  const key = dayKey(now);
  let daysDone = 0;
  let daysDue = 0;
  let daysTotal = 0;
  let setsDone = 0;
  let setsPlannedTotal = 0;

  for (const week of program.weeks) {
    for (const day of week.days) {
      daysTotal += 1;
      const sets = day.exercises.reduce((n, exercise) => n + exercise.sets, 0);
      setsPlannedTotal += sets;
      if (day.status === "completata") {
        daysDone += 1;
        setsDone += sets;
      }
      if (day.plannedFor && dayKey(day.plannedFor) <= key) daysDue += 1;
    }
  }

  const denominator = Math.max(daysDue, daysDone, 1);
  return {
    daysDone,
    daysDue,
    daysTotal,
    setsDone,
    setsPlannedTotal,
    adherence: Math.round((daysDone / denominator) * 100),
  };
}

/** Quanti giorni di quella settimana sono stati chiusi davvero. */
export function performedIn(program: TrainerProgram, weekIndex: number): number {
  const week = program.weeks.find((item) => item.index === weekIndex);
  if (!week) return 0;
  return week.days.filter((day) => day.status === "completata").length;
}

/** L'istante in cui la settimana `index` finisce (mezzanotte del suo ottavo giorno). */
export function weekEnd(program: TrainerProgram, index: number): Date {
  const start = startOfDay(program.startedAt);
  start.setDate(start.getDate() + index * 7);
  return start;
}

export function weekStart(program: TrainerProgram, index: number): Date {
  const start = startOfDay(program.startedAt);
  start.setDate(start.getDate() + (index - 1) * 7);
  return start;
}

/** Lo stato mostrato di una settimana, derivato: non si duplica in una colonna. */
export function weekState(
  program: TrainerProgram,
  week: TrainerWeek,
  clock: ProgramClock,
): "completata" | "in-corso" | "saltata" | "futura" | "ripetuta" {
  if (week.status === "ripetuta") return "ripetuta";
  const done = performedIn(program, week.index);
  if (done === week.days.length) return "completata";
  if (week.index === clock.derivedWeek && !clock.finished) {
    return clock.skippedWeeks.includes(week.index) ? "saltata" : "in-corso";
  }
  if (week.index < clock.derivedWeek) return done > 0 ? "completata" : "saltata";
  return "futura";
}

function startOfDay(iso: ISODate | Date): Date {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** `2026-09-21` in ora locale: i giorni sono giorni, non istanti UTC. */
export function dayKey(iso: ISODate): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
