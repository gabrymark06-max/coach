import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type LiftedDB } from "./db";
import { LIBRARY, LIBRARY_META_KEY, LIBRARY_VERSION } from "./library";
import { ensureSeeded, seedLibrary } from "./seed";
import { normalizeName } from "./schema";

let db: LiftedDB;
let dbName = "";

beforeEach(async () => {
  dbName = `lifted-seed-${Math.random().toString(36).slice(2)}`;
  db = createTestDb(dbName);
  await db.open();
});

afterEach(async () => {
  db.close();
  await createTestDb(dbName).delete();
});

describe("seedLibrary", () => {
  it("carica tutta la libreria al primo giro", async () => {
    const result = await seedLibrary(db);
    expect(result.added).toBe(LIBRARY.length);
    expect(await db.exercises.count()).toBe(LIBRARY.length);
  });

  it("i nomi sono in italiano e ogni esercizio ha muscolo e attrezzo", async () => {
    await seedLibrary(db);
    const panca = await db.exercises.get("lib-panca-piana-con-bilanciere");
    expect(panca?.name).toBe("Panca piana con bilanciere");
    expect(panca?.muscleGroup).toBe("chest");
    expect(panca?.equipment).toBe("barbell");
    expect(panca?.isCustom).toBe(false);
  });

  it("copre tutti e sei i gruppi muscolari e tutte e cinque le attrezzature della spec", async () => {
    await seedLibrary(db);
    const all = await db.exercises.toArray();
    const groups = new Set(all.map((e) => e.muscleGroup));
    const equipment = new Set(all.map((e) => e.equipment));
    expect([...groups].sort()).toEqual([
      "arms",
      "back",
      "chest",
      "core",
      "legs",
      "shoulders",
    ]);
    for (const kind of ["barbell", "dumbbell", "cable", "machine", "bodyweight"]) {
      expect(equipment.has(kind as never)).toBe(true);
    }
  });

  it("al secondo giro non duplica niente", async () => {
    await seedLibrary(db);
    const second = await seedLibrary(db);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(LIBRARY.length);
    expect(await db.exercises.count()).toBe(LIBRARY.length);
  });

  it("non sovrascrive un esercizio della libreria modificato dall'utente", async () => {
    await seedLibrary(db);
    await db.exercises.update("lib-plank", { defaultRestSec: 45, notes: "60 secondi" });
    await seedLibrary(db);
    const plank = await db.exercises.get("lib-plank");
    expect(plank?.defaultRestSec).toBe(45);
    expect(plank?.notes).toBe("60 secondi");
  });

  it("non tocca gli esercizi personalizzati", async () => {
    await db.exercises.add({
      id: "custom-1",
      name: "Rematore Kroc",
      nameKey: normalizeName("Rematore Kroc"),
      muscleGroup: "back",
      secondaryMuscles: [],
      equipment: "dumbbell",
      isCustom: true,
      isBodyweight: false,
      createdAt: new Date().toISOString(),
    });

    await seedLibrary(db);

    const custom = await db.exercises.get("custom-1");
    expect(custom?.name).toBe("Rematore Kroc");
    expect(await db.exercises.count()).toBe(LIBRARY.length + 1);
  });

  it("se l'utente ha gia' un esercizio con lo stesso nome, la voce di libreria si salta senza rompere il seed", async () => {
    await db.exercises.add({
      id: "custom-2",
      name: "panca piana con bilanciere",
      nameKey: normalizeName("Panca piana con bilanciere"),
      muscleGroup: "chest",
      secondaryMuscles: [],
      equipment: "barbell",
      isCustom: true,
      isBodyweight: false,
      createdAt: new Date().toISOString(),
    });

    const result = await seedLibrary(db);

    expect(result.conflicts).toEqual(["Panca piana con bilanciere"]);
    expect(result.added).toBe(LIBRARY.length - 1);
    expect(await db.exercises.get("lib-panca-piana-con-bilanciere")).toBeUndefined();
    expect((await db.exercises.get("custom-2"))?.isCustom).toBe(true);
  });
});

describe("ensureSeeded", () => {
  it("gira una volta sola e registra la versione della libreria", async () => {
    const first = await ensureSeeded(db);
    expect(first?.added).toBe(LIBRARY.length);
    expect((await db.appMeta.get(LIBRARY_META_KEY))?.value).toBe(LIBRARY_VERSION);

    const second = await ensureSeeded(db);
    expect(second).toBeNull();
  });

  it("crea le impostazioni di default al primo avvio", async () => {
    await ensureSeeded(db);
    const settings = await db.settings.get("singleton");
    expect(settings?.defaultRestSec).toBe(90);
    expect(settings?.barWeightKg).toBe(20);
    expect(settings?.showRpe).toBe(false);
  });

  it("non riscrive impostazioni gia' personalizzate", async () => {
    await ensureSeeded(db);
    await db.settings.update("singleton", { defaultRestSec: 120, showRpe: true });
    db.close();

    const reopened = createTestDb(dbName);
    await reopened.open();
    await ensureSeeded(reopened);
    const settings = await reopened.settings.get("singleton");
    expect(settings?.defaultRestSec).toBe(120);
    expect(settings?.showRpe).toBe(true);
    reopened.close();
    db = createTestDb(dbName);
    await db.open();
  });
});
