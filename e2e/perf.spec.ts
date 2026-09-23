import { test, expect } from "@playwright/test";
import { creaRoutineConEsercizio, preparaApp, rispondiAlQuestionario } from "./helpers";

/**
 * I numeri, presi dal browser. Una rotta per contesto pulito: registrare l'osservatore
 * subito dopo un `goto` incatenato misura a volte il documento precedente, e un numero
 * preso nel documento sbagliato e' peggio di nessun numero.
 */
const ROTTE = [
  "/home",
  "/allenamento",
  "/profilo",
  "/esercizi",
  "/statistiche",
  "/sessione",
  "/trainer",
  "/trainer/questionario",
  "/trainer/progressione",
];

/** Le rotte del Trainer hanno numeri veri solo con un programma dentro. */
const CON_PROGRAMMA = new Set(["/trainer", "/trainer/progressione"]);

for (const rotta of ROTTE) {
  test(`numeri ${rotta}`, async ({ page }) => {
    await preparaApp(page);
    if (rotta === "/home" || rotta === "/allenamento") await creaRoutineConEsercizio(page, "Push A");
    if (CON_PROGRAMMA.has(rotta)) await rispondiAlQuestionario(page);

    const bytes = { js: 0, css: 0 };
    page.on("response", async (r) => {
      const url = r.url();
      let len = Number(r.headers()["content-length"] ?? 0);
      if (!len) {
        try {
          len = (await r.body()).length;
        } catch {
          len = 0;
        }
      }
      if (url.endsWith(".js")) bytes.js += len;
      else if (url.endsWith(".css")) bytes.css += len;
    });

    await page.goto(rotta);
    const vitals = await page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) {
              const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
              if (!s.hadRecentInput) cls += s.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => resolve({ lcp: Math.round(lcp), cls: Number(cls.toFixed(4)) }), 1500);
        }),
    );
    console.log(
      `MISURA ${rotta} js=${Math.round(bytes.js / 1024)}KB css=${Math.round(bytes.css / 1024)}KB lcp=${vitals.lcp}ms cls=${vitals.cls}`,
    );
    expect(vitals.cls).toBeLessThan(0.1);
  });
}
