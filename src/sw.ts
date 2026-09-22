/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import {
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type RouteHandlerCallback,
  type SerwistGlobalConfig,
} from "serwist";

/**
 * Il service worker di Lifted.
 *
 * L'app **non ha una rete da cui dipendere**: i dati stanno in IndexedDB e il server
 * serve solo a consegnare la scocca. Quindi l'obiettivo non e' "funzionare meglio
 * offline", e' **funzionare offline e basta**.
 *
 * Tre pezzi:
 *
 *  1. **Precache** — `self.__SW_MANIFEST` porta JS, CSS, font e icone del build; alle
 *     voci si aggiungono, dal route handler, gli indirizzi di tutte le pagine (vedi
 *     `app/serwist/[path]/route.ts`). All'installazione il service worker le scarica:
 *     dopo la prima apertura l'app parte anche senza connessione.
 *  2. **Navigazioni** — rete prima, con un timeout corto (in palestra il Wi-Fi che
 *     risponde in dieci secondi e' peggio di nessun Wi-Fi), poi la precache. Se
 *     l'indirizzo esatto non e' in precache — succede per le rotte con un id, che non si
 *     possono prerenderizzare tutte — si serve la **scocca della famiglia**
 *     (`/esercizi/_`, `/misure/_`, …) e la pagina legge l'id vero da `location`
 *     (`lib/hooks/use-route-id.ts`).
 *  3. **Resto** — le strategie consigliate da Serwist per Next.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Le famiglie di rotte con un segmento dinamico, e la scocca prerenderizzata che le
 * copre. L'ordine conta: il prefisso piu' lungo vince.
 */
const SHELLS: readonly [prefix: string, shell: string][] = [
  ["/esercizi/", "/esercizi/_"],
  ["/misure/", "/misure/_"],
  ["/profilo/sessione/", "/profilo/sessione/_"],
  ["/sessione/riepilogo/", "/sessione/riepilogo/_"],
  ["/allenamento/routine/", "/allenamento/routine/_"],
];

/** Le scocche con un sottolivello (`/esercizi/[id]/modifica`) hanno la loro variante. */
function shellFor(pathname: string): string | null {
  for (const [prefix, shell] of SHELLS) {
    if (!pathname.startsWith(prefix)) continue;
    const rest = pathname.slice(prefix.length);
    if (rest === "" || rest === "_") return shell;
    const tail = rest.split("/").slice(1).join("/");
    return tail === "" ? shell : `${shell}/${tail}`;
  }
  return null;
}

/**
 * Le richieste RSC: sono quelle che il router di Next fa quando si tocca un `<Link>`.
 *
 * Offline non esiste un modo onesto di inventare un payload RSC — dipende dallo stato
 * dell'albero del router e nessuno lo ha in cache. Ma Next ha gia' una via d'uscita:
 * quando la risposta **non** e' un payload RSC (`text/x-component`), il router smette di
 * navigare da solo e fa una navigazione vera del browser. Quella navigazione ripassa da
 * qui, e la scocca e' in precache.
 *
 * Quindi: rete prima; se la rete non c'e', si risponde con qualcosa che non e' RSC e la
 * navigazione diventa un caricamento di pagina. Il prefetch invece resta un errore
 * silenzioso: forzare una navigazione su un semplice prefetch sposterebbe l'utente da
 * solo.
 */
const handleRsc: RouteHandlerCallback = async ({ request }) => {
  try {
    return await fetch(request);
  } catch {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

const pagesStrategy = new NetworkFirst({
  cacheName: "lifted-pagine",
  networkTimeoutSeconds: 4,
  plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 30 * 24 * 60 * 60 })],
});

const handleNavigation: RouteHandlerCallback = async (options) => {
  try {
    const fromNetwork = await pagesStrategy.handle(options);
    if (fromNetwork) return fromNetwork;
  } catch {
    // Offline, o rete che non risponde entro il timeout: si passa alla precache.
  }

  const pathname = options.url.pathname;
  const candidates = [pathname, shellFor(pathname), "/allenamento"];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hit = await serwist.matchPrecache(candidate);
    if (hit) return hit;
  }
  return Response.error();
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true, concurrency: 8 },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: handleNavigation,
    },
    {
      matcher: ({ request, sameOrigin }) =>
        sameOrigin &&
        request.headers.get("RSC") === "1" &&
        request.headers.get("Next-Router-Prefetch") !== "1",
      handler: handleRsc,
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
