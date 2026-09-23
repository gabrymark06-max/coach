import { createSerwistRoute } from "@serwist/turbopack";
import { APP_VERSION } from "@/lib/app-version";

/**
 * Il service worker come **rotta statica**.
 *
 * Next 16 compila con Turbopack, che non accetta i plugin webpack: `@serwist/next`
 * classico fallirebbe il build. `@serwist/turbopack` prende la strada supportata —
 * un Route Handler prerenderizzato che, al build, esegue esbuild su `src/sw.ts` e
 * scrive `/serwist/sw.js` fra i file statici. In produzione non c'e' nessun lavoro a
 * runtime: la rotta e' gia' generata.
 *
 * `additionalPrecacheEntries` e' la parte che rende l'app davvero offline: il manifest
 * automatico contiene solo `.next/static` e `public/`, cioe' JS, CSS, font e icone. Le
 * **pagine** vanno elencate a mano, perche' il loro HTML non e' un file sul disco ma il
 * risultato del prerender. Qui ci sono tutte le rotte statiche piu' le scocche `_` delle
 * rotte con un id (vedi `lib/route-shell.ts`).
 */

/**
 * La revisione cambia a ogni build: la precache delle pagine si invalida da sola, e
 * un'installazione vecchia non resta appesa a una scocca superata.
 */
const REVISION = `${APP_VERSION}-${Date.now().toString(36)}`;

const PAGES = [
  "/",
  "/home",
  "/trainer",
  "/trainer/questionario",
  "/trainer/progressione",
  "/trainer/giorno/_",
  "/allenamento",
  "/allenamento/routine/nuova",
  "/allenamento/routine/_",
  "/allenamento/routine/_/modifica",
  "/profilo",
  "/profilo/sessione/_",
  "/esercizi",
  "/esercizi/nuovo",
  "/esercizi/_",
  "/esercizi/_/modifica",
  "/misure",
  "/misure/_",
  "/statistiche",
  "/sessione",
  "/sessione/riepilogo/_",
  "/impostazioni",
  "/impostazioni/allenamento",
  "/impostazioni/app",
  "/impostazioni/dati",
  "/impostazioni/info",
  "/manifest.webmanifest",
];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/sw.ts",
    additionalPrecacheEntries: PAGES.map((url) => ({ url, revision: REVISION })),
  });
