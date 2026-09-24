import type { MetadataRoute } from "next";

/**
 * Manifest della PWA (spec §1).
 *
 * `theme_color` e `background_color` coincidono con `--background` (§11.2), cosi' la
 * barra di stato su iOS e Android non stona e la schermata d'avvio non lampeggia di
 * bianco. `display: standalone` perche' l'app si usa a schermo intero, come Hevy.
 *
 * `id` e `start_url` puntano a `/home`, che in v2 e' la home vera (§6.1: `/` fa
 * redirect a `/home`). Erano rimasti a `/allenamento` della v1: l'app installata si
 * apriva sulla tab 2 invece che sulla tab 1. Cambiare `id` dopo la pubblicazione
 * rinomina l'installazione, quindi si fa adesso, prima che qualcuno installi.
 *
 * Le scorciatoie sono le tre cose che si fanno entrando: allenarsi, aprire il programma
 * del Trainer, guardare lo storico.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Lifted — diario di allenamento",
    short_name: "Lifted",
    description:
      "Routine, sessioni, timer di recupero, calcolatori, misure e statistiche. I dati restano su questo dispositivo.",
    lang: "it",
    dir: "ltr",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0C0E",
    theme_color: "#0B0C0E",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Allenati", short_name: "Allenati", url: "/allenamento" },
      { name: "Trainer", short_name: "Trainer", url: "/trainer" },
      { name: "Storico", short_name: "Storico", url: "/profilo" },
    ],
  };
}
