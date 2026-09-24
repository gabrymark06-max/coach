/**
 * Il modello del Trainer — design system §9.5.
 *
 * **Attenzione: in v2 non c'e' una riga di UI che legga queste tabelle.** Esistono
 * adesso per una ragione sola, e dichiarata: il formato del backup sale a
 * `formatVersion: 2` in questo intervento, e un backup deve restare importabile anche
 * dopo. Far salire il formato due volte — una per la libreria allargata e una per il
 * Trainer — significherebbe chiedere all'utente di ri-esportare, che e' esattamente il
 * contrario di una rete di sicurezza.
 *
 * Le tabelle si creano, si esportano e si importano vuote. La logica che le riempie e'
 * il secondo intervento.
 *
 * La quarta entita' — `ProgressionDecision` — e' quella che rende il Trainer
 * trasparente: senza una tabella delle decisioni il «perche'» andrebbe ricalcolato a
 * ogni render e cambierebbe quando cambiano i dati. E' lo stesso motivo per cui
 * `PersonalRecord` e' una tabella e non un calcolo (§9.3): la storia deve restare
 * quella che e' stata.
 */

import type { ID, ISODate, Equipment, MuscleGroup } from "./schema";

export type TrainerGoal = "strength" | "hypertrophy" | "recomp" | "maintenance";
export type TrainerLevel = "beginner" | "intermediate" | "advanced";

export type ProgressionRule =
  | "double-progression"
  | "reps-first"
  | "rpe-cap"
  | "hold-on-miss"
  | "deload-on-miss"
  | "planned-deload"
  | "skip-hold"
  /**
   * Il carico arriva dallo storico **fuori** dal programma e dentro il programma non
   * c'e' ancora nessuna serie: prima settimana, o esercizio mai registrato. Si riparte
   * da li' senza inventare una progressione che nessun dato sostiene.
   */
  | "carry-over"
  | "first-time"
  | "manual";

/** Le risposte al questionario — singleton. */
export interface TrainerProfile {
  id: "singleton";
  goal: TrainerGoal;
  /** massimo 2, puo' essere vuoto */
  priorityMuscles: MuscleGroup[];
  /** almeno uno */
  equipment: Equipment[];
  level: TrainerLevel;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: 45 | 60 | 75 | 90;
  answeredAt?: ISODate;
  /** questionario a meta': si riprende da qui */
  draftStep?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface TrainerExercise {
  exerciseId: ID;
  /** denormalizzato, come ovunque nello storico (§9.3) */
  exerciseName: string;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpeTarget: number;
  restSec: number;
  /** `null` = «prima volta», campo vuoto */
  suggestedWeightKg: number | null;
  /** il perche' di questo carico */
  decisionId?: ID;
}

export interface TrainerDay {
  id: ID;
  weekIndex: number;
  dayIndex: number;
  name: string;
  targetMuscles: MuscleGroup[];
  estimatedMinutes: number;
  status: "prevista" | "completata" | "saltata";
  /** la data suggerita, non un obbligo */
  plannedFor?: ISODate;
  /** la sessione che l'ha chiuso */
  sessionId?: ID;
  exercises: TrainerExercise[];
}

export interface TrainerWeek {
  /** 1-based */
  index: number;
  kind: "accumulo" | "intensificazione" | "scarico";
  status: "futura" | "in-corso" | "completata" | "saltata" | "ripetuta";
  days: TrainerDay[];
}

export interface TrainerProgram {
  id: ID;
  name: string;
  /**
   * Le risposte **al momento della generazione**: cambiare le risposte non riscrive
   * il passato.
   */
  profileSnapshot: TrainerProfile;
  goal: TrainerGoal;
  weeksTotal: number;
  currentWeek: number;
  status: "active" | "paused" | "completed" | "abandoned";
  createdAt: ISODate;
  startedAt: ISODate;
  pausedAt?: ISODate;
  completedAt?: ISODate;
  /** quale set di regole ha generato il programma */
  ruleSetVersion: number;
  weeks: TrainerWeek[];
}

export interface ProgressionDecision {
  id: ID;
  programId: ID;
  weekIndex: number;
  dayId: ID;
  exerciseId: ID;
  exerciseName: string;
  decidedAt: ISODate;
  rule: ProgressionRule;
  direction: "up" | "hold" | "down" | "deload" | "manual";
  fromWeightKg: number | null;
  toWeightKg: number | null;
  fromReps: [number, number] | null;
  toReps: [number, number] | null;
  /** i numeri che hanno attivato la regola */
  evidence: {
    /** link verificabili nel foglio (§4.25) */
    sessionIds: ID[];
    setsCompleted: number;
    setsPlanned: number;
    repsAchieved: number[];
    rpeObserved: (number | null)[];
  };
  /** la frase mostrata: «3 serie su 3 a RPE 7» */
  humanReason: string;
  /** «Completa 3x8 a RPE <= 8 e salgo a 85 kg» */
  nextStepHint: string;
  /** se l'utente ha detto «non sono d'accordo» */
  overriddenBy?: ID;
}
