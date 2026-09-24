import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  animazioniFinite,
  creaRoutineConEsercizio,
  duePannelli,
  preparaApp,
} from "./helpers";

/**
 * Il guscio v2, percorso davvero alle cinque larghezze: sidebar da 1024, colonna destra
 * da 1280, un solo `<nav>` per documento, e i componenti nuovi che il QA non ha mai
 * verificato — feed, calendario da tastiera, libreria a due pannelli.
 */

test("la colonna destra compare a 1280 e sotto non porta via niente", async ({
  page,
}, testInfo) => {
  await preparaApp(page);
  await page.goto("/home");

  const aside = page.getByRole("complementary", { name: "Riepilogo e azioni rapide" });

  if (duePannelli(testInfo)) {
    await expect(aside).toBeVisible();
    const box = await aside.boundingBox();
    expect(box!.width).toBe(320);
  } else {
    await expect(aside).toHaveCount(0);
  }

  /*
    §8.10 — «a 1279px nessun dato e' scomparso rispetto a 1280px». Le azioni rapide
    esistono a **ogni** larghezza: sopra 1280 nella colonna destra, sotto in coda al
    centro.
  */
  await expect(page.getByRole("link", { name: "Nuova routine" })).toBeVisible();
});

test("la home e' un feed, con l'avvio in cima e la paginazione a pulsante", async ({
  page,
}) => {
  await preparaApp(page);
  await page.goto("/home");

  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();

  // stato vuoto onesto, non una pagina bianca
  await expect(
    page.getByRole("heading", { name: "Nessun allenamento registrato" }),
  ).toBeVisible();

  // un allenamento vero, e la card compare con durata, volume e record
  await creaRoutineConEsercizio(page, "Push A");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione/);
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//);

  await page.goto("/home");
  const card = page.getByRole("article").first();
  await expect(card.getByRole("link", { name: "Push A" })).toBeVisible();
  await expect(card.getByText("Durata")).toBeVisible();
  await expect(card.getByText("Volume")).toBeVisible();
  await expect(card.getByText("Record")).toBeVisible();

  // niente scroll infinito e niente social: la card finisce con l'elenco esercizi
  await expect(page.getByRole("button", { name: /Mi piace|Commenta|Condividi/ })).toHaveCount(0);
});

test("il calendario del profilo si naviga con la sola tastiera", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push A");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();

  await page.goto("/profilo");
  const griglia = page.getByRole("grid");
  await expect(griglia).toBeVisible({ timeout: 15_000 });

  // roving tabindex: **una sola** cella nel tab order
  const inTabOrder = griglia.locator('[role="gridcell"][tabindex="0"]');
  await expect(inTabOrder).toHaveCount(1);

  // ci si arriva con Tab e ci si muove con le frecce, senza mai toccare il mouse
  await inTabOrder.focus();
  const partenza = await attivo(page);

  await page.keyboard.press("ArrowRight");
  const dopoDestra = await attesoDiverso(page, partenza);
  expect(giorniFra(partenza, dopoDestra)).toBe(1);

  await page.keyboard.press("ArrowDown");
  const dopoGiu = await attesoDiverso(page, dopoDestra);
  expect(giorniFra(dopoDestra, dopoGiu)).toBe(7);

  await page.keyboard.press("Home");
  const lunedi = await attesoDiverso(page, dopoGiu);
  expect(new Date(lunedi.slice(4)).getDay()).toBe(1);

  // PagGiù cambia mese, e il mese finisce nella query string (§11.5)
  await page.keyboard.press("PageDown");
  await expect(page).toHaveURL(/mese=\d{4}-\d{2}/);
  const dopoMese = await attesoDiverso(page, lunedi);
  expect(dopoMese.slice(4, 11)).not.toBe(lunedi.slice(4, 11));

  // e il tasto Indietro torna al mese di prima
  await page.goBack();
  await expect(page.getByRole("grid")).toBeVisible();
});

test("la libreria con ~300 voci: il conteggio, i filtri e il pannello", async ({
  page,
}, testInfo) => {
  await preparaApp(page);
  await page.goto("/esercizi");

  /*
    Il contatore esiste anche durante il caricamento e li' vale zero (e' il numero dei
    risultati, non lo stato della lettura): si aspetta che Dexie abbia risposto invece
    di leggere il primo valore che passa.
  */
  const conteggio = page.getByText(/^\d+ esercizi$/);
  await expect(conteggio).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => Number(/\d+/.exec((await conteggio.textContent()) ?? "")?.[0] ?? 0), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  const voci = Number(/\d+/.exec((await conteggio.textContent()) ?? "")?.[0] ?? 0);
  expect(voci).toBeGreaterThanOrEqual(250);
  expect(voci).toBeLessThanOrEqual(300);

  if (duePannelli(testInfo)) {
    // due `<select>` nativi al posto dei chip (§4.26)
    await page.getByLabel("Filtra per muscolo").selectOption("chest");
    await expect(page).toHaveURL(/muscolo=chest/);
    await expect(page.getByText(/^\d+ esercizi$/)).toBeVisible();

    // il centro dice «Scegli un esercizio» invece di restare bianco
    await expect(page.getByRole("heading", { name: "Scegli un esercizio" })).toBeVisible();

    /*
      L'elenco e' virtualizzato: una voce a meta' alfabeto non e' nel DOM finche' non
      la si porta in vista. Si fa come la farebbe un utente — si cerca.
    */
    await page.getByLabel("Cerca un esercizio").fill("Panca piana (Bilanciere)");
    await page
      .getByRole("link", { name: /^Panca piana \(Bilanciere\)/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/esercizi\/lib-panca-piana-barbell/);
    await expect(page.locator("#titolo-pagina")).toBeFocused();
    // la voce scelta porta `aria-current` **e** la corsia: il solo fondo fa 1.36:1
    await expect(page.locator('a[aria-current="true"]')).toHaveCount(1);
  } else {
    await page.getByRole("button", { name: "Filtra per Petto" }).click();
    await expect(page).toHaveURL(/muscolo=chest/);
  }
});

test("ogni rotta ha un solo main, un solo h1 e uno skip link che skippa", async ({
  page,
}) => {
  await preparaApp(page);

  const rotte = [
    "/home",
    "/allenamento",
    "/trainer",
    "/esercizi",
    "/profilo",
    "/statistiche",
    "/misure",
    "/impostazioni",
    "/impostazioni/allenamento",
    "/impostazioni/dati",
    "/impostazioni/info",
    "/sessione",
  ];

  for (const rotta of rotte) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");

    const struttura = await page.evaluate(() => ({
      main: document.querySelectorAll("main").length,
      h1: document.querySelectorAll("h1").length,
      bersaglio: document.querySelector("#contenuto")?.tagName ?? null,
      nav: document.querySelectorAll('nav[aria-label="Navigazione principale"]').length,
      h1DentroMain: Boolean(document.querySelector("main h1")),
    }));

    expect(struttura, `${rotta}`).toMatchObject({
      main: 1,
      h1: 1,
      bersaglio: "MAIN",
      h1DentroMain: true,
    });
    // §8.9: mai due nav principali insieme; su `/sessione` non ce n'e' nessuna
    expect(struttura.nav, `${rotta}`).toBeLessThanOrEqual(1);
  }
});

/** QA GRAVE 5: su `/sessione` axe deve finalmente dare zero. */
test("axe: zero violazioni su /sessione, con e senza il menu aperto", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push A");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione/);
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await animazioniFinite(page);

  const base = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(base.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

  // QA MINORE 1: `aria-hidden-focus` con il menu dell'esercizio aperto
  await page.getByRole("button", { name: /Azioni per Panca piana/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await animazioniFinite(page);

  const conMenu = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(conMenu.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/** QA MINORE 5: il pulsante centrale della pill del timer deve stare a 48px. */
test("i bersagli della pill del timer rispettano i 48px", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push A");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await page.getByLabel(/Peso in chili, serie 1,/).first().fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
  await expect(page.getByRole("timer")).toBeVisible();

  for (const nome of [
    /Togli 15 secondi/,
    /Metti in pausa il recupero/,
    /Aggiungi 15 secondi/,
    /Salta il recupero/,
  ]) {
    const box = await page.getByRole("button", { name: nome }).boundingBox();
    expect(box, String(nome)).not.toBeNull();
    expect(box!.height, String(nome)).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/** QA GRAVE 4: `Invio` in REPS deve arrivare al check, a ogni larghezza. */
test("la catena Invio va da KG a REPS al check", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push A");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();

  const kg = page.getByLabel(/Peso in chili, serie 1,/).first();
  await kg.focus();
  await page.keyboard.type("80");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/Ripetizioni, serie 1,/).first()).toBeFocused();

  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("checkbox", { name: /Completa serie 1/ }).first()).toBeFocused();

  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/**
 * DIFETTO 2 del secondo audit: con la colonna RPE accesa la catena entrava nell'RPE e
 * non ne usciva piu'. Chi accende l'RPE e' chi usa l'app sul serio, e perdeva
 * l'unico shortcut del sistema a meta' serie.
 */
test("la catena Invio attraversa l'RPE quando la colonna e' accesa", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push RPE");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();

  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /colonna RPE/ }).click();

  await page.getByLabel(/Peso in chili, serie 1,/).first().focus();
  await page.keyboard.type("80");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/Ripetizioni, serie 1,/).first()).toBeFocused();

  await page.keyboard.type("8");
  await page.keyboard.press("Enter");
  const rpe = page.getByLabel(/RPE da 1 a 10, serie 1,/).first();
  await expect(rpe).toBeFocused();

  await page.keyboard.press("Enter");
  const check = page.getByRole("checkbox", { name: /Completa serie 1/ }).first();
  await expect(check).toBeFocused();

  // e il check si preme da tastiera: la serie si completa senza toccare il mouse
  await page.keyboard.press("Enter");
  await expect(check).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/** L'id della cella che ha il fuoco adesso. */
async function attivo(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.id ?? "");
}

/**
 * Il fuoco si sposta dopo un render, e uscire dal mese con una freccia fa anche una
 * navigazione: per un istante il fuoco puo' passare dal `body`. Quello che conta e'
 * **dove finisce** — su un'altra cella del calendario — non ogni fotogramma in mezzo.
 */
async function attesoDiverso(page: Page, precedente: string): Promise<string> {
  await expect
    .poll(
      async () => {
        const id = await attivo(page);
        return id !== precedente && /^cal-\d{4}-\d{2}-\d{2}$/.test(id);
      },
      { timeout: 8_000 },
    )
    .toBe(true);
  return attivo(page);
}

/** Quanti giorni separano due id `cal-YYYY-MM-DD`. */
function giorniFra(a: string, b: string): number {
  const ms = Date.parse(b.slice(4)) - Date.parse(a.slice(4));
  return Math.round(ms / 86_400_000);
}
