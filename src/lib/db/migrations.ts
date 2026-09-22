import type Dexie from "dexie";
import type { Transaction } from "dexie";
import { normalizeName, type Exercise, type Session } from "./schema";

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

export const MIGRATIONS: Migration[] = [
  { version: 1, stores: STORES_V1, upgrade: backfillDerivedIndexes },
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
