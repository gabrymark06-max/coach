/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Service worker (verifica #27: Serwist 9.5, variante Turbopack perché Next 16 compila con Turbopack).
// Precache: build di Next + /~offline. Runtime: le rotte /oggi/* in network-first con fallback alla cache, e la cache
// si scalda all'install (design §3.3: la shell di /oggi/* deve aprirsi senza rete anche alla prima seduta, QA G6);
// l'API non si cache-a mai (la bozza vive in IndexedDB, non nel SW).
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").origin;
const PAGES_OGGI = "pages-oggi";
/** Le shell che devono aprirsi senza rete: sono pagine client, l'HTML è uguale per tutti e la seduta arriva da IndexedDB. */
const OGGI_ROUTES = ["/oggi", "/oggi/seduta", "/oggi/readiness", "/oggi/chiusa"];

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // L'API non entra mai nella cache del SW: dati personali e stati che cambiano. La bozza vive in IndexedDB.
      matcher: ({ url }) => url.origin === API_ORIGIN,
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url }) => request.mode === "navigate" && url.pathname.startsWith("/oggi"),
      handler: new NetworkFirst({ cacheName: PAGES_OGGI, networkTimeoutSeconds: 4, matchOptions: { ignoreVary: true } }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Scalda la cache delle shell /oggi/* a ogni install (quindi a ogni build): la prima navigazione avviene prima che il SW
// controlli la pagina e non entrerebbe mai in cache da sola. Un errore su una rotta non blocca l'install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_OGGI);
      await Promise.all(
        OGGI_ROUTES.map(async (path) => {
          try {
            const res = await fetch(new Request(path, { cache: "reload", credentials: "same-origin" }));
            if (res.ok) await cache.put(path, res);
          } catch {
            // senza rete durante l'install: la rotta entrerà in cache alla prima visita online
          }
        }),
      );
    })(),
  );
});

serwist.addEventListeners();
