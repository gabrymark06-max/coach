import type { MetadataRoute } from "next";

/**
 * Manifest della PWA (spec §1).
 *
 * `theme_color` e `background_color` coincidono con `--background` (§11.2), cosi' la
 * barra di stato su iOS e Android non stona e la schermata d'avvio non lampeggia di
 * bianco. `display: standalone` perche' l'app si usa a schermo intero, come Hevy.
 *
 * Le scorciatoie sono le due cose che si fanno entrando: allenarsi e guardare lo storico.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/allenamento",
    name: "Lifted — diario di allenamento",
    short_name: "Lifted",
    description:
      "Routine, sessioni, timer di recupero, calcolatori, misure e statistiche. I dati restano su questo dispositivo.",
    lang: "it",
    dir: "ltr",
    start_url: "/allenamento",
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
      { name: "Storico", short_name: "Storico", url: "/profilo" },
    ],
  };
}
