import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { animazioniFinite, chiudiAvvisoIniziale, conSidebar, preparaApp } from "./helpers";

const ROTTE = [
  "/home",
  "/allenamento",
  "/allenamento/routine/nuova",
  "/trainer",
  "/esercizi",
  "/esercizi/nuovo",
  "/profilo",
  "/misure",
  "/misure/bodyweight",
  "/statistiche",
  "/impostazioni",
  "/impostazioni/allenamento",
  "/impostazioni/app",
  "/impostazioni/dati",
  "/impostazioni/info",
];

const preparaDati = preparaApp;

test("nessuno scroll orizzontale su nessuna rotta", async ({ page }, testInfo) => {
  await preparaDati(page);
  for (const rotta of ROTTE) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${rotta} @ ${testInfo.project.name}`).toBeLessThanOrEqual(0);
  }
});

test("i bersagli della sessione rispettano i 48px", async ({ page }) => {
  await preparaDati(page);
  await page.goto("/allenamento");
  await page.getByRole("button", { name: "Avvia allenamento" }).click();
  await expect(page).toHaveURL(/\/sessione/);

  const bersagli = [
    page.getByRole("button", { name: "Riduci la sessione e torna indietro" }),
    page.getByRole("button", { name: "TERMINA" }),
    page.getByRole("button", { name: "Aggiungi esercizio" }),
  ];

  for (const bersaglio of bersagli) {
    const box = await bersaglio.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.width).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/**
 * §8.9 — **un solo `<nav aria-label="Navigazione principale">` per documento**, e da
 * 1024 in su e' la sidebar da 264px. Il rail da 240px della v1 non esiste piu'.
 */
test("la navigazione diventa la sidebar da 264px a partire da 1024px", async ({
  page,
}, testInfo) => {
  await page.goto("/home");
  await chiudiAvvisoIniziale(page);

  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(nav).toHaveCount(1);

  const box = await nav.boundingBox();
  expect(box).not.toBeNull();

  if (conSidebar(testInfo)) {
    expect(box!.width).toBe(264);
    expect(box!.height).toBeGreaterThan(400);
  } else {
    // bottom nav: larga quanto lo schermo, alta 56px + safe area
    expect(box!.width).toBeGreaterThanOrEqual(375);
    expect(box!.height).toBeLessThanOrEqual(80);
  }
});

/** Le cinque tab nuove di v2 ci sono, e sono cinque (§4.11). */
test("le cinque destinazioni sono quelle di v2", async ({ page }) => {
  await page.goto("/home");
  await chiudiAvvisoIniziale(page);
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  for (const voce of ["Home", "Allenamento", "Trainer", "Esercizi", "Profilo"]) {
    await expect(nav.getByRole("link", { name: voce, exact: true })).toBeVisible();
  }
});

test("axe: nessuna violazione sulle rotte costruite", async ({ page }, testInfo) => {
  await preparaDati(page);
  for (const rotta of ROTTE) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    await animazioniFinite(page);
    const risultato = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      risultato.violations.map((v) => `${rotta}: ${v.id} (${v.nodes.length})`),
      `${rotta} @ ${testInfo.project.name}`,
    ).toEqual([]);
  }
});

test("axe: la sessione attiva, con serie compilate", async ({ page }) => {
  await preparaDati(page);
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill("Test a11y");
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();
  const foglio = page.getByRole("dialog");
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill("Squat (Bilanciere)");
  await foglio.getByRole("checkbox", { name: /^Squat \(Bilanciere\)/ }).click();
  await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();
  await page.getByRole("button", { name: "Salva routine" }).click();
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione/);

  await page.getByLabel(/Peso in chili, serie 1,/).fill("100");
  await page.getByLabel(/Ripetizioni, serie 1,/).fill("5");
  await page.getByRole("checkbox", { name: /Completa serie 1/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await animazioniFinite(page);

  const risultato = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(risultato.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

  // e con il foglio dei dischi aperto
  await page.getByRole("button", { name: /Azioni per Squat/ }).click();
  await page.getByRole("menuitem", { name: "Calcola dischi" }).click();
  await expect(page.getByRole("dialog")).toContainText("Per lato");
  await animazioniFinite(page);
  const conFoglio = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(conFoglio.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});
