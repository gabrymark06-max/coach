import { expect, test } from "@playwright/test";
import { ESERCIZIO, chiudiAvvisoIniziale } from "./helpers";

/**
 * L'app non ha una rete da cui dipendere: deve aprirsi e funzionare senza connessione.
 *
 * Due condizioni, tutte e due vere:
 *  - **cache fredda** — prima apertura, il service worker si installa e precarica le
 *    scocche; subito dopo si stacca la rete e l'app deve ripartire;
 *  - **cache calda** — dopo aver girato per l'app, offline si deve poter registrare un
 *    allenamento intero e rileggerlo.
 */

async function attendiServiceWorker(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg?.active || !navigator.serviceWorker.controller) return 0;
          let pagine = 0;
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            pagine += keys.filter((r) =>
              ["/allenamento", "/sessione", "/statistiche", "/misure/_"].includes(
                new URL(r.url).pathname,
              ),
            ).length;
          }
          return pagine;
        }),
      { timeout: 60_000, message: "il service worker non ha precaricato le scocche" },
    )
    .toBeGreaterThanOrEqual(4);
}

test.describe("offline", () => {
  test.slow();

  test("a cache fredda l'app si riapre senza rete", async ({ page, context }) => {
    await page.goto("/allenamento");
    await attendiServiceWorker(page);
    await chiudiAvvisoIniziale(page);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Allenamento", level: 1 })).toBeVisible();

      // rotta statica
      await page.goto("/statistiche");
      await expect(page.getByRole("heading", { name: "Statistiche", level: 1 })).toBeVisible();

      // rotta con id: il service worker serve la scocca, la pagina legge l'id dall'indirizzo
      await page.goto("/misure/bodyweight");
      await expect(page.getByRole("heading", { name: "Peso corporeo", level: 1 })).toBeVisible();

      // navigazione dentro l'app
      await page.getByRole("link", { name: "Profilo" }).click();
      await expect(page.getByRole("heading", { name: "Profilo", level: 1 })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("a cache calda si registra un allenamento intero senza rete", async ({
    page,
    context,
  }) => {
    await page.goto("/allenamento");
    await attendiServiceWorker(page);
    await chiudiAvvisoIniziale(page);
    await page.goto("/esercizi");
    await expect(page.getByText(/^\d+ esercizi$/)).toBeVisible({ timeout: 20_000 });

    await context.setOffline(true);
    try {
      await page.goto("/allenamento");
      await page.getByRole("button", { name: "Avvia allenamento" }).click();
      await expect(page).toHaveURL(/\/sessione/, { timeout: 20_000 });

      await page.getByRole("button", { name: "Aggiungi esercizio" }).click();
      const foglio = page.getByRole("dialog");
      await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(ESERCIZIO);
      await foglio.getByRole("checkbox", { name: ESERCIZIO }).click();
      await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();

      await page.getByLabel(/Peso in chili, serie 1,/).first().fill("90");
      await page.getByLabel(/Ripetizioni, serie 1,/).first().fill("6");
      await page.getByRole("checkbox", { name: /Completa serie 1/ }).first().click();
      await page.getByRole("button", { name: "TERMINA" }).click();
      await page.getByRole("button", { name: "Termina", exact: true }).click();

      await expect(page).toHaveURL(/\/sessione\/riepilogo\//, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /^Riepilogo/, level: 1 })).toBeVisible();
      await expect(page.getByText("PR 1RM").first()).toBeVisible();

      // ricarica dura, sempre offline: il dato viene da IndexedDB, la scocca dalla precache
      await page.reload();
      await expect(page.getByRole("heading", { name: /^Riepilogo/, level: 1 })).toBeVisible();
      await expect(page.getByRole("definition").filter({ hasText: "540" })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});
