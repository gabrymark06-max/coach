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

/**
 * Attrezzi — **da 6 a 15 in v2** (§9.4). Ampliata, non sostituita: i sei valori della
 * v1 sono ancora qui con lo stesso nome, quindi nessun esercizio gia' salvato cambia
 * significato. Ogni combinazione movimento x attrezzo e' un esercizio distinto: e'
 * questa lista che decide quante voci ha la libreria.
 */
export type Equipment =
  | "barbell"
  | "ez-bar"
  | "dumbbell"
  | "cable"
  | "machine"
  | "smith"
  | "bodyweight"
  | "weighted"
  | "assisted-machine"
  | "kettlebell"
  | "band"
  | "trap-bar"
  | "medicine-ball"
  | "plate"
  | "other";

/** Gruppi muscolari — **da 6 a 8 in v2**: trapezi e full body escono da «dorso». */
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core"
  | "traps"
  | "fullbody";

/**
 * Come si carica l'esercizio. Non e' un dettaglio estetico: decide se il campo KG parte
 * vuoto, se il peso va sommato a quello corporeo e, in futuro, cosa puo' proporre il
 * Trainer con l'attrezzatura dichiarata.
 */
export type LoadMode = "external" | "bodyweight" | "weighted-bodyweight" | "assisted";

/** Fondamentale o complementare: serve all'ordinamento e alla generazione futura. */
export type Mechanics = "compound" | "isolation";
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
  /**
   * Chiave di unicita' normalizzata (indice unico `&nameKey`).
   *
   * **In v2 include l'attrezzo** (§9.4). Senza, `Panca piana (Bilanciere)` e
   * `Panca piana (Manubri)` collidono appena qualcuno ne scrive uno senza parentesi, e
   * il seed perde silenziosamente una voce sull'indice unico. Si costruisce sempre con
   * `exerciseKey`, mai a mano.
   */
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

  // --- v2, §9.4 ---
  /**
   * Famiglia di movimento: `panca-piana` tiene insieme bilanciere, manubri, Smith e
   * macchina. E' il raggruppamento della libreria quando c'e' un filtro muscolo attivo
   * (§4.26) — un campo, non una deduzione dal nome. Vuota sui personalizzati.
   */
  family: string;
  /** qualifica di presa o di angolo: `presa inversa`, `corda`, `su panca declinata` */
  variant?: string;
  mechanics: Mechanics;
  /** un braccio o una gamba per volta: il volume si conta per lato */
  unilateral: boolean;
  loadMode: LoadMode;
  /** incremento minimo dell'attrezzo: una macchina a tacche non fa 2,5 kg */
  stepKgOverride?: number;
  /** ordine di default nella libreria: prima quelli che si usano davvero */
  popularity: number;
  /**
   * **Previsto dallo schema, mai mostrato in v2** (spec-v2 §4). Nessuna schermata deve
   * promettere un video che non c'e': non esiste una riga di UI che legga questo campo.
   */
  videoUrl?: string | null;
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
  /**
   * Il giorno del programma che questa sessione ha chiuso (§9.5). E' **l'unico** campo
   * che la sessione guadagna con il Trainer: senza, la progressione non saprebbe su
   * quali esercizi girare. In v2 non lo scrive nessuno.
   */
  trainerDayId?: ID;
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
  /** il record che questo ha battuto: serve per dire "112 kg, +4 sul record" */
  previousValue?: number;
  previousAchievedAt?: ISODate;
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

  /**
   * Incrementi del Trainer (§9.5) — **impostazioni, non costanti nel codice**: chi si
   * allena in una palestra con i manubri da 2 kg deve poterlo dire. Il Trainer non
   * esiste ancora in v2 e questi valori non hanno ancora una schermata; vivono qui
   * perche' lo schema e il backup li portano gia', e non si cambia formato due volte.
   */
  trainerIncrementUpperKg: number;
  trainerIncrementLowerKg: number;
  trainerIncrementDumbbellKg: number;
  trainerIncrementMachineKg: number;
  trainerDeloadEveryWeeks: number;
  trainerRpeCap: number;
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
  trainerIncrementUpperKg: 2.5,
  trainerIncrementLowerKg: 5,
  trainerIncrementDumbbellKg: 2,
  trainerIncrementMachineKg: 5,
  trainerDeloadEveryWeeks: 4,
  trainerRpeCap: 9.5,
};

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "Petto",
  back: "Dorso",
  shoulders: "Spalle",
  arms: "Braccia",
  legs: "Gambe",
  core: "Core",
  traps: "Trapezi",
  fullbody: "Full body",
};

/** Ordine in cui i gruppi compaiono nella libreria: dall'alto in basso del corpo. */
export const MUSCLE_GROUP_ORDER: readonly MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "traps",
  "arms",
  "legs",
  "core",
  "fullbody",
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Bilanciere",
  "ez-bar": "Bilanciere EZ",
  dumbbell: "Manubri",
  cable: "Cavi",
  machine: "Macchina",
  smith: "Smith machine",
  bodyweight: "Corpo libero",
  weighted: "Zavorrato",
  "assisted-machine": "Macchina assistita",
  kettlebell: "Kettlebell",
  band: "Bande",
  "trap-bar": "Trap bar",
  "medicine-ball": "Palla medica",
  plate: "Disco",
  other: "Attrezzo specifico",
};

export const EQUIPMENT_ORDER: readonly Equipment[] = [
  "barbell",
  "ez-bar",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith",
  "bodyweight",
  "weighted",
  "assisted-machine",
  "band",
  "trap-bar",
  "medicine-ball",
  "plate",
  "other",
];

/**
 * L'incremento minimo che l'attrezzo permette davvero. Una macchina a tacche non fa
 * 2,5 kg, e una coppia di manubri sale di 2 per volta: proporre 82,5 kg su una pila
 * di pesi e' una bugia gentile. `stepKgOverride` sull'esercizio vince su questa tabella.
 */
export const EQUIPMENT_STEP_KG: Partial<Record<Equipment, number>> = {
  machine: 5,
  "assisted-machine": 5,
  dumbbell: 2,
  cable: 2.5,
};

/**
 * Come si carica, dedotto dall'attrezzo quando l'esercizio non dice altro.
 * `weighted` e' il corpo libero con una cintura, `assisted-machine` e' il corpo libero
 * con un contrappeso: sono tre modi diversi di scrivere un numero nel campo KG.
 */
export const EQUIPMENT_LOAD_MODE: Partial<Record<Equipment, LoadMode>> = {
  bodyweight: "bodyweight",
  weighted: "weighted-bodyweight",
  "assisted-machine": "assisted",
};

/**
 * Chiave di unicita' di un esercizio: **nome + attrezzo** (§9.4).
 *
 * Era il solo nome, e bastava a far collidere `Panca piana (Bilanciere)` con una
 * `Panca piana` scritta a mano dall'utente. Con ~300 voci generate per combinazione
 * movimento x attrezzo, il nome da solo non e' piu' un'identita'.
 */
export function exerciseKey(name: string, equipment: Equipment): string {
  return `${normalizeName(name)}|${equipment}`;
}

export const METRIC_LABEL: Record<MetricKey, string> = {
  bodyweight: "Peso corporeo",
  bodyfat: "Massa grassa",
  arm: "Braccia",
  chest: "Torace",
  waist: "Vita",
  hips: "Fianchi",
  thigh: "Cosce",
  calf: "Polpacci",
};

export const METRIC_UNIT: Record<MetricKey, "kg" | "%" | "cm"> = {
  bodyweight: "kg",
  bodyfat: "%",
  arm: "cm",
  chest: "cm",
  waist: "cm",
  hips: "cm",
  thigh: "cm",
  calf: "cm",
};

/** Ordine in cui le metriche compaiono nella tab Misure: prima il corpo, poi le parti. */
export const METRIC_ORDER: readonly MetricKey[] = [
  "bodyweight",
  "bodyfat",
  "arm",
  "chest",
  "waist",
  "hips",
  "thigh",
  "calf",
];

/** Limiti di validazione, per metrica (§5.3: ogni errore dice cosa fare). */
export const METRIC_RANGE: Record<MetricKey, { min: number; max: number }> = {
  bodyweight: { min: 20, max: 400 },
  bodyfat: { min: 1, max: 70 },
  arm: { min: 10, max: 100 },
  chest: { min: 40, max: 200 },
  waist: { min: 40, max: 200 },
  hips: { min: 40, max: 200 },
  thigh: { min: 20, max: 120 },
  calf: { min: 15, max: 80 },
};

export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: "Normale",
  warmup: "Riscaldamento (W)",
  drop: "Drop set (D)",
  failure: "Cedimento (F)",
};

/**
 * Il tipo **detto a voce**: senza sigla, senza parentesi, minuscolo perche' entra in
 * mezzo a una frase. `SET_TYPE_LABEL` resta quello che si legge a schermo, dove la
 * sigla serve a collegare l'etichetta alla lettera della cella (QA MINORE 4).
 */
export const SET_TYPE_SPEECH: Record<SetType, string> = {
  normal: "normale",
  warmup: "riscaldamento",
  drop: "drop set",
  failure: "cedimento",
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
