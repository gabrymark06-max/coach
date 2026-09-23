import { expect, type Page, type TestInfo } from "@playwright/test";

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
 * Il nome di prova. In v2 ogni combinazione movimento x attrezzo e' una voce distinta,
 * quindi «Panca piana con bilanciere» si chiama «Panca piana (Bilanciere)» (§9.4).
 */
export const ESERCIZIO = "Panca piana (Bilanciere)";

/** Da 1280 in su la libreria e' a due pannelli e il profilo ha la colonna destra. */
export function duePannelli(testInfo: TestInfo): boolean {
  return testInfo.project.name === "desktop-1280" || testInfo.project.name === "desktop-1440";
}

/** Da 1024 in su la bottom nav non esiste piu': al suo posto c'e' la sidebar. */
export function conSidebar(testInfo: TestInfo): boolean {
  return testInfo.project.name.startsWith("desktop-");
}

/** Crea una routine con un esercizio, passando dal foglio di scelta (uguale ovunque). */
export async function creaRoutineConEsercizio(page: Page, nome: string) {
  await page.goto("/allenamento/routine/nuova");
  await page.getByLabel("Nome della routine").fill(nome);
  await page.getByRole("button", { name: "Aggiungi esercizi" }).click();
  const foglio = page.getByRole("dialog");
  await foglio.getByRole("searchbox", { name: "Cerca un esercizio" }).fill(ESERCIZIO);
  await foglio.getByRole("checkbox", { name: ESERCIZIO }).click();
  await foglio.getByRole("button", { name: "Aggiungi 1 esercizio" }).click();
  await page.getByRole("button", { name: "Salva routine" }).click();
  await expect(page).toHaveURL(/\/allenamento$/);
}

/**
 * Apre il dettaglio di un esercizio dalla libreria, **cercandolo**.
 *
 * Da 1280 in su l'elenco e' virtualizzato (§4.26): una voce a meta' alfabeto non esiste
 * nel DOM finche' non la si porta in vista, e un test che ci clicca sopra a freddo
 * fallirebbe per un motivo che non e' un difetto. Si cerca, come farebbe chiunque.
 */
export async function apriEsercizio(page: Page, nome: string) {
  await page.goto("/esercizi");
  await page.getByLabel("Cerca un esercizio").fill(nome);
  await page.getByRole("link", { name: nome }).first().click();
  await expect(page).toHaveURL(/\/esercizi\/lib-/);
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
