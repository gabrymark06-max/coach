import type {
  ID,
  ISODate,
  PersonalRecord,
  PRKind,
  Session,
  SetEntry,
} from "@/lib/db/schema";
import { estimate1RM, type E1rmFormula } from "./e1rm";

/**
 * Rilevamento automatico dei record personali (spec §3.5).
 *
 * Tre decisioni prese qui, una volta sola, perche' altrimenti si sparpagliano:
 *
 *  1. **Un record si batte, non si eguaglia.** Il pari merito non genera un PR: ripetere
 *     la prestazione di sempre non e' un record, e un badge che scatta ogni volta smette
 *     di voler dire qualcosa.
 *  2. **Contano solo le serie allenanti completate.** Le serie di riscaldamento restano
 *     fuori da tutti e tre i tipi: un 20 kg x 30 di riscaldamento non e' un record di
 *     ripetizioni. (Il *volume della sessione*, §3.1, continua invece a contare tutto:
 *     sono due numeri con due domande diverse.)
 *  3. **I tre tipi misurano tre cose diverse**, altrimenti sarebbero lo stesso record
 *     scritto tre volte:
 *       - `e1rm`   → il 1RM stimato piu' alto di una **singola serie**;
 *       - `volume` → il **volume totale dell'esercizio in quella sessione** (risponde a
 *         "ho mai fatto tanto lavoro su questo esercizio?");
 *       - `reps`   → il numero di ripetizioni piu' alto di una **singola serie**.
 *
 * Nessuna sessione che non sia `completed` produce record: una sessione attiva puo'
 * ancora cambiare, una scartata non e' mai esistita.
 */

export interface PRDraft {
  exerciseId: ID;
  kind: PRKind;
  value: number;
  weightKg?: number;
  reps?: number;
  setId: ID;
}

export interface PRBaseline {
  value: number;
  achievedAt: ISODate;
}

/** Chiave di un record: un esercizio ha un record per tipo, non di piu'. */
export function prKey(exerciseId: ID, kind: PRKind): string {
  return `${exerciseId}|${kind}`;
}

export type PRBaselines = ReadonlyMap<string, PRBaseline>;

function countsForPR(set: SetEntry): boolean {
  return set.completed && set.type !== "warmup";
}

/** Le tre misure migliori della sessione, esercizio per esercizio. */
export function sessionCandidates(
  session: Pick<Session, "exercises" | "status">,
  formula: E1rmFormula,
): PRDraft[] {
  const drafts: PRDraft[] = [];

  // Un esercizio puo' comparire due volte nella stessa sessione (superset ripetuti):
  // le misure si accumulano sull'esercizio, non sulla card.
  const byExercise = new Map<
    ID,
    {
      e1rm: PRDraft | null;
      reps: PRDraft | null;
      volume: number;
      firstSetId: ID | null;
    }
  >();

  for (const exercise of session.exercises) {
    let bucket = byExercise.get(exercise.exerciseId);
    if (!bucket) {
      bucket = { e1rm: null, reps: null, volume: 0, firstSetId: null };
      byExercise.set(exercise.exerciseId, bucket);
    }

    for (const set of exercise.sets) {
      if (!countsForPR(set)) continue;
      const weightKg = set.weightKg;
      const reps = set.reps;
      if (reps == null || reps <= 0) continue;

      if (bucket.firstSetId === null) bucket.firstSetId = set.id;

      const estimate = estimate1RM(weightKg, reps, formula);
      if (
        estimate !== null &&
        weightKg != null &&
        (bucket.e1rm === null || estimate > bucket.e1rm.value)
      ) {
        bucket.e1rm = {
          exerciseId: exercise.exerciseId,
          kind: "e1rm",
          value: estimate,
          weightKg,
          reps,
          setId: set.id,
        };
      }

      if (bucket.reps === null || reps > bucket.reps.value) {
        bucket.reps = {
          exerciseId: exercise.exerciseId,
          kind: "reps",
          value: reps,
          weightKg: weightKg ?? undefined,
          reps,
          setId: set.id,
        };
      }

      if (weightKg != null && weightKg > 0) {
        bucket.volume += Math.round(weightKg * reps * 100) / 100;
      }
    }
  }

  for (const [exerciseId, bucket] of byExercise) {
    if (bucket.firstSetId === null) continue;
    if (bucket.e1rm) drafts.push(bucket.e1rm);
    if (bucket.volume > 0) {
      drafts.push({
        exerciseId,
        kind: "volume",
        value: Math.round(bucket.volume * 100) / 100,
        setId: bucket.firstSetId,
      });
    }
    if (bucket.reps) drafts.push(bucket.reps);
  }

  return drafts;
}

export interface DetectedPR extends PRDraft {
  previousValue?: number;
  previousAchievedAt?: ISODate;
}

/** Le sole misure che **battono** il record corrente. */
export function detectSessionPRs(
  session: Pick<Session, "exercises" | "status">,
  baselines: PRBaselines,
  formula: E1rmFormula,
): DetectedPR[] {
  if (session.status !== "completed") return [];

  const detected: DetectedPR[] = [];
  for (const draft of sessionCandidates(session, formula)) {
    const current = baselines.get(prKey(draft.exerciseId, draft.kind));
    if (current && draft.value <= current.value) continue;
    detected.push(
      current
        ? { ...draft, previousValue: current.value, previousAchievedAt: current.achievedAt }
        : draft,
    );
  }
  return detected;
}

/**
 * Ricostruisce **tutta** la catena dei record dalle sessioni date.
 *
 * E' la funzione che tiene coerente lo storico quando una sessione viene eliminata o
 * modificata: i record non si "tolgono", si ricalcolano dal principio sugli esercizi
 * toccati. Costa una passata sulle sessioni di quegli esercizi, e succede solo quando
 * qualcosa cambia davvero.
 */
export function replayPersonalRecords(
  sessions: readonly Session[],
  formula: E1rmFormula,
  makeId: () => ID,
): PersonalRecord[] {
  const ordered = sessions
    .filter((item) => item.status === "completed")
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));

  const baselines = new Map<string, PRBaseline>();
  const records: PersonalRecord[] = [];

  for (const session of ordered) {
    const achievedAt = session.endedAt ?? session.startedAt;
    for (const detected of detectSessionPRs(session, baselines, formula)) {
      records.push({
        id: makeId(),
        exerciseId: detected.exerciseId,
        kind: detected.kind,
        value: detected.value,
        weightKg: detected.weightKg,
        reps: detected.reps,
        sessionId: session.id,
        setId: detected.setId,
        achievedAt,
        previousValue: detected.previousValue,
        previousAchievedAt: detected.previousAchievedAt,
      });
      baselines.set(prKey(detected.exerciseId, detected.kind), {
        value: detected.value,
        achievedAt,
      });
    }
  }

  return records;
}

export const PR_KIND_LABEL: Record<PRKind, string> = {
  e1rm: "PR 1RM",
  volume: "PR VOLUME",
  reps: "PR REPS",
};

export const PR_KIND_SPOKEN: Record<PRKind, string> = {
  e1rm: "1RM stimato",
  volume: "volume dell'esercizio",
  reps: "ripetizioni in una serie",
};
