import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * axe calcola il colore **compositato**: se misura durante una dissolvenza di ingresso
 * vede un contrasto che non esiste. Si aspetta la fine delle animazioni.
 */
async function animazioniFinite(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

const ROTTE = [
  "/allenamento",
  "/allenamento/routine/nuova",
  "/esercizi",
  "/esercizi/nuovo",
  "/profilo",
  "/misure",
  "/statistiche",
];

async function preparaDati(page: Page) {
  await page.goto("/esercizi");
  await expect(page.getByText(/^\d+ esercizi$/)).toBeVisible({ timeout: 15_000 });
}

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
  await page.getByRole("button", { name: "Avvia sessione vuota" }).click();
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

test("la navigazione diventa un rail laterale da 1024px", async ({ page }, testInfo) => {
  await page.goto("/allenamento");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();

  if (testInfo.project.name === "desktop-1440") {
    expect(box!.width).toBe(240);
    expect(box!.height).toBeGreaterThan(400);
  } else {
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeLessThanOrEqual(80);
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
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill("squat con bilanciere");
  await foglio.getByRole("checkbox", { name: /Squat con bilanciere/ }).click();
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
