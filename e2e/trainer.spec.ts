import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  animazioniFinite,
  conSidebar,
  creaRoutineConEsercizio,
  preparaApp,
  rispondiAlQuestionario,
} from "./helpers";

/**
 * Il Trainer, percorso davvero: sei domande, un programma generato, una sessione
 * avviata dalla card «Oggi» con i carichi **nei campi**, un allenamento registrato e il
 * carico che cambia con il perche' scritto accanto.
 *
 * Nessuno di questi passaggi e' verificabile con un test di unita': la logica pura ha i
 * suoi (64 casi in `src/lib/trainer`), qui si verifica che quella logica arrivi davvero
 * sotto le dita di chi la usa.
 */

/** Compila e chiude l'allenamento aperto, con lo stesso peso e le stesse ripetizioni. */
async function chiudiAllenamento(page: Page, peso: string, ripetizioni: string) {
  const campiPeso = page.getByLabel(/^Peso in chili, serie/);
  // `count()` non aspetta: senza questa riga, su una macchina un po' lenta il conteggio
  // esce zero, il ciclo non compila niente e il dialog che si apre e' quello della
  // sessione vuota — un fallimento che non parla del difetto vero.
  await expect(campiPeso.first()).toBeVisible({ timeout: 20_000 });
  const totale = await campiPeso.count();
  for (let i = 0; i < totale; i += 1) {
    await campiPeso.nth(i).fill(peso);
    await page.getByLabel(/^Ripetizioni, serie/).nth(i).fill(ripetizioni);
    await page.getByRole("checkbox", { name: /^Completa serie/ }).nth(i).click();
  }
  await page.getByRole("button", { name: "TERMINA" }).click();
  await page.getByRole("button", { name: "Termina", exact: true }).click();
  await expect(page).toHaveURL(/\/sessione\/riepilogo\//, { timeout: 20_000 });
}

test("dal questionario al programma, e la card «Oggi» ha i carichi e il perché", async ({
  page,
}) => {
  await preparaApp(page);
  await page.goto("/trainer");

  // stato «nessun programma»: un invito ad agire, non un buco
  await expect(page.getByRole("heading", { name: "Nessun programma" })).toBeVisible();
  await page.getByRole("link", { name: "Inizia il questionario" }).click();

  await rispondiAlQuestionario(page);

  // il programma c'e', con il nome che dichiara obiettivo, giorni e settimane
  await expect(page.getByRole("heading", { name: /Ipertrofia · 4 giorni · 8 settimane/ })).toBeVisible();
  await expect(page.getByText("Settimana 1 di 8")).toBeVisible();

  // la card «Oggi», e sotto ogni carico la riga del perche' — testo visibile, non tooltip
  await expect(page.getByRole("heading", { name: /^Giorno A/ })).toBeVisible();
  await expect(page.getByText("Prima volta — parti leggero e tara il carico").first()).toBeVisible();

  // l'accordion delle settimane, con la settimana corrente aperta
  await expect(page.getByRole("heading", { name: "Le settimane" })).toBeVisible();
  await expect(page.getByText("Settimana 1", { exact: false }).first()).toBeVisible();
});

test("il foglio «Perché questo carico» si apre, spiega e dice il prossimo passo", async ({
  page,
}) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  await page.getByRole("button", { name: /^Perché/ }).first().click();
  const foglio = page.getByRole("dialog");
  await expect(foglio.getByRole("heading", { name: "Prima volta" })).toBeVisible();
  // la frase del prossimo passo e' obbligatoria su ogni esercizio (§4.25)
  await expect(foglio.getByText("Che cosa serve per il prossimo passo")).toBeVisible();
  await expect(foglio.getByText(/margine/)).toBeVisible();

  // si chiude con Esc
  await page.keyboard.press("Escape");
  await expect(foglio).toBeHidden();
});

test("allenamento registrato: il carico della settimana dopo cambia e la riga lo spiega", async ({
  page,
}) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  // il carico si decide a mano la prima volta, poi si completa tutto in cima all'intervallo
  await page.getByRole("button", { name: "Avvia l'allenamento" }).click();
  await expect(page).toHaveURL(/\/sessione/);
  await chiudiAllenamento(page, "60", "8");

  // §6.8 passo 3: il perche' del prossimo carico, subito dopo la fatica
  await expect(page.getByRole("heading", { name: "Cosa cambia la prossima volta" })).toBeVisible();
  // il delta, senza l'unita': fra numero e «kg» c'e' uno spazio stretto (§5.5)
  await expect(page.getByText(/\+2,5|\+5|\+2/).first()).toBeVisible();

  await page.goto("/trainer");
  // oggi e' gia' fatto: il primario sparisce
  await expect(page.getByText("Fatto oggi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Avvia l'allenamento" })).toHaveCount(0);

  // il giorno gemello della settimana 2 porta il carico nuovo e il suo perche'
  await page.getByText("Settimana 2", { exact: false }).first().click();
  const giorno = page.getByRole("link", { name: /^Giorno A/ }).last();
  await giorno.click();
  await expect(page).toHaveURL(/\/trainer\/giorno\//);
  await expect(page.getByText(/serie su .* al tetto/).first()).toBeVisible();
});

test("il registro delle decisioni si filtra e resta nella query string", async ({ page }) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  await page.goto("/trainer/progressione");
  await expect(page.getByRole("heading", { name: "Progressione", level: 1 })).toBeVisible();
  // dopo la generazione il registro ha gia' le decisioni «prima volta» della settimana 1
  await expect(page.getByText(/^Prima volta —/).first()).toBeVisible();

  await page.getByRole("button", { name: "Riduzioni" }).click();
  await expect(page).toHaveURL(/filtro=riduzioni/);
  await expect(
    page.getByRole("heading", { name: "Nessuna riduzione di carico finora." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Azzera filtri" }).click();
  await expect(page).toHaveURL(/\/trainer\/progressione$/);
});

test("l'override manuale diventa la nuova base e finisce nel registro", async ({ page }) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  await page.getByRole("button", { name: /^Perché/ }).first().click();
  const foglio = page.getByRole("dialog");
  await foglio.getByRole("button", { name: "Non sono d'accordo" }).click();
  await foglio.getByLabel(/^Carico per /).fill("52,5");
  await foglio.getByRole("button", { name: "Usa questo carico" }).click();
  await expect(foglio).toBeHidden({ timeout: 15_000 });

  await expect(page.getByText(/Carico scelto da te/).first()).toBeVisible();

  await page.goto("/trainer/progressione?filtro=scelte");
  await expect(page.getByText("Tua scelta:").first()).toBeVisible();
});

test("la bozza del questionario riprende dal passo raggiunto", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/trainer/questionario");
  await page.getByRole("radio", { name: /Forza/ }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 6")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 6")).toBeVisible();

  // si esce e si torna: la dashboard propone di riprendere
  await page.goto("/trainer");
  await expect(
    page.getByRole("heading", { name: "Questionario in sospeso — passo 3 di 6" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Riprendi" }).click();
  await expect(page.getByText("Passo 3 di 6")).toBeVisible();
});

test("il primario resta abilitato e l'errore dice cosa fare", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/trainer/questionario?ricomincia=1");

  const avanti = page.getByRole("button", { name: "Avanti" });
  await expect(avanti).toBeEnabled();
  await avanti.click();
  await expect(page.getByText("Scegli un obiettivo per continuare.").first()).toBeVisible();
  await expect(page.getByText("Passo 1 di 6")).toBeVisible();
});

test("il backup porta con sé le tabelle del Trainer, e reimportarle rimette il programma", async ({
  page,
}) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  await page.goto("/impostazioni/dati");
  const scarica = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta backup JSON" }).click();
  const file = await scarica;
  const percorso = await file.path();

  const contenuto = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const conta = (store: string) =>
      new Promise<number>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const out = {
      programmi: await conta("trainerPrograms"),
      giorni: await conta("trainerDays"),
      decisioni: await conta("trainerDecisions"),
    };
    db.close();
    return out;
  });
  expect(contenuto.programmi).toBe(1);
  expect(contenuto.giorni).toBe(32);
  expect(contenuto.decisioni).toBeGreaterThan(0);

  // si reimporta lo stesso file: il programma deve tornare identico
  await page.setInputFiles("#file-backup", percorso);
  const conferma = page.getByRole("alertdialog");
  await expect(conferma).toContainText("formato versione 2");
  await page.getByRole("button", { name: "Sostituisci" }).click();
  await expect(conferma).toBeHidden({ timeout: 20_000 });
  await page.waitForTimeout(1500);

  await page.goto("/trainer");
  await expect(
    page.getByRole("heading", { name: /Ipertrofia · 4 giorni · 8 settimane/ }),
  ).toBeVisible({ timeout: 20_000 });
});

/**
 * Il tempo, senza aspettarlo davvero: si sposta indietro `startedAt` del programma in
 * IndexedDB, che e' l'unico dato da cui l'orologio del ciclo deriva la settimana
 * corrente. E' la stessa cosa che sarebbe successa lasciando passare otto giorni.
 */
async function faiPassareGiorni(page: Page, giorni: number) {
  await page.evaluate(async (n) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lifted");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = db.transaction("trainerPrograms", "readwrite").objectStore("trainerPrograms");
    const tutti = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const programma of tutti) {
      const data = new Date(programma.startedAt as string);
      data.setDate(data.getDate() - n);
      programma.startedAt = data.toISOString();
      store.put(programma);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    db.close();
  }, giorni);
}

test("settimana saltata: tre azioni, nessuna preselezionata, e il programma resta fermo", async ({
  page,
}) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  // otto giorni dopo, senza un allenamento registrato
  await faiPassareGiorni(page, 8);
  await page.reload();

  const banner = page.getByRole("status").filter({ hasText: "Hai saltato la settimana 1" });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner).toContainText("Non tocco niente finché non decidi.");

  // tre strade, e nessuna scelta al posto dell'utente
  const ripeti = banner.getByRole("button", { name: "Ripeti la settimana 1" });
  const avanti = banner.getByRole("button", { name: "Vai alla settimana 2" });
  const rigenera = banner.getByRole("button", { name: "Rigenera da qui" });
  for (const azione of [ripeti, avanti, rigenera]) {
    await expect(azione).toBeVisible();
    await expect(azione).not.toHaveAttribute("aria-pressed", "true");
    await expect(azione).not.toHaveAttribute("data-state", "on");
  }

  await avanti.click();
  await expect(banner).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText("Settimana 2 di 8")).toBeVisible();

  // la settimana saltata resta marcata: non si finge che sia successa
  await expect(page.getByText("saltata · 0 di 4 fatti").first()).toBeVisible();
});

test("axe non trova niente sulle rotte nuove del Trainer", async ({ page }) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  for (const rotta of ["/trainer", "/trainer/progressione", "/trainer/questionario"]) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    await animazioniFinite(page);
    const esito = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(esito.violations.map((v) => `${rotta}: ${v.id}`)).toEqual([]);
  }
});

test("un solo main, un solo h1 e un solo nav su ogni rotta del Trainer", async ({ page }) => {
  await preparaApp(page);
  await rispondiAlQuestionario(page);

  const giorno = await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/trainer/giorno/"]');
    return link?.getAttribute("href") ?? null;
  });

  const rotte = ["/trainer", "/trainer/progressione", "/trainer/questionario"];
  if (giorno) rotte.push(giorno);

  for (const rotta of rotte) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    const conteggi = await page.evaluate(() => ({
      main: document.querySelectorAll("main").length,
      h1: document.querySelectorAll("h1").length,
      nav: document.querySelectorAll('nav[aria-label="Navigazione principale"]').length,
    }));
    expect(conteggi.main, rotta).toBe(1);
    expect(conteggi.h1, rotta).toBe(1);
    expect(conteggi.nav, rotta).toBeLessThanOrEqual(1);
  }
});

test("/trainer/nuovo porta al questionario", async ({ page }) => {
  await preparaApp(page);
  await page.goto("/trainer/nuovo");
  await expect(page).toHaveURL(/\/trainer\/questionario/);
  await expect(page.getByText("Passo 1 di 6")).toBeVisible();
});

/**
 * IL BLOCCANTE del secondo audit, percorso come lo ha percorso il QA: **si allena
 * prima e si genera dopo.**
 *
 * La suite generava sempre da un database senza storico, che e' l'unico caso in cui la
 * generazione funzionava. Questo test e' il caso reale: il Trainer e' un'aggiunta a un
 * tracker che l'utente usa gia'.
 */
test("si genera il programma anche con uno storico di allenamenti alle spalle", async ({
  page,
}) => {
  await preparaApp(page);

  // 1 — un allenamento vero su un esercizio che il generatore mette in settimana 1
  await creaRoutineConEsercizio(page, "Storico");
  await page.getByRole("button", { name: "AVVIA", exact: true }).click();
  await chiudiAllenamento(page, "80", "8");

  // 2 — e adesso il questionario, dall'inizio alla fine
  await rispondiAlQuestionario(page);

  await expect(
    page.getByRole("heading", { name: /Ipertrofia · 4 giorni · 8 settimane/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Giorno A/ })).toBeVisible();

  // il carico dello storico e' dentro il programma, e la riga dice da dove viene
  await expect(page.getByText(/dall'ultima volta che l'hai fatto/).first()).toBeVisible();

  // 3 — «Rigenera da qui» e «Cambia le risposte» passano dalla stessa porta
  await page.goto("/trainer/questionario");
  await page.getByRole("button", { name: "Genera il programma" }).click();
  await expect(page).toHaveURL(/\/trainer$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /Ipertrofia · 4 giorni · 8 settimane/ }),
  ).toBeVisible();
});

/**
 * DIFETTO 1: il questionario prometteva uno split e il generatore ne costruiva un
 * altro. Con il preset «Corpo libero» a 3 giorni la promessa adesso e' quella vera, e
 * il ripiego viene detto invece di essere scoperto dopo.
 */
test("il questionario promette lo split che il programma costruisce davvero", async ({
  page,
}) => {
  await preparaApp(page);
  await page.goto("/trainer/questionario");

  await page.getByRole("radio", { name: /Ipertrofia/ }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: /Corpo libero/ }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("radio", { name: /Intermedio/ }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  // passo 5: niente Push/Pull/Legs promesso a vuoto
  await page.getByRole("radio", { name: "3", exact: true }).click();
  await expect(page.getByText(/Full body ×3/).first()).toBeVisible();
  await expect(page.getByText(/lascerebbe dei giorni quasi vuoti/)).toBeVisible();
  await page.getByRole("radio", { name: "60 min" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  // passo 6: il riepilogo dice la stessa cosa
  await expect(page.getByText(/3 giorni da 60 minuti · Full body ×3/)).toBeVisible();
  await page.getByRole("button", { name: "Genera il programma" }).click();
  await expect(page).toHaveURL(/\/trainer$/, { timeout: 20_000 });

  // e i giorni costruiti sono quelli promessi
  await expect(page.getByRole("heading", { name: /^Giorno A · Full body/ })).toBeVisible();
});

/** §9.6: la card «Oggi» del Trainer sulla home, e il badge sulla voce della sidebar. */
test("la home mostra l'allenamento di oggi e la sidebar lo segnala", async ({
  page,
}, testInfo) => {
  await preparaApp(page);

  // senza programma la card non esiste: l'invito al Trainer sta in /trainer
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Giorno A/ })).toHaveCount(0);

  await rispondiAlQuestionario(page);
  await page.goto("/home");

  const card = page.getByRole("region", { name: /^Giorno A/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: /Avvia l'allenamento/ })).toBeVisible();
  await expect(card.getByRole("link", { name: "Vedi il programma" })).toBeVisible();

  if (conSidebar(testInfo)) {
    const voce = page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", {
      name: "Trainer, allenamento previsto oggi",
    });
    await expect(voce).toBeVisible();
    await expect(voce).toContainText("Oggi");
  }

  // dalla home si parte: un tocco, e si e' dentro la sessione del giorno
  await card.getByRole("button", { name: /Avvia l'allenamento/ }).click();
  await expect(page).toHaveURL(/\/sessione/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Altre azioni della sessione" }).click();
  await page.getByRole("menuitem", { name: /Scarta/ }).click();
  await page.getByRole("button", { name: "Scarta", exact: true }).click();
});

/** DIFETTO 3: anche uno stato «non trovato» e' una rotta, e ha il suo `h1`. */
test("le rotte che non esistono hanno comunque un solo h1", async ({ page }) => {
  await preparaApp(page);

  for (const rotta of [
    "/esercizi/lib-non-esiste-affatto",
    "/profilo/sessione/non-esiste",
    "/trainer/giorno/non-esiste",
  ]) {
    await page.goto(rotta);
    await page.waitForLoadState("networkidle");
    const conteggi = await page.evaluate(() => ({
      main: document.querySelectorAll("main").length,
      h1: document.querySelectorAll("h1").length,
      titolo: document.querySelector("h1")?.textContent ?? "",
    }));
    expect(conteggi.main, rotta).toBe(1);
    expect(conteggi.h1, rotta).toBe(1);
    expect(conteggi.titolo.trim().length, rotta).toBeGreaterThan(0);
  }
});

/** DIFETTO 4: l'app installata si apre sulla home vera, non sulla tab 2 della v1. */
test("il manifest parte da /home", async ({ page }) => {
  const risposta = await page.request.get("/manifest.webmanifest");
  expect(risposta.ok()).toBe(true);
  const manifest = await risposta.json();
  expect(manifest.start_url).toBe("/home");
  expect(manifest.id).toBe("/home");
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toContain("/trainer");
});
