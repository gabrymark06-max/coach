import { expect, test, type Page } from "@playwright/test";
import { ESERCIZIO, preparaApp } from "./helpers";

/**
 * Export e import sono funzioni di prima classe (spec §3.7): il file e' l'unica rete di
 * sicurezza di un'app che vive solo nel browser. Qui si fa il giro completo — si
 * esporta, si cancella tutto, si reimporta — e si **rilegge IndexedDB** per verificare
 * che i dati siano gli stessi, non che la schermata dica di sì.
 */

function leggiDb(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const leggi = (store: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const [sessions, measurements, personalRecords, routines, exercises] =
      await Promise.all([
        leggi("sessions"),
        leggi("measurements"),
        leggi("personalRecords"),
        leggi("routines"),
        leggi("exercises"),
      ]);
    db.close();
    const ordina = (rows: unknown[]) =>
      rows
        .map((row) => JSON.stringify(row, Object.keys(row as object).sort()))
        .sort();
    return {
      sessions: ordina(sessions),
      measurements: ordina(measurements),
      personalRecords: ordina(personalRecords),
      routines: ordina(routines),
      exercises: ordina(exercises),
    };
  });
}

test("export JSON, database svuotato, import: i dati tornano identici", async ({ page }) => {
  await preparaApp(page);

  // qualcosa da salvare: una routine, un allenamento con un record, una misura
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill("Push A");
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();
  const foglio = page.getByRole("dialog");
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(ESERCIZIO);
  await foglio.getByRole("checkbox", { name: ESERCIZIO }).click();
  await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();
  await page.getByRole("button", { name: "Salva routine" }).click();
  await expect(page).toHaveURL(/\/allenamento$/);

  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//);
  await page.getByRole("button", { name: "Fatto" }).click();

  await page.goto("/misure/bodyweight");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByLabel("Peso corporeo (kg)").fill("78,4");
  await page.getByRole("button", { name: "Salva" }).click();
  await page.waitForTimeout(500);

  const prima = await leggiDb(page);
  expect(prima.sessions).toHaveLength(1);
  expect(prima.personalRecords).toHaveLength(3);
  expect(prima.measurements).toHaveLength(1);

  // --- export --------------------------------------------------------------
  await page.goto("/impostazioni/dati");
  await expect(page.getByRole("heading", { name: "Cosa contiene il backup" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Esporta backup JSON" }).click(),
  ]);
  const percorso = test.info().outputPath("lifted-backup.json");
  await download.saveAs(percorso);
  expect(download.suggestedFilename()).toMatch(/^lifted-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // --- cancella tutto -------------------------------------------------------
  await page.getByRole("button", { name: "Cancella tutti i dati" }).click();
  await page.getByRole("button", { name: "Cancella tutto", exact: true }).click();
  await page.waitForTimeout(800);
  const vuoto = await leggiDb(page);
  expect(vuoto.sessions).toHaveLength(0);
  expect(vuoto.measurements).toHaveLength(0);
  expect(vuoto.personalRecords).toHaveLength(0);

  // --- import ---------------------------------------------------------------
  await page.setInputFiles("#file-backup", percorso);
  // la conferma non e' saltabile e dice cosa sta per sovrascrivere
  const conferma = page.getByRole("alertdialog");
  await expect(conferma).toContainText("Sostituire tutti i dati?");
  // QA MINORE 2: gli accordi al singolare, adesso che esistono
  await expect(conferma).toContainText("1 allenamento");
  await expect(conferma).toContainText("1 misurazione");
  // e il formato e' salito a 2 (§9.5)
  await expect(conferma).toContainText("formato versione 2");
  await page.getByRole("button", { name: "Sostituisci" }).click();
  await page.waitForTimeout(1500);

  const dopo = await leggiDb(page);
  expect(dopo.sessions).toEqual(prima.sessions);
  expect(dopo.measurements).toEqual(prima.measurements);
  expect(dopo.routines).toEqual(prima.routines);
  expect(dopo.personalRecords).toEqual(prima.personalRecords);
  expect(dopo.exercises).toEqual(prima.exercises);
});

test("un file che non e' un backup viene rifiutato senza toccare i dati", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/impostazioni/dati");

  await page.setInputFiles("#file-backup", {
    name: "qualcosa.json",
    mimeType: "application/json",
    buffer: Buffer.from("non sono un backup"),
  });

  await expect(page.locator("#file-backup-errore")).toContainText(
    "Questo file non è un backup di Lifted.",
  );
  // nessuna conferma di sostituzione: non si e' nemmeno arrivati a proporla
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  const dati = await leggiDb(page);
  expect(dati.exercises.length).toBeGreaterThan(0);
});

test("export CSV: tre file, con il separatore giusto per Excel italiano", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/misure/bodyweight");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByLabel("Peso corporeo (kg)").fill("78,4");
  await page.getByRole("button", { name: "Salva" }).click();
  await page.waitForTimeout(500);

  await page.goto("/impostazioni/dati");
  const scaricati: string[] = [];
  page.on("download", (d) => scaricati.push(d.suggestedFilename()));
  const [misure] = await Promise.all([
    page.waitForEvent("download", {
      predicate: (d) => d.suggestedFilename().includes("misure"),
    }),
    page.getByRole("button", { name: "Esporta CSV per Excel" }).click(),
  ]);

  const percorso = test.info().outputPath("misure.csv");
  await misure.saveAs(percorso);
  const contenuto = await import("node:fs").then((fs) => fs.readFileSync(percorso, "utf8"));
  expect(contenuto.startsWith("﻿")).toBe(true);
  expect(contenuto).toContain("Data;Metrica;Valore;Unità;Nota");
  expect(contenuto).toContain(";Peso corporeo;78,4;kg;");

  await page.waitForTimeout(500);
  expect(scaricati.length).toBeGreaterThanOrEqual(2);
});
