import type Dexie from "dexie";
import type { Transaction } from "dexie";
import { LEGACY_LIBRARY_MAP } from "./library";
import {
  DEFAULT_SETTINGS,
  exerciseKey,
  normalizeName,
  type Exercise,
  type Session,
  type Settings,
} from "./schema";

export interface Migration {
  version: number;
  /** schema Dexie: `null` su una tabella la elimina */
  stores: Record<string, string | null>;
  /** trasformazione dei dati quando si arriva da una versione precedente */
  upgrade?: (tx: Transaction) => Promise<void>;
}

/**
 * Indici, e il perche' di ognuno.
 *
 * exercises
 *   `&nameKey`      unicita' del nome, accenti e maiuscole escluse: e' il vincolo che
 *                   rende il seed idempotente e che implementa "Esiste gia' un esercizio
 *                   con questo nome" nel dato, non solo nel form.
 *   `[muscleGroup+equipment]`  i due filtri della libreria (§4.8) si usano insieme.
 *   `*secondaryMuscles`        multiEntry: "cosa allena anche" senza scansione.
 *   `isCustom` NON e' indicizzato: IndexedDB non accetta i booleani come chiave.
 *                   Il conteggio dei personalizzati si fa in memoria, su qualche
 *                   centinaio di righe.
 *
 * routines
 *   `order`         la tab Allenamento legge le routine gia' ordinate.
 *   `[split+order]` le routine sono raggruppate per split con intestazione sticky.
 *
 * sessions
 *   `[status+startedAt]`  storico e sessione attiva sono sempre "stato + tempo".
 *   `*exerciseIds`        multiEntry derivato: e' cosi' che si trova la serie
 *                         PRECEDENTE di un esercizio senza scorrere tutto lo storico.
 *                         Le serie restano annidate nella sessione (fonte unica di
 *                         verita'), l'indice e' solo una scorciatoia di lettura.
 *
 * personalRecords
 *   `[exerciseId+kind]`   "qual e' il record di 1RM di questo esercizio" e' la domanda
 *                         che si fa a ogni serie completata.
 *
 * measurements
 *   `[metric+date]`       ogni grafico e' una metrica sull'asse del tempo.
 */
export const STORES_V1: Record<string, string> = {
  exercises:
    "id, &nameKey, name, muscleGroup, equipment, createdAt, [muscleGroup+equipment], *secondaryMuscles",
  routines: "id, order, name, split, updatedAt, lastPerformedAt, [split+order]",
  sessions:
    "id, status, startedAt, routineId, [status+startedAt], *exerciseIds",
  personalRecords:
    "id, exerciseId, sessionId, achievedAt, [exerciseId+kind], [exerciseId+achievedAt]",
  measurements: "id, metric, date, [metric+date]",
  settings: "id",
  appMeta: "key",
};

/**
 * `nameKey` ed `exerciseIds` sono campi *derivati* che esistono solo per essere
 * indicizzati. Ogni volta che una versione futura li tocchera', la migrazione dovra'
 * ricalcolarli sui dati gia' presenti: questa e' la funzione che lo fa, ed e' registrata
 * fin dalla v1 perche' non venga dimenticata.
 */
export async function backfillDerivedIndexes(tx: Transaction): Promise<void> {
  await tx
    .table<Exercise>("exercises")
    .toCollection()
    .modify((exercise) => {
      const nameKey = normalizeName(exercise.name ?? "");
      if (exercise.nameKey !== nameKey) exercise.nameKey = nameKey;
      if (!Array.isArray(exercise.secondaryMuscles)) exercise.secondaryMuscles = [];
    });

  await tx
    .table<Session>("sessions")
    .toCollection()
    .modify((session) => {
      const ids = deriveExerciseIds(session);
      if (!sameIds(session.exerciseIds, ids)) session.exerciseIds = ids;
    });
}

/** Indice multiEntry della sessione: gli esercizi che vi compaiono, senza ripetizioni. */
export function deriveExerciseIds(session: Pick<Session, "exercises">): string[] {
  const seen = new Set<string>();
  for (const exercise of session.exercises ?? []) {
    if (exercise?.exerciseId) seen.add(exercise.exerciseId);
  }
  return [...seen];
}

function sameIds(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < b.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * v2 — la libreria allargata (§9.4) e le tabelle del Trainer (§9.5).
 *
 * exercises
 *   `family` e `[family+equipment]`  il raggruppamento della libreria a filtro muscolo
 *                   attivo (§4.26) e la chiave con cui il seed riconosce una voce
 *                   **senza passare dal nome**: gli 81 esercizi della v1 si chiamavano
 *                   «Panca piana con bilanciere», adesso si chiamano «Panca piana
 *                   (Bilanciere)», e un seed che cercasse per nome li duplicherebbe.
 *   `popularity`    ordine di default della libreria.
 *
 * trainer*        quattro tabelle vuote. Non hanno UI in v2 e non ne avranno finche' non
 *                   arriva il Trainer: esistono perche' il formato del backup sale a 2
 *                   **adesso**, e un secondo cambio di formato fra sei settimane
 *                   obbligherebbe a ri-esportare tutto.
 *   `trainerDays` tiene i giorni anche in piano, oltre che annidati nel programma:
 *                   `/trainer/giorno/[id]` e' un deep link e deve poter leggere un
 *                   giorno per id senza scorrere tutti i programmi.
 */
export const STORES_V2: Record<string, string> = {
  exercises:
    "id, &nameKey, name, muscleGroup, equipment, family, popularity, createdAt, [muscleGroup+equipment], [family+equipment], *secondaryMuscles",
  trainerProfile: "id",
  trainerPrograms: "id, status, startedAt",
  trainerDays: "id, programId, status, plannedFor, sessionId, [programId+weekIndex]",
  trainerDecisions: "id, programId, exerciseId, decidedAt, [programId+decidedAt]",
};

/**
 * Migrazione v1 → v2. La regola sopra ogni altra: **chi ha gia' il database non deve
 * perdere niente.** Sessioni, record, misure e routine non si toccano nemmeno; degli
 * esercizi si riempiono i campi nuovi, e i personalizzati non si toccano mai (spec-v2 §3).
 */
export async function upgradeToV2(tx: Transaction): Promise<void> {
  await tx.table<Exercise>("exercises").toCollection().modify(fillV2ExerciseFields);

  /*
    Le impostazioni nuove del Trainer. `Settings` e' un singleton e non si sostituisce
    in blocco: si riempiono solo i campi che mancano, cosi' un valore che l'utente ha
    gia' scelto resta il suo.
  */
  await tx
    .table<Settings>("settings")
    .toCollection()
    .modify((settings) => {
      for (const key of TRAINER_SETTING_KEYS) {
        if (typeof settings[key] !== "number") {
          settings[key] = DEFAULT_SETTINGS[key];
        }
      }
    });
}

/**
 * Riempie i campi di §9.4 su un esercizio che arriva dalla v1, **in posto**.
 *
 * Vive qui e non dentro la migrazione perche' serve in due posti che devono dare lo
 * stesso risultato: l'upgrade del database e l'import di un backup `formatVersion: 1`.
 * Se divergessero, importare un backup vecchio produrrebbe esercizi senza `family` —
 * e il seed, non riconoscendoli, ne affiancherebbe 269 copie nuove.
 */
export function fillV2ExerciseFields(exercise: Exercise): void {
  const legacy = LEGACY_LIBRARY_MAP[exercise.id];

  if (legacy && !exercise.isCustom) {
    // Una voce di libreria della v1: prende la sua collocazione nella nuova.
    const [family, variant, equipment] = legacy.split("|");
    exercise.family = family;
    if (variant) exercise.variant = variant;
    exercise.equipment = equipment as Exercise["equipment"];
  } else {
    /*
      Personalizzato, o voce di libreria che non riconosco. `family` resta vuota:
      §9.4 dice che i personalizzati si raggruppano sotto «Personalizzati», e una
      famiglia inventata dal nome sarebbe una classificazione che l'utente non ha
      chiesto e che il seed poi userebbe per sovrascriverlo.
    */
    exercise.family ??= "";
  }

  exercise.mechanics ??= "compound";
  exercise.unilateral ??= false;
  exercise.loadMode ??= exercise.isBodyweight ? "bodyweight" : "external";
  exercise.popularity ??= 50;
  if (!Array.isArray(exercise.secondaryMuscles)) exercise.secondaryMuscles = [];

  // L'attrezzo entra nella chiave di unicita' (§9.4): si ricalcola sempre.
  exercise.nameKey = exerciseKey(exercise.name, exercise.equipment);
}

const TRAINER_SETTING_KEYS = [
  "trainerIncrementUpperKg",
  "trainerIncrementLowerKg",
  "trainerIncrementDumbbellKg",
  "trainerIncrementMachineKg",
  "trainerDeloadEveryWeeks",
  "trainerRpeCap",
] as const satisfies readonly (keyof Settings)[];

export const MIGRATIONS: Migration[] = [
  { version: 1, stores: STORES_V1, upgrade: backfillDerivedIndexes },
  { version: 2, stores: STORES_V2, upgrade: upgradeToV2 },
];

/**
 * Registra le versioni sul database, in ordine.
 *
 * Dexie non esegue l'`upgrade` della v1 su un database appena creato — e' corretto:
 * non c'e' niente da migrare. La funzione esiste e' registrata perche' un dispositivo
 * fermo a una versione precedente la trovi gia' al suo posto.
 */
export function applyMigrations(db: Dexie, migrations: Migration[] = MIGRATIONS): Dexie {
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    const version = db.version(migration.version).stores(migration.stores);
    if (migration.upgrade) version.upgrade(migration.upgrade);
  }
  return db;
}

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
