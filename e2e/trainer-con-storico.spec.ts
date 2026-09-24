import { expect, test, type Page } from "@playwright/test";
import { preparaApp, rispondiAlQuestionario } from "./helpers";

/**
 * **Si allena prima, si genera dopo.**
 *
 * Il bloccante del secondo audit e' vissuto indisturbato perche' tutta la suite
 * generava il programma da un database vuoto — l'unico caso in cui la generazione
 * funzionava. Qui ci sono le quattro configurazioni misurate dal QA (niente storico ·
 * una sessione su un esercizio che entra in settimana 1 · una su un esercizio che non
 * entra · uno storico grande) piu' i due percorsi che cadevano insieme al questionario:
 * `Rigenera da qui` e `Riduci a 3 giorni a settimana`.
 *
 * Gira solo a 375: e' un difetto di logica, non di larghezza, e ripeterlo su cinque
 * viewport costerebbe cinque minuti di suite per la stessa risposta.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "telefono-375", "difetto di logica: basta una larghezza");
});

async function routineCon(page: Page, nome: string, esercizi: string[]) {
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill(nome);
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();
  const foglio = page.getByRole("dialog");
  for (const esercizio of esercizi) {
    await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(esercizio);
    await foglio.getByRole("checkbox", { name: esercizio }).first().click();
  }
  await foglio
    .getByRole("button", { name: new RegExp(`Aggiungi ${esercizi.length} esercizi?`) })
    .click();
  await page.getByRole("button", { name: "Salva routine" }).click();
  await expect(page).toHaveURL(/\/allenamento$/);
}

async function allena(page: Page) {
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  const campiPeso = page.getByLabel(/^Peso in chili, serie/);
  await expect(campiPeso.first()).toBeVisible({ timeout: 20_000 });
  const totale = await campiPeso.count();
  for (let i = 0; i < totale; i += 1) {
    await campiPeso.nth(i).fill("60");
    await page.getByLabel(/^Ripetizioni, serie/).nth(i).fill("8");
    await page.getByRole("checkbox", { name: /^Completa serie/ }).nth(i).click();
  }
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//, { timeout: 20_000 });
}

/** Quanti programmi ci sono davvero su IndexedDB, dopo il tentativo. */
async function programmiScritti(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains("trainerPrograms")) {
      db.close();
      return 0;
    }
    const n = await new Promise<number>((resolve, reject) => {
      const request = db.transaction("trainerPrograms", "readonly").objectStore("trainerPrograms").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return n;
  });
}

async function generaEMisura(page: Page, etichetta: string) {
  await rispondiAlQuestionario(page).catch(() => undefined);
  const url = page.url();
  const programmi = await programmiScritti(page);
  const errore = await page
    .getByText(/Non riesco a generare|difetto dell'app|database dell'app/)
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => null);
  console.log(
    `[${etichetta}] url=${url.replace(/^https?:\/\/[^/]+/, "")} programmi=${programmi} errore=${errore ?? "nessuno"}`,
  );
  expect(programmi, etichetta).toBe(1);
  expect(url, etichetta).toMatch(/\/trainer$/);
}

test("A — database vuoto", async ({ page }) => {
  await preparaApp(page);
  await generaEMisura(page, "A database vuoto");
});

test("B — una sessione su un esercizio che entra in settimana 1", async ({ page }) => {
  await preparaApp(page);
  await routineCon(page, "Storico", ["Panca piana (Bilanciere)"]);
  await allena(page);
  await generaEMisura(page, "B una sessione in programma");
});

test("C — una sessione su un esercizio che nel programma non entra", async ({ page }) => {
  await preparaApp(page);
  await routineCon(page, "Storico", ["Crunch (Palla medica)"]);
  await allena(page);
  await generaEMisura(page, "C una sessione fuori programma");
});

test("D — storico grande: quattro sessioni su piu' esercizi", async ({ page }) => {
  await preparaApp(page);
  await routineCon(page, "Storico grande", [
    "Panca piana (Bilanciere)",
    "Squat (Bilanciere)",
    "Lat pulldown presa larga (Cavi)",
    "Leg curl seduto (Macchina)",
  ]);
  // quattro allenamenti completi sulla stessa routine: lo storico non e' una riga sola
  for (let i = 0; i < 4; i += 1) {
    await page.goto("/allenamento");
    await allena(page);
  }
  await generaEMisura(page, "D storico grande");
});

/**
 * E — i percorsi che cadevano insieme al questionario: `Rigenera da qui` e
 * `Riduci a 3 giorni a settimana`, **con lo storico alle spalle**. Si arriva al banner
 * della settimana saltata spostando l'orologio del browser in avanti di due settimane.
 */
test("E — «Rigenera da qui» e «Riduci a 3 giorni» con storico", async ({ page }) => {
  await page.clock.install();
  await preparaApp(page);
  await routineCon(page, "Storico", ["Panca piana (Bilanciere)"]);
  await allena(page);
  await rispondiAlQuestionario(page);
  await expect(page.getByRole("heading", { name: /Ipertrofia · 4 giorni/ })).toBeVisible();

  // due settimane senza allenarsi: il programma lo dice e propone le quattro azioni
  const fraDueSettimane = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
  await page.clock.setSystemTime(fraDueSettimane);
  await page.clock.resume();
  await page.goto("/trainer");
  await page.reload();

  const banner = page.getByRole("status").filter({ hasText: /saltat/ });
  await expect(banner.first()).toBeVisible({ timeout: 20_000 });
  console.log("[E banner]", (await banner.first().textContent())?.slice(0, 120));

  const riduci = page.getByRole("button", { name: /Riduci a 3 giorni/ });
  if (await riduci.count()) {
    await riduci.click();
    await expect(page.getByRole("heading", { name: /Ipertrofia · 3 giorni/ })).toBeVisible({
      timeout: 20_000,
    });
    console.log("[E] Riduci a 3 giorni: programma nuovo generato");
  } else {
    await page.getByRole("button", { name: /Rigenera da qui/ }).click();
    await expect(page.getByRole("heading", { name: /Ipertrofia · 4 giorni/ })).toBeVisible({
      timeout: 20_000,
    });
    console.log("[E] Rigenera da qui: programma nuovo generato");
  }
});

/** F — due settimane saltate: compare la quarta azione, `Riduci a 3 giorni`. */
test("F — «Riduci a 3 giorni a settimana» con storico", async ({ page }) => {
  await page.clock.install();
  await preparaApp(page);
  await routineCon(page, "Storico", ["Panca piana (Bilanciere)"]);
  await allena(page);
  await rispondiAlQuestionario(page);

  await page.clock.setSystemTime(new Date(Date.now() + 16 * 24 * 60 * 60 * 1000));
  await page.clock.resume();
  await page.goto("/trainer");
  await page.reload();

  // si prosegue come previsto: la settimana 1 resta saltata e si passa alla 2
  await page.getByRole("button", { name: /Vai alla settimana 2/ }).click();
  await page.waitForTimeout(1500);

  // e altre due settimane senza allenarsi: adesso ne mancano due di fila
  await page.clock.setSystemTime(new Date(Date.now() + 32 * 24 * 60 * 60 * 1000));
  await page.goto("/trainer");
  await page.reload();

  const banner = page.getByRole("status").filter({ hasText: /saltat/ });
  await expect(banner.first()).toBeVisible({ timeout: 20_000 });
  console.log("[F banner]", (await banner.first().textContent())?.slice(0, 160));

  await page.getByRole("button", { name: /Riduci a 3 giorni/ }).click();
  await expect(page.getByRole("heading", { name: /Ipertrofia · 3 giorni/ })).toBeVisible({
    timeout: 20_000,
  });
  console.log("[F] Riduci a 3 giorni: programma nuovo generato con lo storico");
});
