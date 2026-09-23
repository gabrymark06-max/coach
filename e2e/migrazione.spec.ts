import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { preparaApp } from "./helpers";

/**
 * La migrazione v1 → v2 **in un browser vero**, su un database popolato.
 *
 * I test unitari provano la trasformazione; questo prova che l'app, aperta da un
 * dispositivo fermo alla v1, si avvia e mostra quello che c'era. E' la prova che
 * conta davvero: qui i dati sono l'unica copia che l'utente ha.
 *
 * Il database v1 si costruisce con IndexedDB **a mano**, con lo schema della v1: aprirlo
 * con Dexie lo migrerebbe subito e il test non proverebbe niente.
 */

/*
  Questi due test lasciano il database in uno stato che non e' quello dell'app: uno lo
  scrive a mano con lo schema v1, l'altro ci importa sopra un backup con **un solo**
  esercizio. Senza questa pulizia, chi gira dopo si trova una libreria di una voce e
  fallisce per colpa nostra — ed e' esattamente il genere di rottura che fa perdere
  mezz'ora a cercarla nel posto sbagliato.
*/
test.afterEach(async ({ page }) => {
  await paginaSenzaApp(page);
  await cancellaDatabase(page);
});

const SESSIONE_V1 = {
  id: "s-v1",
  routineName: "Push A (v1)",
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
        { id: "set2", index: 2, type: "normal", weightKg: 100, reps: 5, completed: true },
      ],
    },
  ],
  totalVolumeKg: 1000,
  totalSets: 2,
  durationSec: 5400,
  exerciseIds: ["lib-panca-piana-con-bilanciere"],
};

test("un database v1 popolato si apre in v2 senza perdere niente", async ({ page }) => {
  await paginaSenzaApp(page);
  await cancellaDatabase(page);

  await page.evaluate(async (sessione) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted", 1);
      request.onupgradeneeded = () => {
        const upgraded = request.result;
        const exercises = upgraded.createObjectStore("exercises", { keyPath: "id" });
        exercises.createIndex("nameKey", "nameKey", { unique: true });
        exercises.createIndex("muscleGroup", "muscleGroup");
        exercises.createIndex("equipment", "equipment");
        upgraded.createObjectStore("routines", { keyPath: "id" });
        const sessions = upgraded.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("status", "status");
        sessions.createIndex("startedAt", "startedAt");
        sessions.createIndex("[status+startedAt]", ["status", "startedAt"]);
        sessions.createIndex("exerciseIds", "exerciseIds", { multiEntry: true });
        const records = upgraded.createObjectStore("personalRecords", { keyPath: "id" });
        records.createIndex("exerciseId", "exerciseId");
        upgraded.createObjectStore("measurements", { keyPath: "id" });
        upgraded.createObjectStore("settings", { keyPath: "id" });
        upgraded.createObjectStore("appMeta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const scrivi = (store: string, value: unknown) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

    await scrivi("exercises", {
      id: "lib-panca-piana-con-bilanciere",
      name: "Panca piana con bilanciere",
      nameKey: "panca piana con bilanciere",
      muscleGroup: "chest",
      secondaryMuscles: ["shoulders", "arms"],
      equipment: "barbell",
      isCustom: false,
      isBodyweight: false,
      createdAt: "2026-01-01T10:00:00.000Z",
      notes: "presa a 81 cm",
    });
    await scrivi("exercises", {
      id: "custom-kroc",
      name: "Rematore Kroc",
      nameKey: "rematore kroc",
      muscleGroup: "back",
      secondaryMuscles: [],
      equipment: "dumbbell",
      isCustom: true,
      isBodyweight: false,
      createdAt: "2026-02-02T10:00:00.000Z",
    });
    await scrivi("sessions", sessione);
    await scrivi("measurements", {
      id: "m1",
      metric: "bodyweight",
      value: 82.4,
      unit: "kg",
      date: "2026-03-01T07:00:00.000Z",
    });
    await scrivi("settings", {
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
      onboardingSeenAt: "2026-01-01T10:00:00.000Z",
    });
    await scrivi("appMeta", { key: "seed.libraryVersion", value: 1 });
    db.close();
  }, SESSIONE_V1);

  // --- l'app si apre: Dexie migra, il seed allarga la libreria ---------------
  await page.goto("/profilo");
  await expect(page.getByRole("heading", { name: "Profilo", level: 1 })).toBeVisible({
    timeout: 20_000,
  });

  // lo storico e' li'
  await expect(page.getByRole("link", { name: "Push A (v1)" })).toBeVisible({
    timeout: 20_000,
  });
  // e i totali lo contano
  await expect(page.getByText(/1\s?000/).first()).toBeVisible();

  // le misure sono intatte
  await page.goto("/misure");
  await expect(page.getByText(/82,4/).first()).toBeVisible({ timeout: 15_000 });

  // la libreria e' cresciuta, l'esercizio della v1 si e' rinominato invece di
  // duplicarsi, e il personalizzato e' rimasto quello che era
  const stato = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const leggi = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const esercizi = await leggi<{
      id: string;
      name: string;
      family: string;
      equipment: string;
      isCustom: boolean;
      notes?: string;
      nameKey: string;
    }>("exercises");
    const impostazioni = await leggi<{ defaultRestSec: number; trainerRpeCap?: number }>(
      "settings",
    );
    db.close();
    return {
      totale: esercizi.length,
      panca: esercizi.find((e) => e.id === "lib-panca-piana-con-bilanciere"),
      doppioni: esercizi.filter(
        (e) => e.family === "panca-piana" && e.equipment === "barbell",
      ).length,
      kroc: esercizi.find((e) => e.id === "custom-kroc"),
      impostazioni: impostazioni[0],
    };
  });

  expect(stato.totale).toBeGreaterThanOrEqual(250);
  expect(stato.panca?.name).toBe("Panca piana (Bilanciere)");
  expect(stato.panca?.family).toBe("panca-piana");
  // la nota dell'utente su una voce di libreria non si perde
  expect(stato.panca?.notes).toBe("presa a 81 cm");
  // e non e' comparsa una seconda panca piana con bilanciere
  expect(stato.doppioni).toBe(1);

  // l'esercizio personalizzato non si tocca mai (spec-v2 §3)
  expect(stato.kroc?.name).toBe("Rematore Kroc");
  expect(stato.kroc?.isCustom).toBe(true);
  expect(stato.kroc?.family).toBe("");
  // ma l'attrezzo entra nella chiave di unicita' anche per lui (§9.4)
  expect(stato.kroc?.nameKey).toBe("rematore kroc|dumbbell");

  // le impostazioni restano quelle dell'utente, e quelle nuove compaiono
  expect(stato.impostazioni?.defaultRestSec).toBe(120);
  expect(stato.impostazioni?.trainerRpeCap).toBe(9.5);
});

test("un backup v1 si importa senza essere rifiutato", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/impostazioni/dati");
  // senza dati la sezione «Cosa contiene il backup» non si monta (stato vuoto §4.15):
  // qui serve solo il campo file, che c'e' sempre
  await expect(page.locator("#file-backup")).toBeAttached({ timeout: 20_000 });

  const v1 = JSON.stringify({
    app: "lifted",
    formatVersion: 1,
    schemaVersion: 1,
    exportedAt: "2026-02-01T09:00:00.000Z",
    counts: {
      exercises: 1,
      routines: 0,
      sessions: 1,
      personalRecords: 0,
      measurements: 1,
    },
    data: {
      exercises: [
        {
          id: "lib-panca-piana-con-bilanciere",
          name: "Panca piana con bilanciere",
          nameKey: "panca piana con bilanciere",
          muscleGroup: "chest",
          secondaryMuscles: [],
          equipment: "barbell",
          isCustom: false,
          isBodyweight: false,
          createdAt: "2026-01-01T10:00:00.000Z",
        },
      ],
      routines: [],
      sessions: [SESSIONE_V1],
      personalRecords: [],
      measurements: [
        {
          id: "m1",
          metric: "bodyweight",
          value: 82.4,
          unit: "kg",
          date: "2026-03-01T07:00:00.000Z",
        },
      ],
      settings: null,
    },
  });

  const percorso = test.info().outputPath("lifted-backup-v1.json");
  writeFileSync(percorso, v1, "utf-8");
  await page.setInputFiles("#file-backup", percorso);

  /*
    Il punto di questo test: un file `formatVersion: 1` **non** viene piu' rifiutato
    come «versione più recente». Il QA aveva verificato la regressione al contrario —
    un file v2 respinto da un'app a 1 — e alzare il formato senza insegnare al parser
    a leggere l'1 avrebbe solo spostato il problema.
  */
  const conferma = page.getByRole("alertdialog");
  await expect(conferma).toContainText("Sostituire tutti i dati?");
  await expect(conferma).toContainText("1 allenamento");
  await expect(conferma).toContainText("formato versione 1");
  await page.getByRole("button", { name: "Sostituisci" }).click();

  await expect(page.getByText(/Importato 1 allenamento/).first()).toBeVisible({
    timeout: 15_000,
  });

  // e da qui in poi quello che esce e' un v2, con le tabelle del Trainer vuote
  const formato = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const nomi = [...db.objectStoreNames];
    db.close();
    return nomi;
  });
  expect(formato).toContain("trainerPrograms");
  expect(formato).toContain("trainerDecisions");
});

/**
 * Una pagina della **stessa origine che non avvia l'app**: il manifest e' JSON servito
 * da Next, quindi nessun `SessionProvider` apre Dexie e `deleteDatabase` non resta
 * bloccata da una connessione viva.
 */
async function paginaSenzaApp(page: Page) {
  await page.goto("/manifest.webmanifest");
}

/**
 * `deleteDatabase` e' asincrona e resta in attesa finche' una connessione e' aperta.
 * Senza aspettarla davvero, la scrittura del database v1 trova ancora quello v2 e
 * fallisce con `VersionError`.
 */
async function cancellaDatabase(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase("lifted");
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      }),
  );
}
