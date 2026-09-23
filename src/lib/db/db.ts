import Dexie, { type EntityTable } from "dexie";
import { applyMigrations } from "./migrations";
import type {
  AppMeta,
  Exercise,
  MeasurementEntry,
  PersonalRecord,
  Routine,
  Session,
  Settings,
} from "./schema";
import type {
  ProgressionDecision,
  TrainerDay,
  TrainerProfile,
  TrainerProgram,
} from "./trainer-schema";

export class LiftedDB extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  routines!: EntityTable<Routine, "id">;
  sessions!: EntityTable<Session, "id">;
  personalRecords!: EntityTable<PersonalRecord, "id">;
  measurements!: EntityTable<MeasurementEntry, "id">;
  settings!: EntityTable<Settings, "id">;
  appMeta!: EntityTable<AppMeta, "key">;

  /**
   * Tabelle del Trainer (§9.5). **Nessuna schermata le legge in v2** — esistono perche'
   * il backup sale a `formatVersion: 2` in questo intervento e non si cambia formato
   * due volte. Si esportano e si importano vuote.
   */
  trainerProfile!: EntityTable<TrainerProfile, "id">;
  trainerPrograms!: EntityTable<TrainerProgram, "id">;
  trainerDays!: EntityTable<TrainerDay & { programId: string }, "id">;
  trainerDecisions!: EntityTable<ProgressionDecision, "id">;

  constructor(name = "lifted") {
    super(name);
    applyMigrations(this);
  }
}

let instance: LiftedDB | null = null;

/**
 * Istanza condivisa. Pigra: si crea al primo accesso, cosi' importare questo modulo
 * durante il render sul server non tocca IndexedDB.
 */
export function getDb(): LiftedDB {
  if (!instance) instance = new LiftedDB();
  return instance;
}

/** Solo per i test: un database isolato e usa e getta. */
export function createTestDb(name: string): LiftedDB {
  return new LiftedDB(name);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
