import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type LiftedDB } from "./db";
import { LIBRARY, LIBRARY_META_KEY, LIBRARY_VERSION } from "./library";
import { ensureSeeded, seedLibrary } from "./seed";
import { exerciseKey } from "./schema";

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

describe("la libreria che si semina", () => {
  it("porta fra 250 e 300 voci, come chiede la spec", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(250);
    expect(LIBRARY.length).toBeLessThanOrEqual(300);
  });

  it("ogni combinazione movimento x attrezzo e' una voce distinta", () => {
    const panca = LIBRARY.filter((row) => row.family === "panca-piana");
    expect(panca.map((row) => row.equipment).sort()).toEqual([
      "barbell",
      "dumbbell",
      "machine",
      "smith",
    ]);
    expect(panca.map((row) => row.name)).toContain("Panca piana (Manubri)");
  });

  it("nessun nome si ripete sullo stesso attrezzo, o l'indice unico perderebbe voci", () => {
    const keys = LIBRARY.map((row) => exerciseKey(row.name, row.equipment));
    expect(new Set(keys).size).toBe(LIBRARY.length);
  });

  it("la qualifica sta prima della parentesi", () => {
    const presaInversa = LIBRARY.find(
      (row) => row.family === "lat-pulldown" && row.variant === "presa inversa",
    );
    expect(presaInversa?.name).toBe("Lat pulldown presa inversa (Cavi)");
  });

  it("copre tutti e otto i gruppi muscolari e tutti e quindici gli attrezzi", () => {
    const groups = new Set(LIBRARY.map((row) => row.muscleGroup));
    expect(groups.size).toBe(8);
    const equipment = new Set(LIBRARY.map((row) => row.equipment));
    expect(equipment.size).toBe(15);
  });

  it("nessuna voce promette un video", () => {
    expect(LIBRARY.every((row) => !("videoUrl" in row))).toBe(true);
  });
});

describe("seedLibrary", () => {
  it("carica tutta la libreria al primo giro", async () => {
    const result = await seedLibrary(db);
    expect(result.added).toBe(LIBRARY.length);
    expect(await db.exercises.count()).toBe(LIBRARY.length);
  });

  it("i nomi sono in italiano e ogni esercizio ha muscolo, attrezzo e famiglia", async () => {
    await seedLibrary(db);
    const panca = await db.exercises.get("lib-panca-piana-barbell");
    expect(panca?.name).toBe("Panca piana (Bilanciere)");
    expect(panca?.muscleGroup).toBe("chest");
    expect(panca?.equipment).toBe("barbell");
    expect(panca?.family).toBe("panca-piana");
    expect(panca?.mechanics).toBe("compound");
    expect(panca?.isCustom).toBe(false);
  });

  it("l'incremento minimo segue l'attrezzo: la macchina non fa 2,5 kg", async () => {
    await seedLibrary(db);
    expect((await db.exercises.get("lib-leg-press-machine"))?.stepKgOverride).toBe(5);
    expect((await db.exercises.get("lib-panca-piana-barbell"))?.stepKgOverride).toBeUndefined();
  });

  it("al secondo giro non duplica e non riscrive niente", async () => {
    await seedLibrary(db);
    const second = await seedLibrary(db);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(LIBRARY.length);
    expect(await db.exercises.count()).toBe(LIBRARY.length);
  });

  it("non sovrascrive quello che l'utente ha personalizzato su una voce di libreria", async () => {
    await seedLibrary(db);
    await db.exercises.update("lib-plank-bodyweight", {
      defaultRestSec: 45,
      notes: "60 secondi",
    });
    await seedLibrary(db);
    const plank = await db.exercises.get("lib-plank-bodyweight");
    expect(plank?.defaultRestSec).toBe(45);
    expect(plank?.notes).toBe("60 secondi");
  });

  it("non tocca mai gli esercizi personalizzati", async () => {
    await db.exercises.add(custom("custom-1", "Rematore Kroc", "back", "dumbbell"));

    await seedLibrary(db);

    const kroc = await db.exercises.get("custom-1");
    expect(kroc?.name).toBe("Rematore Kroc");
    expect(kroc?.family).toBe("");
    expect(await db.exercises.count()).toBe(LIBRARY.length + 1);
  });

  it("se l'utente ha gia' quel nome con quell'attrezzo, vince il suo", async () => {
    await db.exercises.add(custom("custom-2", "Panca piana (Bilanciere)", "chest", "barbell"));

    const result = await seedLibrary(db);

    expect(result.conflicts).toEqual(["Panca piana (Bilanciere)"]);
    expect(result.added).toBe(LIBRARY.length - 1);
    expect(await db.exercises.get("lib-panca-piana-barbell")).toBeUndefined();
    expect((await db.exercises.get("custom-2"))?.isCustom).toBe(true);
  });

  it("lo stesso nome con un attrezzo diverso non e' un conflitto", async () => {
    await db.exercises.add(custom("custom-3", "Panca piana (Bilanciere)", "chest", "kettlebell"));
    const result = await seedLibrary(db);
    expect(result.conflicts).toEqual([]);
    expect(await db.exercises.get("lib-panca-piana-barbell")).toBeDefined();
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

  it("riempie le impostazioni introdotte da una versione nuova", async () => {
    await ensureSeeded(db);
    // un database che arriva da prima del Trainer: il campo non c'e' proprio
    await db.settings.update("singleton", { trainerRpeCap: undefined as never });
    await ensureSeeded(db);
    expect((await db.settings.get("singleton"))?.trainerRpeCap).toBe(9.5);
  });
});

function custom(
  id: string,
  name: string,
  muscleGroup: "back" | "chest",
  equipment: "dumbbell" | "barbell" | "kettlebell",
) {
  return {
    id,
    name,
    nameKey: exerciseKey(name, equipment),
    muscleGroup,
    secondaryMuscles: [],
    equipment,
    isCustom: true,
    isBodyweight: false,
    createdAt: new Date().toISOString(),
    family: "",
    mechanics: "compound" as const,
    unilateral: false,
    loadMode: "external" as const,
    popularity: 50,
  };
}
