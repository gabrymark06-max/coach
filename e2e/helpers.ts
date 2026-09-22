import { expect, type Page } from "@playwright/test";

/**
 * Lo stato dell'avviso, letto da IndexedDB.
 *
 * Non si apre il database se non esiste ancora (`indexedDB.databases()` lo dice senza
 * crearlo): aprirlo a vuoto creerebbe un "lifted" senza tabelle e Dexie si troverebbe
 * sotto i piedi un database che non ha scritto lui.
 */
async function avvisoGiaVisto(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const elenco = await indexedDB.databases();
    if (!elenco.some((voce) => voce.name === "lifted")) return false;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("lifted");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!db.objectStoreNames.contains("settings")) {
        db.close();
        return false;
      }
      const settings = await new Promise<{ onboardingSeenAt?: string } | undefined>(
        (resolve, reject) => {
          const request = db
            .transaction("settings", "readonly")
            .objectStore("settings")
            .get("singleton");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      db.close();
      return Boolean(settings?.onboardingSeenAt);
    } catch {
      return false;
    }
  });
}

/**
 * L'avviso "i tuoi dati restano su questo telefono" e' un dialog modale al primo avvio
 * (§5.1): finche' e' aperto, il suo scrim intercetta i tocchi e Radix mette
 * `aria-hidden` su tutto il resto. Lo si chiude come lo chiuderebbe l'utente, e si
 * **aspetta che la scelta sia scritta su IndexedDB**: finche' non e' committata, un
 * `page.goto` (che e' un caricamento vero) la annullerebbe e l'avviso tornerebbe.
 */
export async function chiudiAvvisoIniziale(page: Page) {
  if (await avvisoGiaVisto(page)) return;

  const bottone = page.getByRole("button", { name: "Ho capito" });
  await expect(bottone).toBeVisible({ timeout: 30_000 });
  await bottone.click();
  await expect(bottone).toBeHidden();
  await expect.poll(() => avvisoGiaVisto(page), { timeout: 15_000 }).toBe(true);
}

/** Primo avvio completato: avviso chiuso e libreria seminata. */
export async function preparaApp(page: Page) {
  await page.goto("/allenamento");
  await chiudiAvvisoIniziale(page);
  await page.goto("/esercizi");
  await expect(page.getByText(/^\d+ esercizi$/)).toBeVisible({ timeout: 20_000 });
}

/**
 * axe calcola il colore **compositato**: se misura durante una dissolvenza di ingresso
 * vede un contrasto che non esiste. Si aspetta la fine delle animazioni.
 */
export async function animazioniFinite(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}
