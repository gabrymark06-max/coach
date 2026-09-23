import { expect, test, type Page } from "@playwright/test";
import { ESERCIZIO, chiudiAvvisoIniziale, duePannelli } from "./helpers";

/**
 * Il flusso principale percorso davvero: crea routine → avvia sessione → compila tre
 * serie con tipi diversi e RPE → timer di recupero → calcolatore dischi → termina →
 * la sessione e' su IndexedDB.
 */

async function attendiLibreria(page: Page) {
  await page.goto("/allenamento");
  await chiudiAvvisoIniziale(page);
  await page.goto("/esercizi");
  // primo avvio del server: la prima navigazione puo' essere lenta.
  // A >=1280 la libreria e' a due pannelli e l'h1 diventa «Esercizio» (§4.26).
  await expect(page.getByText(/^\d+ esercizi$/)).toBeVisible({ timeout: 20_000 });
}

test("flusso completo: routine, sessione, serie, timer, dischi, fine", async ({ page }) => {
  await attendiLibreria(page);

  // --- crea una routine -----------------------------------------------------
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill("Push A");
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();

  const foglio = page.getByRole("dialog");
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(ESERCIZIO);
  await foglio.getByRole("checkbox", { name: ESERCIZIO }).click();
  await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();

  await expect(page.getByRole("heading", { name: ESERCIZIO })).toBeVisible();
  await page.getByRole("button", { name: "Salva routine" }).click();

  await expect(page).toHaveURL(/\/allenamento$/);
  await expect(page.getByRole("heading", { name: "Push A" })).toBeVisible();

  // --- avvia la sessione ----------------------------------------------------
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione/);
  await expect(page.getByRole("heading", { name: ESERCIZIO })).toBeVisible();

  // mostra la colonna RPE (a 375 e' spenta di default, §4.1)
  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /colonna RPE/ }).click();

  // --- tre serie, tre tipi diversi -----------------------------------------
  // serie 1: riscaldamento
  await page.getByRole("button", { name: /^Serie 1\. Cambia tipo/ }).click();
  await page.getByRole("menuitem", { name: "Riscaldamento (W)" }).click();
  await page.getByLabel(/Peso in chili, riscaldamento/).first().fill("20");
  await page.getByLabel(/Ripetizioni, riscaldamento/).first().fill("10");
  await page.getByRole("checkbox", { name: /Completa riscaldamento/ }).first().click();

  // il timer di recupero e' partito
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aggiungi 15 secondi al recupero" })).toBeVisible();

  // serie 2: normale + RPE
  await page.getByLabel(/Peso in chili, serie 1,/).fill("80");
  await page.getByLabel(/Ripetizioni, serie 1,/).fill("8");
  await page.getByLabel(/RPE da 1 a 10, serie 1,/).selectOption("8");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).click();

  // serie 3: cedimento
  await page.getByRole("button", { name: /^Serie 2\. Cambia tipo/ }).click();
  await page.getByRole("menuitem", { name: "Cedimento (F)" }).click();
  /*
    QA MINORE 4: il nome parlato di una riga porta la **posizione**, non il tipo. Una
    serie a cedimento resta «serie 2» e il tipo lo dice il menu, una volta sola.
  */
  await page.getByLabel(/Peso in chili, serie 2,/).first().fill("82,5");
  await page.getByLabel(/Ripetizioni, serie 2,/).first().fill("6");
  await page.getByRole("checkbox", { name: /Completa serie 2/ }).first().click();

  // volume in tempo reale: 20x10 + 80x8 + 82,5x6 = 1335
  await expect(page.locator("header").getByText(/1\s?335/)).toBeVisible();

  // --- calcolatore dischi ---------------------------------------------------
  await page.getByRole("button", { name: /Azioni per Panca piana/ }).click();
  await page.getByRole("menuitem", { name: "Calcola dischi" }).click();
  await expect(page.getByRole("dialog")).toContainText("Per lato");
  await expect(page).toHaveURL(/tool=plates/);
  await page.getByRole("dialog").getByRole("button", { name: "Chiudi" }).click();

  // --- termina --------------------------------------------------------------
  await page.getByRole("button", { name: "TERMINA" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("3 serie completate su 3");
  await page.getByRole("button", { name: "Termina", exact: true }).click();

  await expect(page).toHaveURL(/\/sessione\/riepilogo\//);
  await expect(page.getByRole("heading", { name: "Riepilogo · Push A", level: 1 })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: /1\s?335/ })).toBeVisible();

  // --- la sessione e' davvero su IndexedDB ---------------------------------
  const salvata = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ status: string; totalVolumeKg: number; totalSets: number; tipi: string[] }[]>(
      (resolve, reject) => {
        const tx = db.transaction("sessions", "readonly");
        const request = tx.objectStore("sessions").getAll();
        request.onsuccess = () =>
          resolve(
            request.result.map((session) => ({
              status: session.status,
              totalVolumeKg: session.totalVolumeKg,
              totalSets: session.totalSets,
              tipi: session.exercises.flatMap((e: { sets: { type: string }[] }) =>
                e.sets.map((s) => s.type),
              ),
            })),
          );
        request.onerror = () => reject(request.error);
      },
    );
  });

  expect(salvata).toHaveLength(1);
  expect(salvata[0].status).toBe("completed");
  expect(salvata[0].totalVolumeKg).toBe(1335);
  expect(salvata[0].totalSets).toBe(3);
  expect(salvata[0].tipi).toEqual(["warmup", "normal", "failure"]);
});

test("ricaricando con una sessione aperta si atterra su Allenamento, non in sessione", async ({
  page,
}) => {
  await attendiLibreria(page);
  await page.goto("/allenamento");
  await page.getByRole("button", { name: "Avvia allenamento" }).click();
  await expect(page).toHaveURL(/\/sessione/);

  await page.reload();
  await expect(page).toHaveURL(/\/allenamento$/);

  // la barra "sessione in corso" e' li' e riporta dentro
  const barra = page.getByRole("link", { name: /Riprendi l'allenamento in corso/ });
  await expect(barra).toBeVisible();
  await barra.click();
  await expect(page).toHaveURL(/\/sessione/);

  // pulizia
  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
  await expect(page).toHaveURL(/\/allenamento$/);
});

test("i tre stati e il conteggio dei filtri nella libreria", async ({ page }, testInfo) => {
  // Da 1280 in su i chip diventano due `<select>` nella colonna destra (§4.26):
  // quel layout ha la sua prova in `guscio-v2.spec.ts`.
  test.skip(duePannelli(testInfo), "a due pannelli i filtri sono due select");
  await attendiLibreria(page);

  // stato pieno
  await expect(page.getByRole("link", { name: ESERCIZIO })).toBeVisible();

  // stato vuoto da filtro: nessun esercizio con bilanciere per il core
  await page.getByRole("button", { name: "Filtra per Core" }).click();
  await page.getByRole("button", { name: "Filtra per Bilanciere", exact: true }).click();
  await expect(page).toHaveURL(/muscolo=core/);
  await expect(page).toHaveURL(/attrezzo=barbell/);
  await expect(page.getByRole("heading", { name: "Nessun risultato" })).toBeVisible();
  await expect(page.getByText("Core + Bilanciere")).toBeVisible();

  await page.getByRole("button", { name: "Azzera filtri" }).first().click();
  await expect(page).toHaveURL(/\/esercizi$/);
});
