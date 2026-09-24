import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  animazioniFinite,
  creaRoutineConEsercizio,
  duePannelli,
  preparaApp,
  rispondiAlQuestionario,
} from "./helpers";

/**
 * Le misure del contratto — quelle che il secondo audit ha trovato fuori posto.
 *
 * Sono numeri, non impressioni: la larghezza della cella del calendario, l'eccedenza
 * orizzontale a zoom 200%, il totale esposto dalla lista virtualizzata, dove vive
 * `aria-invalid` nel questionario. Un contratto che nessuno misura torna a rompersi.
 */

test("DIFETTO 6 — a 188px CSS nessuno sborda piu'", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "telefono-375", "misura di zoom al 200%");
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Zoom");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await expect(page.getByRole("button", { name: "TERMINA" })).toBeVisible();

  for (const width of [188, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await page.waitForTimeout(300);
    const misura = await page.evaluate(() => {
      const doc = document.documentElement;
      const sborda: string[] = [];
      for (const node of document.querySelectorAll<HTMLElement>("body *")) {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.right > doc.clientWidth + 1) {
          sborda.push(`${node.tagName}.${node.className?.toString().slice(0, 20)} right=${Math.round(box.right)}`);
        }
      }
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        sborda: sborda.slice(0, 5),
      };
    });
    console.log(`[zoom ${width}px]`, JSON.stringify(misura));
    expect(misura.scrollWidth, `${width}px`).toBeLessThanOrEqual(misura.clientWidth + 1);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

test("DIFETTO 7 — la cella del calendario non scende sotto i 40px", async ({ page }, testInfo) => {
  test.skip(!duePannelli(testInfo), "il calendario entra nella colonna destra solo da 1280");
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Calendario");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await page.getByLabel(/^Peso in chili, serie/).first().fill("60");
  await page.getByLabel(/^Ripetizioni, serie/).first().fill("8");
  await page.getByRole("checkbox", { name: /^Completa serie/ }).first().click();
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//, { timeout: 20_000 });

  await page.goto("/profilo");
  await expect(page.getByRole("grid").first()).toBeVisible({ timeout: 20_000 });
  const cella = page.getByRole("gridcell").first();
  await expect(cella).toBeVisible({ timeout: 20_000 });
  const box = await cella.boundingBox();
  console.log(`[calendario ${testInfo.project.name}]`, JSON.stringify(box));
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(40);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
});

test("DIFETTO 5 — la libreria virtualizzata dice quante voci ha", async ({ page }, testInfo) => {
  test.skip(!duePannelli(testInfo), "l'elenco virtualizzato esiste da 1280");
  await preparaApp(page);
  await page.goto("/esercizi");
  await expect(page.getByText(/^\d+ esercizi$/).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
  const misura = await page.evaluate(() => {
    const ul = document.querySelector('ul[aria-label^="Esercizi"]');
    const righe = ul?.querySelectorAll("li") ?? [];
    return {
      etichetta: ul?.getAttribute("aria-label") ?? null,
      righeNelDom: righe.length,
      setsize:
        [...righe].find((li) => li.getAttribute("aria-setsize"))?.getAttribute("aria-setsize") ??
        null,
    };
  });
  console.log("[libreria]", JSON.stringify(misura));
  expect(misura.etichetta).toMatch(/Esercizi, \d+ in tutto/);
  expect(Number(misura.setsize)).toBeGreaterThan(misura.righeNelDom);
});

test("DIFETTO 8 — l'errore del questionario sta sul fieldset", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/trainer/questionario");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText(/Scegli un obiettivo/).first()).toBeVisible();
  await page.waitForTimeout(300);

  const misura = await page.evaluate(() => {
    const fieldset = document.querySelector("fieldset");
    const div = document.querySelector("div[aria-invalid]");
    return {
      fieldsetInvalid: fieldset?.getAttribute("aria-invalid") ?? null,
      fieldsetDescribedby: Boolean(fieldset?.getAttribute("aria-describedby")),
      divInvalid: div ? div.tagName : null,
      messaggio: document.activeElement?.textContent?.trim() ?? "",
    };
  });
  console.log("[questionario]", JSON.stringify(misura));
  expect(misura.fieldsetInvalid).toBe("true");
  expect(misura.fieldsetDescribedby).toBe(true);
  expect(misura.divInvalid).toBeNull();
  expect(misura.messaggio).toContain("obiettivo");
});

test("axe sulle rotte toccate", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "telefono-375" && testInfo.project.name !== "desktop-1440",
    "axe a 375 e 1440",
  );
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  const rotte = [
    "/home",
    "/trainer",
    "/trainer/questionario",
    "/profilo",
    "/esercizi",
    "/esercizi/lib-non-esiste-affatto",
    "/profilo/sessione/non-esiste",
  ];

  for (const rotta of rotte) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    await animazioniFinite(page);
    const esito = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    console.log(
      `[axe ${testInfo.project.name} ${rotta}] violazioni=${esito.violations.length}`,
    );
    expect(esito.violations.map((v) => `${rotta}: ${v.id}`)).toEqual([]);
  }
});
