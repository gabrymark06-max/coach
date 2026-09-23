import { test } from "@playwright/test";
import { creaRoutineConEsercizio, preparaApp } from "./helpers";

test("altezze", async ({ page }) => {
  await preparaApp(page);
  await creaRoutineConEsercizio(page, "Push A");
  await page.goto("/profilo");
  await page.waitForTimeout(1200);
  console.log("CAL", await page.evaluate(() => {
    const s = document.querySelector('section[aria-label="Calendario degli allenamenti"]');
    return s ? Math.round(s.getBoundingClientRect().height) : null;
  }));
  await page.goto("/sessione");
  await page.waitForTimeout(1200);
  console.log("SESS", await page.evaluate(() => document.body.innerText.slice(0, 80)));
});
