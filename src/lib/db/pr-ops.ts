import { detectSessionPRs, prKey, replayPersonalRecords, type DetectedPR } from "@/lib/logic/pr";
import type { E1rmFormula } from "@/lib/logic/e1rm";
import { newId, type LiftedDB } from "./db";
import type { ID, PersonalRecord, Session } from "./schema";

/**
 * I record personali sulla persistenza.
 *
 * `PersonalRecord` e' una tabella, non un calcolo (§9.3): il riepilogo deve poter dire
 * *quando* un record e' caduto e *quale* era il precedente. Qui ci sono le due sole
 * operazioni che la toccano:
 *
 *  - `appendSessionPRs` — alla chiusura di una sessione, in transazione con la sessione
 *    stessa: o si salvano l'allenamento e i suoi record, o non si salva niente.
 *  - `rebuildFor` — quando lo storico cambia sotto i piedi (una sessione eliminata o
 *    modificata): i record degli esercizi toccati si **ricalcolano da capo** replaying
 *    lo storico. Togliere il record migliore senza rigiocare la catena lascerebbe
 *    "precedente: 112 kg" puntato a una sessione che non esiste piu'.
 */

/** I record correnti di un insieme di esercizi, nella forma che serve al rilevamento. */
export async function baselinesFor(
  db: LiftedDB,
  exerciseIds: readonly ID[],
): Promise<Map<string, { value: number; achievedAt: string }>> {
  const baselines = new Map<string, { value: number; achievedAt: string }>();
  if (exerciseIds.length === 0) return baselines;

  const rows = await db.personalRecords
    .where("exerciseId")
    .anyOf([...exerciseIds])
    .toArray();

  for (const row of rows) {
    const key = prKey(row.exerciseId, row.kind);
    const current = baselines.get(key);
    if (!current || row.value > current.value) {
      baselines.set(key, { value: row.value, achievedAt: row.achievedAt });
    }
  }
  return baselines;
}

export function toPersonalRecords(
  detected: readonly DetectedPR[],
  session: Pick<Session, "id" | "startedAt" | "endedAt">,
): PersonalRecord[] {
  const achievedAt = session.endedAt ?? session.startedAt;
  return detected.map((item) => ({
    id: newId(),
    exerciseId: item.exerciseId,
    kind: item.kind,
    value: item.value,
    weightKg: item.weightKg,
    reps: item.reps,
    sessionId: session.id,
    setId: item.setId,
    achievedAt,
    previousValue: item.previousValue,
    previousAchievedAt: item.previousAchievedAt,
  }));
}

/**
 * Calcola i record di una sessione appena chiusa e li restituisce **gia' legati alle
 * serie** che li hanno prodotti (`SetEntry.prIds`), cosi' il riepilogo non deve
 * riconciliare niente. Non scrive: la scrittura la fa `finishSession`, dentro la sua
 * transazione.
 */
export async function computeSessionPRs(
  db: LiftedDB,
  session: Session,
  formula: E1rmFormula,
): Promise<{ session: Session; records: PersonalRecord[] }> {
  const exerciseIds = [...new Set(session.exercises.map((item) => item.exerciseId))];
  const baselines = await baselinesFor(db, exerciseIds);
  const detected = detectSessionPRs(session, baselines, formula);
  if (detected.length === 0) return { session, records: [] };

  const records = toPersonalRecords(detected, session);
  const bySetId = new Map<ID, ID[]>();
  for (const record of records) {
    bySetId.set(record.setId, [...(bySetId.get(record.setId) ?? []), record.id]);
  }

  return {
    session: {
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          const prIds = bySetId.get(set.id);
          return prIds ? { ...set, prIds } : set;
        }),
      })),
    },
    records,
  };
}

/**
 * Ricostruisce i record degli esercizi indicati (o di tutti, se non se ne indica
 * nessuno) rigiocando lo storico completato in ordine cronologico.
 */
export async function rebuildPersonalRecords(
  db: LiftedDB,
  formula: E1rmFormula,
  exerciseIds?: readonly ID[],
): Promise<number> {
  return db.transaction("rw", db.sessions, db.personalRecords, async () => {
    const targets = exerciseIds ? [...new Set(exerciseIds)] : null;

    const sessions = targets
      ? await db.sessions.where("exerciseIds").anyOf(targets).distinct().toArray()
      : await db.sessions.toArray();

    const completed = sessions.filter((item) => item.status === "completed");
    const rebuilt = replayPersonalRecords(completed, formula, newId).filter((record) =>
      targets ? targets.includes(record.exerciseId) : true,
    );

    if (targets) {
      await db.personalRecords.where("exerciseId").anyOf(targets).delete();
    } else {
      await db.personalRecords.clear();
    }
    if (rebuilt.length > 0) await db.personalRecords.bulkAdd(rebuilt);

    // Le serie portano `prIds`: se i record cambiano, i puntatori vanno riscritti,
    // altrimenti un riepilogo passato mostrerebbe un badge che non esiste piu'.
    const bySetId = new Map<ID, ID[]>();
    for (const record of rebuilt) {
      bySetId.set(record.setId, [...(bySetId.get(record.setId) ?? []), record.id]);
    }
    for (const session of completed) {
      let touched = false;
      const exercises = session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (targets && !targets.includes(exercise.exerciseId)) return set;
          const prIds = bySetId.get(set.id);
          const next = prIds ?? undefined;
          if ((set.prIds ?? undefined) === next) return set;
          touched = true;
          return next ? { ...set, prIds: next } : { ...set, prIds: undefined };
        }),
      }));
      if (touched) await db.sessions.put({ ...session, exercises });
    }

    return rebuilt.length;
  });
}

export async function listPersonalRecords(
  db: LiftedDB,
  limit?: number,
): Promise<PersonalRecord[]> {
  const rows = await db.personalRecords.orderBy("achievedAt").reverse().toArray();
  return limit ? rows.slice(0, limit) : rows;
}

export async function personalRecordsForSession(
  db: LiftedDB,
  sessionId: ID,
): Promise<PersonalRecord[]> {
  return db.personalRecords.where("sessionId").equals(sessionId).toArray();
}

export async function personalRecordsForExercise(
  db: LiftedDB,
  exerciseId: ID,
): Promise<PersonalRecord[]> {
  return db.personalRecords
    .where("[exerciseId+achievedAt]")
    .between([exerciseId, ""], [exerciseId, "￿"])
    .reverse()
    .toArray();
}
