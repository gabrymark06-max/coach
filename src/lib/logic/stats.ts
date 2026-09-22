import type { ID, ISODate, MuscleGroup, Session } from "@/lib/db/schema";
import { estimate1RM, type E1rmFormula } from "./e1rm";

/**
 * Aggregazioni per la tab Statistiche (spec §3.5) e per il riepilogo personale.
 *
 * Tutto quello che sta qui e' **puro**: prende sessioni gia' lette e restituisce numeri.
 * Nessun accesso a Dexie, nessun `Intl` — le etichette le compone chi renderizza, con il
 * locale del documento (§11.4).
 *
 * Le settimane sono ISO-8601 (lunedi'–domenica, la settimana 1 contiene il 4 gennaio) e
 * si calcolano sulla **data locale**: un allenamento delle 23:30 appartiene al giorno che
 * l'utente ha vissuto, non a quello UTC.
 */

const DAY_MS = 86_400_000;

export type Period = "week" | "month";

function atMidnight(iso: string): Date {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Lunedi' della settimana che contiene questa data locale. */
function mondayOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

export function isoWeekKey(iso: string): string {
  const day = atMidnight(iso);
  const thursday = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() - ((day.getDay() + 6) % 7) + 3,
  );
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const firstMonday = mondayOf(jan4);
  const week =
    Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * DAY_MS)) + 1;
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(iso: string): string {
  const day = atMidnight(iso);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
}

function periodStart(iso: string, period: Period): Date {
  const day = atMidnight(iso);
  return period === "week"
    ? mondayOf(day)
    : new Date(day.getFullYear(), day.getMonth(), 1);
}

function nextPeriod(date: Date, period: Period): Date {
  return period === "week"
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
    : new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function keyOf(date: Date, period: Period): string {
  const iso = date.toISOString();
  return period === "week" ? isoWeekKey(iso) : monthKey(iso);
}

export interface PeriodBucket {
  key: string;
  /** inizio del periodo, come data locale in ISO */
  start: ISODate;
  volumeKg: number;
  sets: number;
  sessions: number;
  durationSec: number;
}

/**
 * Volume, serie e allenamenti per settimana o per mese.
 *
 * I periodi senza allenamenti **compaiono a zero**: una linea che salta da una settimana
 * all'altra racconta una costanza che non c'e' stata.
 */
export function aggregateByPeriod(
  sessions: readonly Session[],
  period: Period,
): PeriodBucket[] {
  const completed = sessions.filter((item) => item.status === "completed");
  if (completed.length === 0) return [];

  const byKey = new Map<string, PeriodBucket>();
  let min: Date | null = null;
  let max: Date | null = null;

  for (const session of completed) {
    const start = periodStart(session.startedAt, period);
    if (!min || start < min) min = start;
    if (!max || start > max) max = start;

    const key = keyOf(start, period);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        key,
        start: start.toISOString(),
        volumeKg: 0,
        sets: 0,
        sessions: 0,
        durationSec: 0,
      };
      byKey.set(key, bucket);
    }
    bucket.volumeKg += session.totalVolumeKg;
    bucket.sets += session.totalSets;
    bucket.sessions += 1;
    bucket.durationSec += session.durationSec;
  }

  const buckets: PeriodBucket[] = [];
  for (let cursor = min!; cursor <= max!; cursor = nextPeriod(cursor, period)) {
    const key = keyOf(cursor, period);
    const bucket = byKey.get(key);
    buckets.push(
      bucket ?? {
        key,
        start: cursor.toISOString(),
        volumeKg: 0,
        sets: 0,
        sessions: 0,
        durationSec: 0,
      },
    );
  }

  return buckets.map((bucket) => ({
    ...bucket,
    volumeKg: Math.round(bucket.volumeKg * 100) / 100,
  }));
}

export interface MuscleVolumeRow {
  muscleGroup: MuscleGroup;
  volumeKg: number;
  share: number;
}

export interface MuscleLookupEntry {
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
}

/**
 * Distribuzione del volume per gruppo muscolare (spec §3.5).
 *
 * Il volume di un esercizio non finisce tutto sul muscolo principale, altrimenti la
 * panca non allenerebbe mai i tricipiti. La ripartizione: **peso 1 al principale, 0,5 a
 * ciascun secondario**, normalizzata sul totale dei pesi. Un esercizio che non esiste
 * piu' in libreria resta fuori: meglio un grafico incompleto che uno sbagliato.
 */
export function volumeByMuscleGroup(
  sessions: readonly Session[],
  lookup: ReadonlyMap<ID, MuscleLookupEntry>,
): MuscleVolumeRow[] {
  const byMuscle = new Map<MuscleGroup, number>();

  for (const session of sessions) {
    if (session.status !== "completed") continue;
    for (const exercise of session.exercises) {
      const entry = lookup.get(exercise.exerciseId);
      if (!entry) continue;

      let volume = 0;
      for (const set of exercise.sets) {
        if (!set.completed) continue;
        const weight = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        if (weight > 0 && reps > 0) volume += weight * reps;
      }
      if (volume <= 0) continue;

      const secondaries = entry.secondaryMuscles.filter(
        (muscle) => muscle !== entry.muscleGroup,
      );
      const totalWeight = 1 + 0.5 * secondaries.length;
      byMuscle.set(
        entry.muscleGroup,
        (byMuscle.get(entry.muscleGroup) ?? 0) + (volume * 1) / totalWeight,
      );
      for (const muscle of secondaries) {
        byMuscle.set(
          muscle,
          (byMuscle.get(muscle) ?? 0) + (volume * 0.5) / totalWeight,
        );
      }
    }
  }

  const total = [...byMuscle.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  return [...byMuscle.entries()]
    .map(([muscleGroup, volume]) => ({
      muscleGroup,
      volumeKg: Math.round(volume * 100) / 100,
      share: volume / total,
    }))
    .toSorted((a, b) => b.volumeKg - a.volumeKg);
}

export interface E1rmPoint {
  date: ISODate;
  value: number;
  weightKg: number;
  reps: number;
}

/** Andamento del 1RM stimato: un punto per sessione, la serie migliore di quel giorno. */
export function e1rmSeries(
  sessions: readonly Session[],
  exerciseId: ID,
  formula: E1rmFormula,
): E1rmPoint[] {
  const points: E1rmPoint[] = [];

  for (const session of sessions) {
    if (session.status !== "completed") continue;
    let best: E1rmPoint | null = null;

    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!set.completed || set.type === "warmup") continue;
        const value = estimate1RM(set.weightKg, set.reps, formula);
        if (value === null) continue;
        if (!best || value > best.value) {
          best = {
            date: session.startedAt,
            value,
            weightKg: set.weightKg as number,
            reps: set.reps as number,
          };
        }
      }
    }

    if (best) points.push(best);
  }

  return points.toSorted((a, b) => a.date.localeCompare(b.date));
}

export interface PersonalTotals {
  sessions: number;
  volumeKg: number;
  sets: number;
  durationSec: number;
  firstAt: ISODate | null;
  lastAt: ISODate | null;
  weeksTracked: number;
  sessionsPerWeek: number;
}

/** Riepilogo personale della tab Profilo: quanto, da quanto, ogni quanto. */
export function personalTotals(
  sessions: readonly Session[],
  now = Date.now(),
): PersonalTotals {
  const completed = sessions.filter((item) => item.status === "completed");
  if (completed.length === 0) {
    return {
      sessions: 0,
      volumeKg: 0,
      sets: 0,
      durationSec: 0,
      firstAt: null,
      lastAt: null,
      weeksTracked: 0,
      sessionsPerWeek: 0,
    };
  }

  let volumeKg = 0;
  let sets = 0;
  let durationSec = 0;
  let firstAt = completed[0].startedAt;
  let lastAt = completed[0].startedAt;

  for (const session of completed) {
    volumeKg += session.totalVolumeKg;
    sets += session.totalSets;
    durationSec += session.durationSec;
    if (session.startedAt < firstAt) firstAt = session.startedAt;
    if (session.startedAt > lastAt) lastAt = session.startedAt;
  }

  const from = mondayOf(atMidnight(firstAt)).getTime();
  const to = mondayOf(atMidnight(new Date(now).toISOString())).getTime();
  const weeksTracked = Math.max(1, Math.round((to - from) / (7 * DAY_MS)) + 1);

  return {
    sessions: completed.length,
    volumeKg: Math.round(volumeKg * 100) / 100,
    sets,
    durationSec,
    firstAt,
    lastAt,
    weeksTracked,
    sessionsPerWeek: completed.length / weeksTracked,
  };
}
