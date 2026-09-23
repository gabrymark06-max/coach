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
import { seedLibrary } from "./seed";
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
      "trainerDays",
      "trainerDecisions",
      "trainerProfile",
      "trainerPrograms",
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
      family: "panca-piana",
      mechanics: "compound",
      unilateral: false,
      loadMode: "external",
      popularity: 50,
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

/**
 * La prova che conta: un dispositivo con il database della v1 — esercizi di libreria,
 * sessioni, record, misure, un esercizio personalizzato e le impostazioni gia' toccate —
 * apre la v2 e **non perde niente**.
 *
 * Si ricostruisce il database v1 con lo schema v1 vero (`MIGRATIONS[0]`), non con quello
 * nuovo: un test che parte gia' migrato non dimostra niente.
 */
describe("v1 verso v2 su un database popolato", () => {
  const V1_EXERCISES = [
    {
      id: "lib-panca-piana-con-bilanciere",
      name: "Panca piana con bilanciere",
      nameKey: "panca piana con bilanciere",
      muscleGroup: "chest",
      secondaryMuscles: ["shoulders", "arms"],
      equipment: "barbell",
      isCustom: false,
      isBodyweight: false,
      createdAt: "2026-01-01T10:00:00.000Z",
      defaultRestSec: 150,
      notes: "presa a 81 cm",
    },
    {
      id: "lib-scrollate-con-bilanciere",
      name: "Scrollate con bilanciere",
      nameKey: "scrollate con bilanciere",
      muscleGroup: "back",
      secondaryMuscles: ["shoulders"],
      equipment: "barbell",
      isCustom: false,
      isBodyweight: false,
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "lib-curl-con-bilanciere-ez",
      name: "Curl con bilanciere EZ",
      nameKey: "curl con bilanciere ez",
      muscleGroup: "arms",
      secondaryMuscles: [],
      equipment: "barbell",
      isCustom: false,
      isBodyweight: false,
      createdAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "custom-kroc",
      name: "Rematore Kroc",
      nameKey: "rematore kroc",
      muscleGroup: "back",
      secondaryMuscles: [],
      equipment: "dumbbell",
      isCustom: true,
      isBodyweight: false,
      createdAt: "2026-02-02T10:00:00.000Z",
      notes: "cinghie",
    },
  ];

  async function buildV1(name: string) {
    const v1 = applyMigrations(new Dexie(name), [MIGRATIONS[0]]);
    await v1.open();
    await v1.table("exercises").bulkAdd(V1_EXERCISES);
    await v1.table("sessions").add({
      id: "s-vecchia",
      routineName: "Push A",
      startedAt: "2026-03-01T18:00:00.000Z",
      endedAt: "2026-03-01T19:30:00.000Z",
      status: "completed",
      pausedMs: 0,
      exercises: [
        {
          id: "se1",
          exerciseId: "lib-panca-piana-con-bilanciere",
          exerciseName: "Panca piana con bilanciere",
          equipment: "barbell",
          order: 0,
          restSec: 150,
          sets: [
            { id: "set1", index: 1, type: "normal", weightKg: 100, reps: 5, completed: true },
          ],
        },
      ],
      totalVolumeKg: 500,
      totalSets: 1,
      durationSec: 5400,
      exerciseIds: ["lib-panca-piana-con-bilanciere"],
    });
    await v1.table("personalRecords").add({
      id: "pr1",
      exerciseId: "lib-panca-piana-con-bilanciere",
      kind: "e1rm",
      value: 116.7,
      sessionId: "s-vecchia",
      setId: "set1",
      achievedAt: "2026-03-01T18:30:00.000Z",
    });
    await v1.table("measurements").add({
      id: "m1",
      metric: "bodyweight",
      value: 82.4,
      unit: "kg",
      date: "2026-03-01T07:00:00.000Z",
    });
    await v1.table("routines").add({
      id: "r1",
      name: "Push A",
      order: 0,
      exercises: [
        {
          exerciseId: "lib-panca-piana-con-bilanciere",
          exerciseName: "Panca piana con bilanciere",
          order: 0,
          sets: [{ type: "normal" }],
        },
      ],
      createdAt: "2026-01-05T10:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
    });
    await v1.table("settings").put({
      id: "singleton",
      unit: "kg",
      defaultRestSec: 120,
      restAutoStart: true,
      soundEnabled: true,
      vibrationEnabled: true,
      showRpe: true,
      e1rmFormula: "brzycki",
      barWeightKg: 15,
      plateInventory: { "20": 6, "15": 2, "10": 4, "5": 4, "2.5": 4, "1.25": 4 },
      stepKg: 2.5,
      stepKgFine: 1.25,
      warmupPercents: [0.5, 0.7, 0.875],
      schemaVersion: 1,
    });
    await v1.table("appMeta").put({ key: "seed.libraryVersion", value: 1 });
    v1.close();
  }

  it("storico, record, misure e routine arrivano intatti dall'altra parte", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();
    expect(db.verno).toBe(2);

    const session = await db.sessions.get("s-vecchia");
    expect(session?.totalVolumeKg).toBe(500);
    expect(session?.exercises[0].sets[0].weightKg).toBe(100);
    expect(await db.personalRecords.get("pr1")).toMatchObject({ value: 116.7 });
    expect(await db.measurements.get("m1")).toMatchObject({ value: 82.4 });
    expect((await db.routines.get("r1"))?.exercises[0].exerciseId).toBe(
      "lib-panca-piana-con-bilanciere",
    );
  });

  it("gli esercizi della v1 entrano nella libreria nuova invece di essere duplicati", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();
    await seedLibrary(db);

    // la voce di prima e' ancora quella, con lo stesso id a cui punta lo storico
    const panca = await db.exercises.get("lib-panca-piana-con-bilanciere");
    expect(panca?.family).toBe("panca-piana");
    expect(panca?.name).toBe("Panca piana (Bilanciere)");
    expect(panca?.defaultRestSec).toBe(150);
    expect(panca?.notes).toBe("presa a 81 cm");

    // e non ne e' comparsa una seconda con lo stesso posto in libreria
    const stessaFamiglia = await db.exercises
      .where("[family+equipment]")
      .equals(["panca-piana", "barbell"])
      .toArray();
    expect(stessaFamiglia).toHaveLength(1);
  });

  it("i trapezi escono da dorso e il bilanciere EZ smette di chiamarsi bilanciere", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();
    await seedLibrary(db);

    expect((await db.exercises.get("lib-scrollate-con-bilanciere"))?.muscleGroup).toBe("traps");
    expect((await db.exercises.get("lib-curl-con-bilanciere-ez"))?.equipment).toBe("ez-bar");
  });

  it("l'esercizio personalizzato resta intoccato, seed compreso", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();
    await seedLibrary(db);

    const kroc = await db.exercises.get("custom-kroc");
    expect(kroc?.name).toBe("Rematore Kroc");
    expect(kroc?.notes).toBe("cinghie");
    expect(kroc?.family).toBe("");
    expect(kroc?.isCustom).toBe(true);
  });

  it("le impostazioni dell'utente restano sue, e quelle nuove compaiono", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();

    const settings = await db.settings.get("singleton");
    expect(settings?.defaultRestSec).toBe(120);
    expect(settings?.barWeightKg).toBe(15);
    expect(settings?.e1rmFormula).toBe("brzycki");
    expect(settings?.trainerRpeCap).toBe(9.5);
    expect(settings?.trainerIncrementLowerKg).toBe(5);
  });

  it("l'attrezzo entra nella chiave di unicita' di tutti, personalizzati compresi", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();

    expect((await db.exercises.get("custom-kroc"))?.nameKey).toBe("rematore kroc|dumbbell");
  });

  it("il seed gira due volte senza cambiare niente la seconda", async () => {
    const name = `lifted-v1v2-${Math.random().toString(36).slice(2)}`;
    await buildV1(name);

    const db = track(createTestDb(name));
    await db.open();
    await seedLibrary(db);
    const conteggio = await db.exercises.count();
    const secondo = await seedLibrary(db);

    expect(secondo.added).toBe(0);
    expect(secondo.updated).toBe(0);
    expect(await db.exercises.count()).toBe(conteggio);
  });
});
