import {
  BACKUP_TABLES,
  buildBackup,
  type BackupPayload,
  type BackupTable,
  type LiftedBackup,
} from "@/lib/backup/format";
import { nowIso, type LiftedDB } from "./db";
import { LATEST_SCHEMA_VERSION } from "./migrations";
import { rebuildPersonalRecords } from "./pr-ops";
import { DEFAULT_SETTINGS, type Settings } from "./schema";

/**
 * Export e ripristino (spec §3.7).
 *
 * Il ripristino e' l'operazione piu' pericolosa dell'app: cancella tutto e rimette il
 * contenuto di un file. Per questo:
 *
 *  - il file viene **letto e validato per intero prima** (`parseBackup`), fuori da qui;
 *  - la scrittura sta in **una sola transazione Dexie** su tutte le tabelle: se una
 *    `bulkAdd` fallisce a meta' — un id duplicato, un nome che viola l'indice unico —
 *    IndexedDB annulla l'intera transazione e sul dispositivo resta quello che c'era.
 *    Non esiste uno stato "meta' importato".
 */

export type TableCounts = Record<BackupTable, number>;

export async function tableCounts(db: LiftedDB): Promise<TableCounts> {
  const [exercises, routines, sessions, personalRecords, measurements] =
    await Promise.all([
      db.exercises.count(),
      db.routines.count(),
      db.sessions.count(),
      db.personalRecords.count(),
      db.measurements.count(),
    ]);
  return { exercises, routines, sessions, personalRecords, measurements };
}

export async function readBackupPayload(db: LiftedDB): Promise<BackupPayload> {
  const [exercises, routines, sessions, personalRecords, measurements, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.routines.toArray(),
      db.sessions.toArray(),
      db.personalRecords.toArray(),
      db.measurements.toArray(),
      db.settings.get("singleton"),
    ]);
  return {
    exercises,
    routines,
    // Una sessione ancora aperta non e' storia: non finisce in un backup.
    sessions: sessions.filter((session) => session.status === "completed"),
    personalRecords,
    measurements,
    settings: settings ?? null,
  };
}

export async function createBackup(db: LiftedDB): Promise<LiftedBackup> {
  const payload = await readBackupPayload(db);
  return buildBackup(payload, {
    exportedAt: nowIso(),
    schemaVersion: LATEST_SCHEMA_VERSION,
  });
}

export interface RestoreResult {
  counts: TableCounts;
  /** record ricalcolati perche' il backup non ne conteneva */
  rebuiltRecords: number;
}

/**
 * Sostituisce **tutti** i dati con quelli del backup, in transazione.
 *
 * Le impostazioni si fondono con quelle predefinite invece di essere sostituite in
 * blocco: un backup vecchio non deve far sparire un'impostazione introdotta dopo.
 */
export async function restoreBackup(
  db: LiftedDB,
  backup: LiftedBackup,
): Promise<RestoreResult> {
  const data = backup.data;

  await db.transaction(
    "rw",
    [db.exercises, db.routines, db.sessions, db.personalRecords, db.measurements, db.settings],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.routines.clear(),
        db.sessions.clear(),
        db.personalRecords.clear(),
        db.measurements.clear(),
      ]);

      if (data.exercises.length > 0) await db.exercises.bulkAdd(data.exercises);
      if (data.routines.length > 0) await db.routines.bulkAdd(data.routines);
      if (data.sessions.length > 0) await db.sessions.bulkAdd(data.sessions);
      if (data.personalRecords.length > 0) {
        await db.personalRecords.bulkAdd(data.personalRecords);
      }
      if (data.measurements.length > 0) await db.measurements.bulkAdd(data.measurements);

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...(data.settings ?? {}),
        id: "singleton",
        schemaVersion: LATEST_SCHEMA_VERSION,
      };
      await db.settings.put(settings);
    },
  );

  // Un backup di una versione senza record personali non deve restare senza record:
  // si ricalcolano dallo storico appena importato.
  let rebuiltRecords = 0;
  if (data.personalRecords.length === 0 && data.sessions.length > 0) {
    const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
    rebuiltRecords = await rebuildPersonalRecords(db, settings.e1rmFormula);
  }

  return { counts: await tableCounts(db), rebuiltRecords };
}

/** «Cancella tutto»: resta solo la libreria di base, che si ricarica al riavvio. */
export async function wipeAllData(db: LiftedDB): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.exercises,
      db.routines,
      db.sessions,
      db.personalRecords,
      db.measurements,
      db.settings,
      db.appMeta,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.routines.clear(),
        db.sessions.clear(),
        db.personalRecords.clear(),
        db.measurements.clear(),
        db.settings.clear(),
        db.appMeta.clear(),
      ]);
    },
  );
}

export { BACKUP_TABLES };
