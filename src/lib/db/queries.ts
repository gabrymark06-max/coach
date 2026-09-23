import {
  accumulateSession,
  EMPTY_AGGREGATE,
  type SessionAggregate,
} from "@/lib/logic/stats";
import type { LiftedDB } from "./db";
import { exerciseKey, normalizeName } from "./schema";
import type {
  Equipment,
  Exercise,
  ID,
  ISODate,
  MuscleGroup,
  Routine,
  Session,
  Settings,
} from "./schema";

export interface ExerciseFilter {
  q?: string;
  muscleGroup?: MuscleGroup | null;
  equipment?: Equipment | null;
}

/**
 * Libreria filtrata. Il filtro per muscolo+attrezzo usa l'indice composto; la ricerca
 * testuale e' in memoria perche' IndexedDB non fa "contiene" e la libreria e' di
 * qualche centinaio di voci, non di milioni.
 */
export async function listExercises(
  db: LiftedDB,
  filter: ExerciseFilter = {},
): Promise<Exercise[]> {
  const { q, muscleGroup, equipment } = filter;

  let rows: Exercise[];
  if (muscleGroup && equipment) {
    rows = await db.exercises
      .where("[muscleGroup+equipment]")
      .equals([muscleGroup, equipment])
      .toArray();
  } else if (muscleGroup) {
    rows = await db.exercises.where("muscleGroup").equals(muscleGroup).toArray();
  } else if (equipment) {
    rows = await db.exercises.where("equipment").equals(equipment).toArray();
  } else {
    rows = await db.exercises.toArray();
  }

  const needle = normalizeName(q ?? "");
  const filtered =
    needle === "" ? rows : rows.filter((row) => row.nameKey.includes(needle));

  return filtered.sort((a, b) => a.nameKey.localeCompare(b.nameKey, "it-IT"));
}

export function getExercise(db: LiftedDB, id: ID): Promise<Exercise | undefined> {
  return db.exercises.get(id);
}

/**
 * «Esiste gia' un esercizio con questo nome?» — la risposta dipende **anche
 * dall'attrezzo** (§9.4): `Panca piana (Bilanciere)` e `Panca piana (Manubri)` sono due
 * esercizi, e impedire il secondo perche' esiste il primo sarebbe un falso allarme.
 */
export async function findExerciseByName(
  db: LiftedDB,
  name: string,
  equipment: Equipment,
): Promise<Exercise | undefined> {
  return db.exercises.where("nameKey").equals(exerciseKey(name, equipment)).first();
}

export async function listRoutines(db: LiftedDB): Promise<Routine[]> {
  return db.routines.orderBy("order").toArray();
}

export function getRoutine(db: LiftedDB, id: ID): Promise<Routine | undefined> {
  return db.routines.get(id);
}

/** La sessione attiva e' al massimo una (§9.3): questa e' la lettura canonica. */
export async function getActiveSession(db: LiftedDB): Promise<Session | undefined> {
  return db.sessions.where("status").equals("active").first();
}

export function getSession(db: LiftedDB, id: ID): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function listCompletedSessions(
  db: LiftedDB,
  limit = 50,
): Promise<Session[]> {
  return db.sessions
    .where("[status+startedAt]")
    .between(["completed", ""], ["completed", "￿"])
    .reverse()
    .limit(limit)
    .toArray();
}

/** Quante sessioni completate ci sono in tutto: serve a dire «200 di 214». */
export async function countCompletedSessions(db: LiftedDB): Promise<number> {
  return db.sessions
    .where("[status+startedAt]")
    .between(["completed", ""], ["completed", "￿"])
    .count();
}

/**
 * I totali di sempre — **tutte** le sessioni completate, non la lista troncata
 * (QA GRAVE 3).
 *
 * Si scorre con `each` invece di `toArray`: a 2 000 allenamenti l'array intero sarebbe
 * decine di MB di serie annidate per produrre sei numeri. Qui ne resta in memoria una
 * alla volta.
 */
export async function aggregateCompletedSessions(
  db: LiftedDB,
): Promise<SessionAggregate> {
  const aggregate: SessionAggregate = { ...EMPTY_AGGREGATE };
  await db.sessions
    .where("[status+startedAt]")
    .between(["completed", ""], ["completed", "￿"])
    .each((session) => accumulateSession(aggregate, session));
  return aggregate;
}

export interface CalendarDay {
  /** giorno locale, `2026-09-12` */
  day: string;
  sessions: { id: ID; name: string; startedAt: ISODate }[];
}

/**
 * Le sessioni completate di un mese, raggruppate per **giorno locale**.
 *
 * Passa dall'indice `[status+startedAt]` con un intervallo chiuso sui due estremi del
 * mese: disegnare settembre non deve costare la scansione di tre anni di storico.
 * Gli estremi si costruiscono in ora locale e si confrontano in UTC, altrimenti a
 * cavallo di mezzanotte il primo e l'ultimo giorno finirebbero nel mese sbagliato.
 */
export async function calendarMonth(
  db: LiftedDB,
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
  const to = new Date(year, month, 1, 0, 0, 0, 0).toISOString();

  const rows = await db.sessions
    .where("[status+startedAt]")
    .between(["completed", from], ["completed", to], true, false)
    .toArray();

  const byDay = new Map<string, CalendarDay>();
  for (const session of rows) {
    const day = localDayKey(session.startedAt);
    let entry = byDay.get(day);
    if (!entry) {
      entry = { day, sessions: [] };
      byDay.set(day, entry);
    }
    entry.sessions.push({
      id: session.id,
      name: session.routineName ?? "Sessione libera",
      startedAt: session.startedAt,
    });
  }

  for (const entry of byDay.values()) {
    entry.sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Il mese piu' recente che ha almeno un allenamento, `null` se non ce n'e' nessuno.
 * Serve al calendario per proporre «Vai a agosto (8 allenamenti)» invece di lasciare
 * l'utente a cliccare la freccia al buio.
 */
export async function latestMonthWithSessions(
  db: LiftedDB,
  before: { year: number; month: number },
): Promise<{ year: number; month: number; count: number } | null> {
  const to = new Date(before.year, before.month - 1, 1, 0, 0, 0, 0).toISOString();
  const last = await db.sessions
    .where("[status+startedAt]")
    .between(["completed", ""], ["completed", to], true, false)
    .last();
  if (!last) return null;

  const date = new Date(last.startedAt);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const days = await calendarMonth(db, year, month);
  const count = days.reduce((sum, day) => sum + day.sessions.length, 0);
  return { year, month, count };
}

/** `2026-09-12` in ora **locale**: il calendario mostra i giorni di chi si allena. */
export function localDayKey(iso: ISODate): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function getSettings(db: LiftedDB): Promise<Settings | undefined> {
  return db.settings.get("singleton");
}

export interface PreviousSet {
  weightKg: number | null;
  reps: number | null;
}

/**
 * Le serie della **volta scorsa** per un esercizio, in ordine.
 *
 * Passa dall'indice multiEntry `*exerciseIds`: senza, servirebbe scorrere tutto lo
 * storico a ogni avvio di sessione. I valori tornati finiscono scritti sulle nuove
 * `SetEntry` (§9.3) — la colonna PRECEDENTE non deve mai dipendere da una query.
 */
export async function previousSetsFor(
  db: LiftedDB,
  exerciseId: ID,
): Promise<PreviousSet[]> {
  const candidates = await db.sessions
    .where("exerciseIds")
    .equals(exerciseId)
    .filter((session) => session.status === "completed")
    .toArray();

  if (candidates.length === 0) return [];

  let latest = candidates[0];
  for (const session of candidates) {
    if (session.startedAt > latest.startedAt) latest = session;
  }

  const exercise = latest.exercises.find((item) => item.exerciseId === exerciseId);
  if (!exercise) return [];

  return exercise.sets
    .filter((set) => set.completed)
    .map((set) => ({ weightKg: set.weightKg, reps: set.reps }));
}

/** Tutte le serie completate di un esercizio, con la data della sessione. */
export async function completedSetsHistory(db: LiftedDB, exerciseId: ID) {
  const sessions = await db.sessions
    .where("exerciseIds")
    .equals(exerciseId)
    .filter((session) => session.status === "completed")
    .toArray();

  const rows = sessions.flatMap((session) =>
    session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) =>
        exercise.sets
          .filter((set) => set.completed)
          .map((set) => ({
            sessionId: session.id,
            date: session.startedAt,
            weightKg: set.weightKg,
            reps: set.reps,
            type: set.type,
          })),
      ),
  );

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export interface LibraryCounts {
  total: number;
  custom: number;
}

export async function countLibrary(db: LiftedDB): Promise<LibraryCounts> {
  const rows = await db.exercises.toArray();
  return {
    total: rows.length,
    custom: rows.reduce((n, row) => (row.isCustom ? n + 1 : n), 0),
  };
}
