import { deriveExerciseIds } from "@/lib/db/migrations";
import { normalizeName } from "@/lib/db/schema";
import type {
  Exercise,
  ISODate,
  MeasurementEntry,
  PersonalRecord,
  Routine,
  Session,
  Settings,
} from "@/lib/db/schema";

/**
 * Formato del backup (spec §3.7).
 *
 * I dati vivono solo nel browser: il file di export **e'** la rete di sicurezza. Per
 * questo il formato e' versionato in modo esplicito (`formatVersion`) e separato dalla
 * versione dello schema Dexie (`schemaVersion`): un backup fatto oggi deve restare
 * leggibile da una versione futura dell'app, e una versione futura del file deve essere
 * **rifiutata con una frase chiara**, non letta a meta'.
 *
 * Regola di compatibilita': il parser accetta `formatVersion <= BACKUP_FORMAT_VERSION`,
 * ricostruisce i campi *derivati* (quelli che esistono solo per essere indicizzati) e
 * rifiuta tutto il resto prima di toccare il database.
 */

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupPayload {
  exercises: Exercise[];
  routines: Routine[];
  sessions: Session[];
  personalRecords: PersonalRecord[];
  measurements: MeasurementEntry[];
  settings: Settings | null;
}

export type BackupTable = Exclude<keyof BackupPayload, "settings">;

export const BACKUP_TABLES: readonly BackupTable[] = [
  "exercises",
  "routines",
  "sessions",
  "personalRecords",
  "measurements",
];

export interface LiftedBackup {
  app: "lifted";
  formatVersion: number;
  schemaVersion: number;
  exportedAt: ISODate;
  counts: Record<BackupTable, number>;
  data: BackupPayload;
}

export type BackupErrorCode = "not-lifted" | "future-version" | "malformed";

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "BackupError";
  }
}

export function buildBackup(
  payload: BackupPayload,
  meta: { exportedAt: ISODate; schemaVersion: number },
): LiftedBackup {
  return {
    app: "lifted",
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: meta.schemaVersion,
    exportedAt: meta.exportedAt,
    counts: {
      exercises: payload.exercises.length,
      routines: payload.routines.length,
      sessions: payload.sessions.length,
      personalRecords: payload.personalRecords.length,
      measurements: payload.measurements.length,
    },
    data: payload,
  };
}

export function serializeBackup(backup: LiftedBackup): string {
  return JSON.stringify(backup, null, 2);
}

function notLifted(): BackupError {
  return new BackupError("not-lifted", "Questo file non è un backup di Lifted.");
}

function malformed(detail: string): BackupError {
  return new BackupError(
    "malformed",
    "Questo backup è danneggiato e non può essere importato.",
    detail,
  );
}

function asRecordArray(value: unknown, table: BackupTable): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw malformed(`«${table}» non è una lista.`);
  return value.map((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw malformed(`«${table}», voce ${index + 1}: non è un oggetto.`);
    }
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id === "") {
      throw malformed(`«${table}», voce ${index + 1}: manca l'identificativo.`);
    }
    return record;
  });
}

/**
 * Legge un backup e lo **normalizza**: i campi derivati (`nameKey`, `exerciseIds`,
 * `secondaryMuscles`) vengono ricostruiti, cosi' un file scritto da una versione
 * precedente resta importabile senza migrazioni.
 *
 * Non scrive niente: se qualcosa non torna, lancia *prima* che il database venga toccato.
 */
export function parseBackup(text: string): LiftedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw notLifted();
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw notLifted();
  const root = raw as Record<string, unknown>;
  if (root.app !== "lifted") throw notLifted();

  const formatVersion = Number(root.formatVersion);
  if (!Number.isInteger(formatVersion) || formatVersion < 1) throw notLifted();
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      "future-version",
      "Questo backup viene da una versione più recente di Lifted. Aggiorna l'app prima di importarlo.",
    );
  }

  const data = root.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw malformed("Manca la sezione «data».");
  }
  const tables = data as Record<string, unknown>;

  const exercises = asRecordArray(tables.exercises, "exercises").map((row) => {
    const name = typeof row.name === "string" ? row.name : "";
    if (name.trim() === "") throw malformed("«exercises»: un esercizio è senza nome.");
    return {
      ...row,
      name,
      nameKey: normalizeName(name),
      secondaryMuscles: Array.isArray(row.secondaryMuscles) ? row.secondaryMuscles : [],
    } as unknown as Exercise;
  });

  const routines = asRecordArray(tables.routines, "routines").map((row) => {
    if (!Array.isArray(row.exercises)) {
      throw malformed("«routines»: una routine è senza elenco di esercizi.");
    }
    return row as unknown as Routine;
  });

  const sessions = asRecordArray(tables.sessions, "sessions").map((row) => {
    if (!Array.isArray(row.exercises)) {
      throw malformed("«sessions»: un allenamento è senza elenco di esercizi.");
    }
    if (typeof row.startedAt !== "string") {
      throw malformed("«sessions»: un allenamento è senza data di inizio.");
    }
    const session = row as unknown as Session;
    return { ...session, exerciseIds: deriveExerciseIds(session) };
  });

  const personalRecords = asRecordArray(
    tables.personalRecords,
    "personalRecords",
  ) as unknown as PersonalRecord[];

  const measurements = asRecordArray(tables.measurements, "measurements").map((row) => {
    if (typeof row.metric !== "string" || typeof row.date !== "string") {
      throw malformed("«measurements»: una misurazione è senza metrica o senza data.");
    }
    if (typeof row.value !== "number" || !Number.isFinite(row.value)) {
      throw malformed("«measurements»: una misurazione ha un valore non numerico.");
    }
    return row as unknown as MeasurementEntry;
  });

  const settingsRaw = tables.settings;
  const settings =
    settingsRaw && typeof settingsRaw === "object" && !Array.isArray(settingsRaw)
      ? ({ ...(settingsRaw as object), id: "singleton" } as Settings)
      : null;

  const payload: BackupPayload = {
    exercises,
    routines,
    sessions,
    personalRecords,
    measurements,
    settings,
  };

  return {
    app: "lifted",
    formatVersion,
    schemaVersion: Number(root.schemaVersion) || 1,
    exportedAt:
      typeof root.exportedAt === "string" ? root.exportedAt : new Date(0).toISOString(),
    counts: {
      exercises: exercises.length,
      routines: routines.length,
      sessions: sessions.length,
      personalRecords: personalRecords.length,
      measurements: measurements.length,
    },
    data: payload,
  };
}
