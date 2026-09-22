import type { LiftedDB } from "./db";
import { normalizeName } from "./schema";
import type {
  Equipment,
  Exercise,
  ID,
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

export async function findExerciseByName(
  db: LiftedDB,
  name: string,
): Promise<Exercise | undefined> {
  return db.exercises.where("nameKey").equals(normalizeName(name)).first();
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
