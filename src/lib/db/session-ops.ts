import { sessionTotals } from "@/lib/logic/volume";
import { newId } from "./db";
import { deriveExerciseIds } from "./migrations";
import type {
  Equipment,
  ID,
  Session,
  SessionExercise,
  SetEntry,
  SetType,
} from "./schema";

/**
 * Trasformazioni della sessione attiva.
 *
 * Sono funzioni **pure**: prendono una sessione e ne restituiscono una nuova. Lo strato
 * Dexie si limita a leggere, applicare una di queste e riscrivere dentro una
 * transazione. Cosi' tutta la logica della sessione — la parte che si usa in palestra —
 * si prova senza browser e senza IndexedDB.
 */

export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 999;

export interface NewExerciseInput {
  exerciseId: ID;
  exerciseName: string;
  equipment: Equipment;
  restSec: number;
  notes?: string;
  sets: NewSetInput[];
}

export interface NewSetInput {
  type: SetType;
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  prevWeightKg?: number | null;
  prevReps?: number | null;
}

export interface SetPatch {
  type?: SetType;
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

export function makeSet(index: number, input: NewSetInput): SetEntry {
  return {
    id: newId(),
    index,
    type: input.type,
    weightKg: input.weightKg ?? null,
    reps: input.reps ?? null,
    rpe: input.rpe ?? null,
    completed: false,
    prevWeightKg: input.prevWeightKg ?? null,
    prevReps: input.prevReps ?? null,
  };
}

export function makeSessionExercise(
  input: NewExerciseInput,
  order: number,
): SessionExercise {
  const sets = (input.sets.length > 0 ? input.sets : [{ type: "normal" as SetType }]).map(
    (set, i) => makeSet(i + 1, set),
  );
  return {
    id: newId(),
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    equipment: input.equipment,
    order,
    notes: input.notes,
    restSec: input.restSec,
    sets,
  };
}

export function addExercise(session: Session, input: NewExerciseInput): Session {
  const exercises = [
    ...session.exercises,
    makeSessionExercise(input, session.exercises.length),
  ];
  return recalc({ ...session, exercises });
}

export function removeExercise(session: Session, sessionExerciseId: ID): Session {
  const exercises = session.exercises
    .filter((exercise) => exercise.id !== sessionExerciseId)
    .map((exercise, order) => ({ ...exercise, order }));
  if (exercises.length === session.exercises.length) return session;
  return recalc({ ...session, exercises });
}

/** `delta` vale -1 (su) o +1 (giu'). Ai bordi restituisce la sessione invariata. */
export function moveExercise(
  session: Session,
  sessionExerciseId: ID,
  delta: number,
): Session {
  const from = session.exercises.findIndex((e) => e.id === sessionExerciseId);
  if (from === -1) return session;
  const to = from + delta;
  if (to < 0 || to >= session.exercises.length) return session;

  const exercises = session.exercises.slice();
  const [moved] = exercises.splice(from, 1);
  exercises.splice(to, 0, moved);
  return recalc({
    ...session,
    exercises: exercises.map((exercise, order) => ({ ...exercise, order })),
  });
}

/**
 * `Sostituisci esercizio` (§6.2): si cambia l'esercizio **tenendo il posto e la forma**
 * dell'allenamento — stesso numero di serie, stessi tipi, stessa posizione nella lista.
 *
 * I valori inseriti si azzerano di proposito: 80 kg di panca non sono 80 kg di croci, e
 * lasciarli li' sarebbe un dato sbagliato gia' scritto. Al loro posto entra la serie
 * "volta scorsa" del nuovo esercizio, che e' l'informazione utile.
 */
export function replaceExercise(
  session: Session,
  sessionExerciseId: ID,
  input: Omit<NewExerciseInput, "sets"> & { previous?: NewSetInput[] },
): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => ({
    ...exercise,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    equipment: input.equipment,
    restSec: input.restSec,
    notes: input.notes,
    sets: exercise.sets.map((set, i) =>
      makeSet(i + 1, {
        type: set.type,
        prevWeightKg: input.previous?.[i]?.prevWeightKg ?? null,
        prevReps: input.previous?.[i]?.prevReps ?? null,
      }),
    ),
  }));
}

export function replaceExerciseNotes(
  session: Session,
  sessionExerciseId: ID,
  notes: string,
): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => ({
    ...exercise,
    notes: notes.trim() === "" ? undefined : notes,
  }));
}

export function setExerciseRest(
  session: Session,
  sessionExerciseId: ID,
  restSec: number,
): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => ({ ...exercise, restSec }));
}

export function addSet(session: Session, sessionExerciseId: ID): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => {
    const last = exercise.sets[exercise.sets.length - 1];
    const set = makeSet(exercise.sets.length + 1, {
      // la serie nuova somiglia all'ultima: si aggiunge una serie, non si riparte
      type: last?.type ?? "normal",
    });
    return { ...exercise, sets: [...exercise.sets, set] };
  });
}

export function addSets(
  session: Session,
  sessionExerciseId: ID,
  inputs: NewSetInput[],
  position: "start" | "end" = "end",
): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => {
    const added = inputs.map((input, i) => makeSet(i + 1, input));
    const sets = position === "start" ? [...added, ...exercise.sets] : [...exercise.sets, ...added];
    return { ...exercise, sets: reindex(sets) };
  });
}

export function deleteSet(session: Session, sessionExerciseId: ID, setId: ID): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => ({
    ...exercise,
    sets: reindex(exercise.sets.filter((set) => set.id !== setId)),
  }));
}

export function patchSet(
  session: Session,
  sessionExerciseId: ID,
  setId: ID,
  patch: SetPatch,
): Session {
  validatePatch(patch);
  return mapSet(session, sessionExerciseId, setId, (set) => ({ ...set, ...patch }));
}

export function toggleSetCompleted(
  session: Session,
  sessionExerciseId: ID,
  setId: ID,
  completed: boolean,
  now: string,
): Session {
  return mapSet(session, sessionExerciseId, setId, (set) => ({
    ...set,
    completed,
    completedAt: completed ? now : undefined,
  }));
}

/** Copia i valori della serie precedente nei campi (tocco sulla colonna PRECEDENTE). */
export function copyPreviousIntoSet(
  session: Session,
  sessionExerciseId: ID,
  setId: ID,
): Session {
  return mapSet(session, sessionExerciseId, setId, (set) =>
    set.prevWeightKg == null && set.prevReps == null
      ? set
      : { ...set, weightKg: set.prevWeightKg ?? null, reps: set.prevReps ?? null },
  );
}

/** Totali e indice multiEntry: si ricalcolano a ogni scrittura, mai a ogni render. */
export function recalc(session: Session): Session {
  const totals = sessionTotals(session.exercises);
  return {
    ...session,
    totalVolumeKg: totals.totalVolumeKg,
    totalSets: totals.totalSets,
    exerciseIds: deriveExerciseIds(session),
  };
}

/**
 * Numero mostrato nella colonna TIPO: le serie di riscaldamento portano la `W` e non
 * consumano un numero, cosi' "serie 1" resta la prima serie allenante.
 */
export function setDisplayNumber(
  sets: readonly { type: SetType }[],
  index: number,
): number | null {
  if (sets[index]?.type === "warmup") return null;
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (sets[i].type !== "warmup") n += 1;
  }
  return n;
}

function validatePatch(patch: SetPatch): void {
  if (patch.weightKg != null) {
    if (!Number.isFinite(patch.weightKg) || patch.weightKg < 0 || patch.weightKg > MAX_WEIGHT_KG) {
      throw new RangeError(`Inserisci un peso tra 0 e ${MAX_WEIGHT_KG} kg.`);
    }
  }
  if (patch.reps != null) {
    if (!Number.isInteger(patch.reps) || patch.reps < 1 || patch.reps > MAX_REPS) {
      throw new RangeError(`Inserisci un numero di ripetizioni tra 1 e ${MAX_REPS}.`);
    }
  }
  if (patch.rpe != null) {
    if (!Number.isFinite(patch.rpe) || patch.rpe < 1 || patch.rpe > 10) {
      throw new RangeError("L'RPE va da 1 a 10.");
    }
  }
}

function reindex(sets: SetEntry[]): SetEntry[] {
  return sets.map((set, i) => (set.index === i + 1 ? set : { ...set, index: i + 1 }));
}

function mapExercise(
  session: Session,
  sessionExerciseId: ID,
  fn: (exercise: SessionExercise) => SessionExercise,
): Session {
  let touched = false;
  const exercises = session.exercises.map((exercise) => {
    if (exercise.id !== sessionExerciseId) return exercise;
    touched = true;
    return fn(exercise);
  });
  if (!touched) return session;
  return recalc({ ...session, exercises });
}

function mapSet(
  session: Session,
  sessionExerciseId: ID,
  setId: ID,
  fn: (set: SetEntry) => SetEntry,
): Session {
  return mapExercise(session, sessionExerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => (set.id === setId ? fn(set) : set)),
  }));
}
