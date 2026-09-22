/**
 * Modello dati di Lifted — docs/design-system.md §9.
 *
 * Tre decisioni che la UI impone allo schema e che qui sono legge:
 *  1. `exerciseName` e' denormalizzato su `SessionExercise`: rinominare un esercizio
 *     non deve riscrivere lo storico.
 *  2. `prevWeightKg` / `prevReps` sono scritti sulla `SetEntry` alla creazione, non
 *     calcolati a ogni render: la colonna PRECEDENTE sta nel percorso critico.
 *  3. `PersonalRecord` e' una tabella, non un calcolo: serve sapere *quando* un record
 *     e' caduto e *quale* era il precedente.
 */

export type ID = string;
/** "2026-09-22T18:04:12.000Z" */
export type ISODate = string;

export type SetType = "normal" | "warmup" | "drop" | "failure";
export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "other";
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core";
export type PRKind = "e1rm" | "volume" | "reps";
export type SessionStatus = "active" | "completed" | "discarded";

export type MetricKey =
  | "bodyweight"
  | "bodyfat"
  | "arm"
  | "chest"
  | "waist"
  | "hips"
  | "thigh"
  | "calf";

export type PlateKg = 20 | 15 | 10 | 5 | 2.5 | 1.25;
export const PLATE_KGS: readonly PlateKg[] = [20, 15, 10, 5, 2.5, 1.25];

export interface Exercise {
  id: ID;
  name: string;
  /** chiave di unicita' normalizzata (indice unico `&nameKey`) */
  nameKey: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  isCustom: boolean;
  isBodyweight: boolean;
  notes?: string;
  defaultRestSec?: number;
  createdAt: ISODate;
  archivedAt?: ISODate;
}

export interface RoutineSetTemplate {
  type: SetType;
  targetWeightKg?: number | null;
  targetReps?: number | null;
  targetRpe?: number | null;
}

export interface RoutineExercise {
  exerciseId: ID;
  /** denormalizzato come in SessionExercise: l'editor non deve dipendere da una join */
  exerciseName: string;
  order: number;
  notes?: string;
  restSec?: number;
  sets: RoutineSetTemplate[];
}

export interface Routine {
  id: ID;
  name: string;
  split?: string;
  order: number;
  exercises: RoutineExercise[];
  createdAt: ISODate;
  updatedAt: ISODate;
  lastPerformedAt?: ISODate;
}

export interface SetEntry {
  id: ID;
  index: number;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  rpe?: number | null;
  completed: boolean;
  completedAt?: ISODate;
  prevWeightKg?: number | null;
  prevReps?: number | null;
  prIds?: ID[];
}

export interface SessionExercise {
  id: ID;
  exerciseId: ID;
  /** nome al momento della sessione (§9.3) */
  exerciseName: string;
  equipment: Equipment;
  order: number;
  notes?: string;
  restSec: number;
  sets: SetEntry[];
}

export interface Session {
  id: ID;
  routineId?: ID;
  routineName?: string;
  startedAt: ISODate;
  endedAt?: ISODate;
  status: SessionStatus;
  /** millisecondi di pausa gia' accumulati sul cronometro */
  pausedMs: number;
  /** istante in cui il cronometro e' stato messo in pausa, se in pausa */
  pausedAt?: ISODate | null;
  notes?: string;
  exercises: SessionExercise[];
  totalVolumeKg: number;
  totalSets: number;
  durationSec: number;
  /** timer di recupero: si ricalcola sempre da qui + Date.now(), mai dal tick */
  restStartedAt?: ISODate | null;
  restDurationSec?: number | null;
  restPausedAt?: ISODate | null;
  restPausedMs?: number;
  /** indice multiEntry: quali esercizi compaiono nella sessione */
  exerciseIds: ID[];
}

export interface PersonalRecord {
  id: ID;
  exerciseId: ID;
  kind: PRKind;
  value: number;
  weightKg?: number;
  reps?: number;
  sessionId: ID;
  setId: ID;
  achievedAt: ISODate;
  previousValue?: number;
}

export interface MeasurementEntry {
  id: ID;
  metric: MetricKey;
  value: number;
  unit: "kg" | "%" | "cm";
  date: ISODate;
  note?: string;
}

export interface Settings {
  id: "singleton";
  unit: "kg";
  defaultRestSec: number;
  restAutoStart: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showRpe: boolean;
  e1rmFormula: "epley" | "brzycki";
  barWeightKg: number;
  plateInventory: Record<string, number>;
  stepKg: number;
  stepKgFine: number;
  warmupPercents: number[];
  lastExportAt?: ISODate;
  onboardingSeenAt?: ISODate;
  schemaVersion: number;
}

/** Bookkeeping di sistema (versione del seed, ecc.) — non e' roba dell'utente. */
export interface AppMeta {
  key: string;
  value: string | number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  unit: "kg",
  defaultRestSec: 90,
  restAutoStart: true,
  soundEnabled: true,
  vibrationEnabled: true,
  showRpe: false,
  e1rmFormula: "epley",
  barWeightKg: 20,
  plateInventory: { "20": 8, "15": 2, "10": 4, "5": 4, "2.5": 4, "1.25": 4 },
  stepKg: 2.5,
  stepKgFine: 1.25,
  warmupPercents: [0.5, 0.7, 0.875],
  schemaVersion: 1,
};

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "Petto",
  back: "Dorso",
  shoulders: "Spalle",
  legs: "Gambe",
  arms: "Braccia",
  core: "Core",
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Bilanciere",
  dumbbell: "Manubri",
  cable: "Cavi",
  machine: "Macchinario",
  bodyweight: "Corpo libero",
  other: "Altro",
};

export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: "Normale",
  warmup: "Riscaldamento (W)",
  drop: "Drop set (D)",
  failure: "Cedimento (F)",
};

export const SET_TYPE_GLYPH: Record<Exclude<SetType, "normal">, string> = {
  warmup: "W",
  drop: "D",
  failure: "F",
};

/** Chiave di unicita' del nome esercizio: accenti e maiuscole non fanno differenza. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}
