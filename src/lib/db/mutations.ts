import { elapsedSessionMs } from "@/lib/logic/timer";
import { newId, nowIso, type LiftedDB } from "./db";
import { computeSessionPRs, rebuildPersonalRecords } from "./pr-ops";
import { previousSetsFor } from "./queries";
import {
  DEFAULT_SETTINGS,
  EQUIPMENT_LOAD_MODE,
  exerciseKey,
  type Equipment,
  type Exercise,
  type ID,
  type MuscleGroup,
  type PersonalRecord,
  type Routine,
  type RoutineExercise,
  type Session,
  type Settings,
} from "./schema";
import { recalc, type NewSetInput } from "./session-ops";
import { ensureSettings } from "./seed";
import { getDayRow, locate, progressAfterSession } from "./trainer-ops";
import type { ProgressionDecision } from "./trainer-schema";

/**
 * Scritture.
 *
 * Sono tutte **ottimistiche**: la UI applica il cambiamento e chiama queste funzioni.
 * Se la scrittura fallisce compare il banner d'errore persistente (§4.3), ma non si
 * annulla a schermo una serie che l'utente ha fatto davvero.
 */

export class DuplicateNameError extends Error {
  constructor() {
    super("Esiste gia' un esercizio con questo nome.");
    this.name = "DuplicateNameError";
  }
}

export class ActiveSessionExistsError extends Error {
  constructor(public readonly sessionId: ID) {
    super("C'e' gia' un allenamento in corso.");
    this.name = "ActiveSessionExistsError";
  }
}

// ---------------------------------------------------------------- esercizi

export interface ExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  secondaryMuscles?: MuscleGroup[];
  isBodyweight?: boolean;
  notes?: string;
  defaultRestSec?: number;
}

export async function createExercise(
  db: LiftedDB,
  input: ExerciseInput,
): Promise<Exercise> {
  const exercise: Exercise = {
    id: newId(),
    name: input.name.trim(),
    // L'attrezzo entra nella chiave (§9.4): «Panca piana» ai manubri e al bilanciere
    // sono due esercizi diversi anche quando l'utente li chiama allo stesso modo.
    nameKey: exerciseKey(input.name, input.equipment),
    muscleGroup: input.muscleGroup,
    secondaryMuscles: input.secondaryMuscles ?? [],
    equipment: input.equipment,
    isCustom: true,
    isBodyweight: input.isBodyweight ?? isBodyweightEquipment(input.equipment),
    notes: input.notes?.trim() || undefined,
    defaultRestSec: input.defaultRestSec,
    createdAt: nowIso(),
    /*
      Un esercizio dell'utente non entra in una famiglia: §9.4 vuole che i
      personalizzati restino sotto «Personalizzati», e inventargli una famiglia
      significherebbe esporlo al seed, che li aggiornerebbe come voci di libreria.
    */
    family: "",
    mechanics: "compound",
    unilateral: false,
    loadMode: EQUIPMENT_LOAD_MODE[input.equipment] ?? "external",
    popularity: 50,
  };

  try {
    await db.exercises.add(exercise);
  } catch (error) {
    throw asDuplicateName(error);
  }
  return exercise;
}

export async function updateExercise(
  db: LiftedDB,
  id: ID,
  input: ExerciseInput,
): Promise<void> {
  try {
    await db.exercises.update(id, {
      name: input.name.trim(),
      nameKey: exerciseKey(input.name, input.equipment),
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      secondaryMuscles: input.secondaryMuscles ?? [],
      isBodyweight: input.isBodyweight ?? isBodyweightEquipment(input.equipment),
      loadMode: EQUIPMENT_LOAD_MODE[input.equipment] ?? "external",
      notes: input.notes?.trim() || undefined,
      defaultRestSec: input.defaultRestSec,
    });
  } catch (error) {
    throw asDuplicateName(error);
  }
}

/**
 * Elimina un esercizio personalizzato. Lo storico resta: le sessioni portano il nome
 * denormalizzato (§9.3), quindi non si rompe niente.
 */
export async function deleteExercise(db: LiftedDB, id: ID): Promise<void> {
  const exercise = await db.exercises.get(id);
  if (!exercise) return;
  if (!exercise.isCustom) {
    throw new Error("Gli esercizi della libreria non si eliminano.");
  }
  await db.exercises.delete(id);
}

function asDuplicateName(error: unknown): Error {
  const name = (error as { name?: string })?.name;
  if (name === "ConstraintError") return new DuplicateNameError();
  return error as Error;
}

// ---------------------------------------------------------------- routine

export interface RoutineInput {
  name: string;
  split?: string;
  exercises: RoutineExercise[];
}

export async function createRoutine(
  db: LiftedDB,
  input: RoutineInput,
): Promise<Routine> {
  const count = await db.routines.count();
  const timestamp = nowIso();
  const routine: Routine = {
    id: newId(),
    name: input.name.trim(),
    split: input.split?.trim() || undefined,
    order: count,
    exercises: normalizeRoutineExercises(input.exercises),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.routines.add(routine);
  return routine;
}

export async function updateRoutine(
  db: LiftedDB,
  id: ID,
  input: RoutineInput,
): Promise<void> {
  await db.routines.update(id, {
    name: input.name.trim(),
    split: input.split?.trim() || undefined,
    exercises: normalizeRoutineExercises(input.exercises),
    updatedAt: nowIso(),
  });
}

export async function deleteRoutine(db: LiftedDB, id: ID): Promise<void> {
  await db.transaction("rw", db.routines, async () => {
    await db.routines.delete(id);
    const rest = await db.routines.orderBy("order").toArray();
    await Promise.all(
      rest.map((routine, order) =>
        routine.order === order
          ? Promise.resolve(0)
          : db.routines.update(routine.id, { order }),
      ),
    );
  });
}

export async function duplicateRoutine(db: LiftedDB, id: ID): Promise<Routine | null> {
  const source = await db.routines.get(id);
  if (!source) return null;
  return createRoutine(db, {
    name: `${source.name} (copia)`,
    split: source.split,
    exercises: source.exercises,
  });
}

/** `delta` vale -1 (su) o +1 (giu'). */
export async function moveRoutine(db: LiftedDB, id: ID, delta: number): Promise<void> {
  await db.transaction("rw", db.routines, async () => {
    const routines = await db.routines.orderBy("order").toArray();
    const from = routines.findIndex((routine) => routine.id === id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= routines.length) return;
    const [moved] = routines.splice(from, 1);
    routines.splice(to, 0, moved);
    await Promise.all(
      routines.map((routine, order) =>
        routine.order === order
          ? Promise.resolve(0)
          : db.routines.update(routine.id, { order }),
      ),
    );
  });
}

function normalizeRoutineExercises(exercises: RoutineExercise[]): RoutineExercise[] {
  return exercises.map((exercise, order) => ({
    ...exercise,
    order,
    sets: exercise.sets.length > 0 ? exercise.sets : [{ type: "normal" as const }],
  }));
}

// ---------------------------------------------------------------- sessione

export interface StartSessionInput {
  routineId?: ID;
  /**
   * «Ripeti come sessione» dal menu di una card del feed (§4.21): la sessione nuova
   * nasce con gli **stessi esercizi e lo stesso numero di serie** di quella passata,
   * campi vuoti e colonna PRECEDENTE gia' riempita. Non si copiano i valori: quello
   * che si e' fatto la volta scorsa e' un suggerimento, non un dato da ri-salvare.
   */
  fromSessionId?: ID;
  /**
   * Il giorno del programma da cui parte la sessione (§4.24, «Avvio dell'allenamento
   * dal Trainer»). Gli esercizi, le serie e **il carico consigliato** arrivano da li',
   * e il carico entra nel campo **come valore**: il Trainer propone, quindi scrive.
   * Una proposta che l'utente deve ridigitare non e' una proposta.
   */
  trainerDayId?: ID;
}

/**
 * Avvia una sessione. **Una sola sessione attiva per costruzione** (§9.3): il controllo
 * sta qui dentro, nella stessa transazione della scrittura, non nel bottone.
 */
export async function startSession(
  db: LiftedDB,
  input: StartSessionInput = {},
): Promise<Session> {
  const settings = await ensureSettings(db);
  const routine = input.routineId ? await db.routines.get(input.routineId) : undefined;
  const source = input.fromSessionId
    ? await db.sessions.get(input.fromSessionId)
    : undefined;
  const trainerDay = input.trainerDayId
    ? await trainerDayPlan(db, input.trainerDayId)
    : undefined;

  /*
    Una sessione passata si comporta come una routine improvvisata: stessi esercizi,
    stesso numero di serie, stesso tipo. Tradurla in `RoutineExercise[]` evita di
    duplicare tutto il ramo di costruzione qui sotto.
  */
  const template: RoutineExercise[] | undefined = source
    ? source.exercises.map((exercise, order) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        order,
        notes: exercise.notes,
        restSec: exercise.restSec,
        sets: exercise.sets.map((set) => ({ type: set.type })),
      }))
    : undefined;

  const plan = routine?.exercises ?? trainerDay?.exercises ?? template ?? [];

  // Le letture "volta scorsa" stanno fuori dalla transazione di scrittura: sono
  // indipendenti fra loro e si fanno in parallelo.
  const previousByExercise = new Map<ID, Awaited<ReturnType<typeof previousSetsFor>>>();
  if (plan.length > 0) {
    const unique = [...new Set(plan.map((item) => item.exerciseId))];
    const results = await Promise.all(
      unique.map((exerciseId) => previousSetsFor(db, exerciseId)),
    );
    unique.forEach((exerciseId, i) => previousByExercise.set(exerciseId, results[i]));
  }

  const catalogue =
    plan.length > 0
      ? await db.exercises.bulkGet([...new Set(plan.map((item) => item.exerciseId))])
      : [];
  const equipmentById = new Map<ID, Equipment>();
  for (const exercise of catalogue) {
    if (exercise) equipmentById.set(exercise.id, exercise.equipment);
  }

  const startedAt = nowIso();
  const session: Session = recalc({
    id: newId(),
    routineId: routine?.id,
    routineName: routine?.name ?? trainerDay?.name ?? source?.routineName,
    trainerDayId: trainerDay?.id,
    startedAt,
    status: "active",
    pausedMs: 0,
    exercises: plan.map((item, order) => {
      const previous = previousByExercise.get(item.exerciseId) ?? [];
      return {
        id: newId(),
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        equipment: equipmentById.get(item.exerciseId) ?? "other",
        order,
        notes: item.notes,
        restSec: item.restSec ?? settings.defaultRestSec,
        sets: item.sets.map((template, i) => ({
          id: newId(),
          index: i + 1,
          type: template.type,
          weightKg: template.targetWeightKg ?? null,
          reps: template.targetReps ?? null,
          rpe: template.targetRpe ?? null,
          completed: false,
          prevWeightKg: previous[i]?.weightKg ?? null,
          prevReps: previous[i]?.reps ?? null,
        })),
      };
    }),
    totalVolumeKg: 0,
    totalSets: 0,
    durationSec: 0,
    exerciseIds: [],
  });

  await db.transaction("rw", db.sessions, async () => {
    const existing = await db.sessions.where("status").equals("active").first();
    if (existing) throw new ActiveSessionExistsError(existing.id);
    await db.sessions.add(session);
  });

  return session;
}

/**
 * Applica una trasformazione pura alla sessione attiva e la riscrive.
 * Tutte le mutazioni di sessione passano di qui, cosi' la transazione e' una sola e il
 * ricalcolo dei totali non si puo' dimenticare.
 */
export async function updateActiveSession(
  db: LiftedDB,
  transform: (session: Session) => Session,
): Promise<Session | null> {
  return db.transaction("rw", db.sessions, async () => {
    const current = await db.sessions.where("status").equals("active").first();
    if (!current) return null;
    const next = recalc(transform(current));
    await db.sessions.put(next);
    return next;
  });
}

/** Serie di riferimento di un esercizio da aggiungere in sessione. */
export async function buildSetsFromLibrary(
  db: LiftedDB,
  exerciseId: ID,
  count = 3,
): Promise<NewSetInput[]> {
  const previous = await previousSetsFor(db, exerciseId);
  const total = Math.max(count, previous.length);
  return Array.from({ length: total }, (_, i) => ({
    type: "normal" as const,
    prevWeightKg: previous[i]?.weightKg ?? null,
    prevReps: previous[i]?.reps ?? null,
  }));
}

export interface FinishedSession {
  session: Session;
  records: PersonalRecord[];
  /**
   * Le decisioni che la progressione ha appena scritto (§6.8): sono quelle che il
   * riepilogo mostra nella card «Cosa cambia la prossima volta». Vuoto quando la
   * sessione non veniva dal Trainer.
   */
  decisions: ProgressionDecision[];
}

/**
 * Chiude la sessione **e** rileva i record personali nella stessa transazione: o si
 * salvano l'allenamento e i suoi PR, o non si salva niente. Un record senza la sessione
 * che lo ha prodotto sarebbe un numero senza storia.
 */
export async function finishSession(db: LiftedDB): Promise<FinishedSession | null> {
  const endedAt = nowIso();
  const settings = await ensureSettings(db);
  return db.transaction(
    "rw",
    [
      db.sessions,
      db.routines,
      db.personalRecords,
      db.exercises,
      db.settings,
      db.trainerPrograms,
      db.trainerDays,
      db.trainerDecisions,
    ],
    async () => {
    const current = await db.sessions.where("status").equals("active").first();
    if (!current) return null;

    // Le serie vuote non si salvano: l'utente e' stato avvisato nel dialog (§6.2).
    const exercises = current.exercises
      .map((exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => set.completed),
      }))
      .filter((exercise) => exercise.sets.length > 0)
      .map((exercise, order) => ({
        ...exercise,
        order,
        sets: exercise.sets.map((set, i) => ({ ...set, index: i + 1 })),
      }));

    const durationSec = Math.round(
      elapsedSessionMs(
        { startedAt: current.startedAt, pausedMs: current.pausedMs, pausedAt: current.pausedAt, endedAt },
        Date.parse(endedAt),
      ) / 1000,
    );

    const finished = recalc({
      ...current,
      exercises,
      status: "completed",
      endedAt,
      durationSec,
      restStartedAt: null,
      restDurationSec: null,
      restPausedAt: null,
      restPausedMs: 0,
    });

    const { session: withPrIds, records } = await computeSessionPRs(
      db,
      finished,
      settings.e1rmFormula,
    );

    await db.sessions.put(withPrIds);
    if (records.length > 0) await db.personalRecords.bulkAdd(records);
    if (withPrIds.routineId) {
      await db.routines.update(withPrIds.routineId, { lastPerformedAt: endedAt });
    }

    /*
      La progressione gira **qui dentro**, nella stessa transazione: il giorno si marca
      da se', le decisioni della settimana dopo si scrivono, e se qualcosa fallisce non
      resta un allenamento salvato con un programma rimasto indietro (§6.8).
    */
    const decisions = await progressAfterSession(db, withPrIds, endedAt);

    return { session: withPrIds, records, decisions };
    },
  );
}

export async function discardSession(db: LiftedDB): Promise<void> {
  await db.transaction("rw", db.sessions, async () => {
    const current = await db.sessions.where("status").equals("active").first();
    if (!current) return;
    await db.sessions.delete(current.id);
  });
}

/**
 * Elimina un allenamento dallo storico e **ricalcola i record** degli esercizi che
 * conteneva: volume, serie e PR calcolati da quella sessione non possono sopravviverle
 * (§5.2, "verranno ricalcolati").
 */
/**
 * «Salva come routine» dal menu di una card del feed (§4.21).
 *
 * Il nome prende un suffisso con la data: due allenamenti liberi salvati nello stesso
 * giorno avrebbero lo stesso nome, e una lista di routine con tre «Sessione libera»
 * dentro non serve a nessuno. I **pesi non si copiano**: una routine e' un piano, non
 * un verbale.
 */
export async function routineFromSession(
  db: LiftedDB,
  sessionId: ID,
): Promise<Routine | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;

  const giorno = new Date(session.startedAt);
  const stamp = `${String(giorno.getDate()).padStart(2, "0")}/${String(
    giorno.getMonth() + 1,
  ).padStart(2, "0")}`;

  return createRoutine(db, {
    name: `${session.routineName ?? "Sessione libera"} · ${stamp}`,
    exercises: session.exercises.map((exercise, order) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      order,
      notes: exercise.notes,
      restSec: exercise.restSec,
      sets: exercise.sets.map((set) => ({ type: set.type })),
    })),
  });
}

export async function deleteSession(db: LiftedDB, id: ID): Promise<void> {
  const settings = await ensureSettings(db);
  const session = await db.sessions.get(id);
  if (!session) return;
  const exerciseIds = [...new Set(session.exercises.map((item) => item.exerciseId))];

  await db.transaction("rw", db.sessions, db.personalRecords, async () => {
    await db.personalRecords.where("sessionId").equals(id).delete();
    await db.sessions.delete(id);
  });

  if (exerciseIds.length > 0) {
    await rebuildPersonalRecords(db, settings.e1rmFormula, exerciseIds);
  }
}

// ---------------------------------------------------------------- timer

export function startRest(db: LiftedDB, durationSec: number) {
  const startedAt = nowIso();
  return updateActiveSession(db, (session) => ({
    ...session,
    restStartedAt: startedAt,
    restDurationSec: durationSec,
    restPausedAt: null,
    restPausedMs: 0,
  }));
}

export function stopRest(db: LiftedDB) {
  return updateActiveSession(db, (session) => ({
    ...session,
    restStartedAt: null,
    restDurationSec: null,
    restPausedAt: null,
    restPausedMs: 0,
  }));
}

/** `+15` / `-15`: si allunga o accorcia la durata, non si tocca l'istante d'avvio. */
export function adjustRest(db: LiftedDB, deltaSec: number) {
  return updateActiveSession(db, (session) => {
    if (!session.restStartedAt || session.restDurationSec == null) return session;
    return {
      ...session,
      restDurationSec: Math.max(5, session.restDurationSec + deltaSec),
    };
  });
}

export function toggleRestPause(db: LiftedDB) {
  const now = nowIso();
  return updateActiveSession(db, (session) => {
    if (!session.restStartedAt) return session;
    if (session.restPausedAt) {
      const paused = Date.parse(now) - Date.parse(session.restPausedAt);
      return {
        ...session,
        restPausedAt: null,
        restPausedMs: (session.restPausedMs ?? 0) + Math.max(0, paused),
      };
    }
    return { ...session, restPausedAt: now };
  });
}

// ---------------------------------------------------------------- impostazioni

export async function updateSettings(
  db: LiftedDB,
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const next = { ...current, ...patch, id: "singleton" as const };
  await db.settings.put(next);
  return next;
}

/**
 * Corpo libero per default: corpo libero puro, zavorrato e macchina assistita partono
 * tutti dal presupposto che il campo KG non sia il peso sollevato ma un'aggiunta o uno
 * sconto. `EQUIPMENT_LOAD_MODE` dice quale dei tre.
 */
function isBodyweightEquipment(equipment: Equipment): boolean {
  return EQUIPMENT_LOAD_MODE[equipment] !== undefined;
}

/**
 * Il giorno del Trainer tradotto nel piano che `startSession` gia' sa costruire.
 *
 * `targetWeightKg` e' il carico consigliato, e finisce nel campo **come valore**
 * (§10-bis passo 5). Le ripetizioni no: il Trainer prescrive un *intervallo*, e
 * scrivere `6` in un campo dove l'utente ne fara' 8 sarebbe un numero da correggere,
 * non un aiuto. L'intervallo si legge nelle note dell'esercizio, dove resta visibile
 * per tutta la sessione.
 */
async function trainerDayPlan(
  db: LiftedDB,
  dayId: ID,
): Promise<{ id: ID; name: string; exercises: RoutineExercise[] } | undefined> {
  const row = await getDayRow(db, dayId);
  if (!row) return undefined;
  const program = await db.trainerPrograms.get(row.programId);
  if (!program) return undefined;
  const found = locate(program, dayId);
  if (!found) return undefined;

  return {
    id: dayId,
    name: found.day.name,
    exercises: found.day.exercises.map((exercise, order) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      order,
      notes: `Obiettivo ${exercise.sets} × ${exercise.repsMin}-${exercise.repsMax} a RPE ${exercise.rpeTarget}`,
      restSec: exercise.restSec,
      sets: Array.from({ length: exercise.sets }, () => ({
        type: "normal" as const,
        targetWeightKg: exercise.suggestedWeightKg,
        targetReps: null,
        targetRpe: null,
      })),
    })),
  };
}
