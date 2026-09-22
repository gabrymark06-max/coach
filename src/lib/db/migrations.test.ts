import "fake-indexeddb/auto";
import Dexie, { type Transaction } from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "./db";
import {
  applyMigrations,
  backfillDerivedIndexes,
  deriveExerciseIds,
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  type Migration,
} from "./migrations";
import type { Session } from "./schema";

const opened: Dexie[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

function track<T extends Dexie>(db: T): T {
  opened.push(db);
  return db;
}

describe("applyMigrations", () => {
  it("registra tutte le versioni dichiarate", async () => {
    const db = track(createTestDb(`lifted-mig-${Math.random().toString(36).slice(2)}`));
    await db.open();
    expect(db.verno).toBe(LATEST_SCHEMA_VERSION);
  });

  it("crea tutte le tabelle del modello, comprese quelle del secondo passaggio", async () => {
    const db = track(createTestDb(`lifted-mig-${Math.random().toString(36).slice(2)}`));
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "appMeta",
      "exercises",
      "measurements",
      "personalRecords",
      "routines",
      "sessions",
      "settings",
    ]);
  });

  it("registra le versioni in ordine anche se l'elenco e' disordinato", async () => {
    const name = `lifted-order-${Math.random().toString(36).slice(2)}`;
    const migrations: Migration[] = [
      { version: 2, stores: { a: "id", b: "id" } },
      { version: 1, stores: { a: "id" } },
    ];
    const db = track(applyMigrations(new Dexie(name), migrations));
    await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name).sort()).toEqual(["a", "b"]);
  });

  it("la v1 dichiara una funzione di upgrade", () => {
    expect(typeof MIGRATIONS[0].upgrade).toBe("function");
  });
});

describe("la macchina delle migrazioni esegue davvero gli upgrade", () => {
  it("un database fermo a una versione precedente viene trasformato all'apertura", async () => {
    const name = `lifted-upgrade-${Math.random().toString(36).slice(2)}`;

    // Dispositivo fermo alla v1: scrive due righe e chiude.
    const v1 = applyMigrations(new Dexie(name), [
      { version: 1, stores: { widgets: "id, name" } },
    ]);
    await v1.open();
    await v1.table("widgets").bulkAdd([
      { id: "a", name: "Panca" },
      { id: "b", name: "Squat" },
    ]);
    v1.close();

    // L'app si aggiorna: la v2 aggiunge un indice derivato e lo riempie sui dati vecchi.
    let upgradeRan = false;
    const v2 = track(
      applyMigrations(new Dexie(name), [
        { version: 1, stores: { widgets: "id, name" } },
        {
          version: 2,
          stores: { widgets: "id, name, nameKey", notes: "id" },
          upgrade: async (tx: Transaction) => {
            upgradeRan = true;
            await tx
              .table("widgets")
              .toCollection()
              .modify((widget: { name: string; nameKey?: string }) => {
                widget.nameKey = widget.name.toLowerCase();
              });
          },
        },
      ]),
    );
    await v2.open();

    expect(upgradeRan).toBe(true);
    expect(v2.verno).toBe(2);
    // i dati vecchi sopravvivono e sono stati trasformati
    expect(await v2.table("widgets").count()).toBe(2);
    expect(await v2.table("widgets").where("nameKey").equals("squat").first()).toMatchObject(
      { id: "b" },
    );
    // e la tabella nuova esiste
    expect(v2.tables.map((t) => t.name)).toContain("notes");
  });
});

describe("deriveExerciseIds", () => {
  it("raccoglie gli id degli esercizi della sessione senza ripetizioni", () => {
    const session = {
      exercises: [
        { exerciseId: "x" },
        { exerciseId: "y" },
        { exerciseId: "x" },
      ],
    } as Pick<Session, "exercises">;
    expect(deriveExerciseIds(session)).toEqual(["x", "y"]);
  });

  it("su una sessione vuota restituisce una lista vuota", () => {
    expect(deriveExerciseIds({ exercises: [] } as Pick<Session, "exercises">)).toEqual([]);
  });
});

describe("backfillDerivedIndexes", () => {
  it("ricalcola nameKey ed exerciseIds sui dati gia' presenti", async () => {
    const db = track(createTestDb(`lifted-fill-${Math.random().toString(36).slice(2)}`));
    await db.open();

    await db.exercises.add({
      id: "e1",
      name: "  Panca Piana con Bilanciere ",
      nameKey: "sbagliata",
      muscleGroup: "chest",
      secondaryMuscles: [],
      equipment: "barbell",
      isCustom: false,
      isBodyweight: false,
      createdAt: new Date().toISOString(),
    });
    await db.sessions.add({
      id: "s1",
      startedAt: new Date().toISOString(),
      status: "completed",
      pausedMs: 0,
      exercises: [
        {
          id: "se1",
          exerciseId: "e1",
          exerciseName: "Panca piana con bilanciere",
          equipment: "barbell",
          order: 0,
          restSec: 90,
          sets: [],
        },
      ],
      totalVolumeKg: 0,
      totalSets: 0,
      durationSec: 0,
      exerciseIds: [],
    });

    await db.transaction("rw", db.exercises, db.sessions, async () => {
      await backfillDerivedIndexes(Dexie.currentTransaction as Transaction);
    });

    expect((await db.exercises.get("e1"))?.nameKey).toBe("panca piana con bilanciere");
    expect((await db.sessions.get("s1"))?.exerciseIds).toEqual(["e1"]);
  });
});
