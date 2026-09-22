import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { animazioniFinite, preparaApp } from "./helpers";

/**
 * Il secondo intervento, percorso davvero: un allenamento che genera un record, un
 * secondo che lo batte, e il record che si ritrova nel riepilogo, nello storico, nel
 * dettaglio dell'esercizio e nelle statistiche.
 */

async function creaRoutine(page: Page, nome: string, ricerca: string, etichetta: RegExp) {
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill(nome);
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();
  const foglio = page.getByRole("dialog");
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(ricerca);
  await foglio.getByRole("checkbox", { name: etichetta }).click();
  await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();
  await page.getByRole("button", { name: "Salva routine" }).click();
  await expect(page).toHaveURL(/\/allenamento$/);
}

async function allena(page: Page, weightKg: string, reps: string) {
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione/);
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill(weightKg);
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill(reps);
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//);
}

test("un record scatta, si annuncia e si ritrova ovunque", async ({ page }) => {
  await preparaApp(page);
  await creaRoutine(page, "Push A", "panca piana con bilanciere", /Panca piana con bilanciere/);

  // --- primo allenamento: tre record, nessun precedente ----------------------
  await allena(page, "100", "5");
  await expect(page.getByRole("heading", { name: "3 nuovi record" })).toBeVisible();
  await expect(page.getByText("PR 1RM").first()).toBeVisible();
  await expect(page.getByText("PR VOLUME").first()).toBeVisible();
  await expect(page.getByText("PR REPS").first()).toBeVisible();
  await expect(page.getByText("primo record").first()).toBeVisible();

  // l'annuncio `aria-live` di §8.5 e' stato scritto nella regione dei record
  await expect(page.locator("#sr-pr")).toContainText("Record personale");
  await expect(page.locator("#sr-pr")).toContainText("1RM stimato");

  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page).toHaveURL(/\/allenamento$/);

  // --- secondo allenamento migliore: compare il confronto col record --------
  await allena(page, "110", "5");
  await expect(page.getByText(/sul record precedente/).first()).toBeVisible();
  await expect(page.getByText("128,33 kg").first()).toBeVisible();
  await page.getByRole("button", { name: "Fatto" }).click();

  // --- storico: la riga porta il conteggio dei record ------------------------
  await page.goto("/profilo");
  await expect(page.getByRole("heading", { name: "Storico" })).toBeVisible();
  await expect(page.getByText("2 PR").first()).toBeVisible();

  // --- dettaglio della sessione passata --------------------------------------
  await page.getByRole("link", { name: /Push A/ }).first().click();
  await expect(page).toHaveURL(/\/profilo\/sessione\//);
  await expect(page.getByRole("heading", { name: "Esercizi" })).toBeVisible();
  await expect(page.getByText("PR 1RM").first()).toBeVisible();

  // --- statistiche: elenco dei record e grafici ------------------------------
  await page.goto("/statistiche");
  await expect(page.getByRole("heading", { name: "Record personali" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1RM stimato" })).toBeVisible();
  await expect(page.getByText("PR 1RM").first()).toBeVisible();

  // --- dettaglio esercizio: i tre record correnti ----------------------------
  await page.goto("/esercizi");
  await page.getByRole("link", { name: /Panca piana con bilanciere/ }).click();
  await expect(page.getByRole("heading", { name: "Record personali" })).toBeVisible();
  // il chip porta la parola e il numero in due elementi: si guarda il chip intero
  await expect(page.getByText("PR 1RM").first()).toBeVisible();
  await expect(page.getByText("128,33").first()).toBeVisible();
});

test("eliminare l'allenamento del record riporta il record a quello di prima", async ({
  page,
}) => {
  await preparaApp(page);
  await creaRoutine(page, "Pull A", "stacco da terra", /Stacco da terra/);

  await allena(page, "100", "5");
  await page.getByRole("button", { name: "Fatto" }).click();
  await allena(page, "140", "5");
  await page.getByRole("button", { name: "Fatto" }).click();

  await page.goto("/esercizi");
  await page.getByRole("link", { name: /Stacco da terra/ }).click();
  await expect(page.getByText("163,33").first()).toBeVisible();

  // si elimina l'allenamento migliore dallo storico
  await page.goto("/profilo");
  await page.getByRole("link", { name: /Pull A/ }).first().click();
  await page.getByRole("button", { name: "Elimina questo allenamento" }).click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(page).toHaveURL(/\/profilo$/);

  await page.goto("/esercizi");
  await page.getByRole("link", { name: /Stacco da terra/ }).click();
  await expect(page.getByText("116,67").first()).toBeVisible();
  await expect(page.getByText("163,33")).toHaveCount(0);
});

test("misure: inserimento, grafico, modifica ed eliminazione", async ({ page }) => {
  await preparaApp(page);

  await page.goto("/misure");
  await expect(page.getByRole("heading", { name: "Nessuna misurazione" })).toBeVisible();

  await page.goto("/misure/bodyweight");
  // stato vuoto del grafico (§4.10)
  await expect(page.getByText("Registra almeno due misurazioni")).toBeVisible();

  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByLabel("Peso corporeo (kg)").fill("78,4");
  await page.getByRole("button", { name: "Salva" }).click();

  // un punto solo: si mostra il punto, non una linea inventata
  await expect(page.getByText("Serve un secondo dato per tracciare una linea.")).toBeVisible();

  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByLabel("Peso corporeo (kg)").fill("77,9");
  await page.getByLabel("Data").fill("2026-09-01");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.locator("svg.recharts-surface")).toBeVisible({ timeout: 15_000 });

  // la tabella equivalente del grafico esiste e ha i due valori
  await expect(page.getByRole("table", { name: /Andamento di Peso corporeo/ })).toBeAttached();

  // validazione: fuori scala, errore accanto al campo
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page.getByLabel("Peso corporeo (kg)").fill("900");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Inserisci un valore tra 20 e 400 kg.").first()).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();

  // modifica ed eliminazione
  await page.getByRole("button", { name: /Modifica la misurazione/ }).first().click();
  await page.getByRole("button", { name: "Elimina" }).click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(page.getByText("Serve un secondo dato per tracciare una linea.")).toBeVisible();
});

test("impostazioni: recupero, RPE e inventario dei dischi si salvano", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/impostazioni");

  await expect(page.getByText("I tuoi dati restano su questo dispositivo.")).toBeVisible();

  await page.getByLabel("Recupero predefinito").selectOption("120");
  await page.getByLabel("Colonna RPE").check();
  await page.getByLabel("Dischi da 20 kg").fill("4");
  await page.getByLabel("Dischi da 20 kg").blur();
  await page.waitForTimeout(400);

  await page.reload();
  await expect(page.getByLabel("Recupero predefinito")).toHaveValue("120");
  await expect(page.getByLabel("Colonna RPE")).toBeChecked();
  await expect(page.getByLabel("Dischi da 20 kg")).toHaveValue("4");
});

test("axe: le schermate nuove, con dati veri", async ({ page }, testInfo) => {
  await preparaApp(page);
  await creaRoutine(page, "Push A", "panca piana con bilanciere", /Panca piana con bilanciere/);
  await allena(page, "100", "5");

  // il riepilogo si guarda dove siamo gia', le altre si visitano
  const rotte = ["/profilo", "/statistiche", "/misure", "/impostazioni", "/impostazioni/backup"];

  await animazioniFinite(page);
  let risultato = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    risultato.violations.map((v) => `riepilogo: ${v.id} (${v.nodes.length})`),
    `riepilogo @ ${testInfo.project.name}`,
  ).toEqual([]);

  for (const rotta of rotte) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    await animazioniFinite(page);
    risultato = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      risultato.violations.map((v) => `${rotta}: ${v.id} (${v.nodes.length})`),
      `${rotta} @ ${testInfo.project.name}`,
    ).toEqual([]);
  }
});
