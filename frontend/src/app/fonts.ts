// D10: next/font/local con i woff2 nel repo (istanze parziali: vedi src/fonts/README.md). Nessuna richiesta a Google.
// Metriche di fallback generate per ogni faccia.
//
// Cosa sta in preload e cosa no (QA M1/M2, mobile su Fast 3G): i tondi di Archivo, della voce e della nota sono sopra la
// piega su ogni schermata e sono piccoli (62 + 47 + 24 kB), quindi partono con l'HTML; i corsivi arrivano quando servono.
// I nomi dei file non hanno parentesi: con `Archivo[wdth,wght].woff2` il preload (URL percent-encoded) e il @font-face
// (URL grezzo) erano due URL diversi per Chrome, e il font si scaricava due volte.
import localFont from "next/font/local";

export const archivo = localFont({
  src: [{ path: "../fonts/Archivo-var.woff2", style: "normal", weight: "500 900" }],
  variable: "--font-archivo",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["Arial Narrow", "Arial", "system-ui", "sans-serif"],
});

// I numeri in riga (`.t-numero-riga`, `.set-input`, `.pill-rir`: 800, wdth 110): istanza statica a parte, 15 kB.
// Dentro il file variabile il fallback di next/font è calcolato sull'istanza di default (600, wdth 100), l'11 % più
// stretta: allo swap la riga del prezzo sulla landing si riavvolgeva (QA N3, CLS 0,020). Con l'istanza dedicata il
// size-adjust è quello dei numeri veri. Preload sì (QA R1): su /prezzi il primo paint usava Arial nuda prima ancora
// del fallback con size-adjust e la riga del prezzo cambiava a-capo (CLS 0,028); 15 kB davanti all'LCP costano meno.
export const archivoRiga = localFont({
  src: [{ path: "../fonts/Archivo-riga.woff2", style: "normal", weight: "800" }],
  variable: "--font-archivo-riga",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["Arial Narrow", "Arial", "system-ui", "sans-serif"],
});

// La voce (18–19 px, opsz automatico): istanza con opsz 16–24.
export const newsreader = localFont({
  src: [{ path: "../fonts/Newsreader-var.woff2", style: "normal", weight: "400" }],
  variable: "--font-newsreader",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const newsreaderItalic = localFont({
  src: [{ path: "../fonts/Newsreader-Italic-var.woff2", style: "italic", weight: "400" }],
  variable: "--font-newsreader-italic",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// La nota (14–15 px a opsz 10, token --opsz-nota): istanza statica a opsz 10. A quella misura ottica Newsreader è il 13 %
// più larga che a opsz 18 (xAvgCharWidth 1153 vs 1018): con un solo file il fallback di next/font veniva calcolato
// sull'istanza di default e al swap il badge AI guadagnava una riga spostando tutto il thread (QA M1, CLS 0,117 su /chat).
// Con l'istanza dedicata il size-adjust del fallback è quello giusto e il swap non muove nulla.
export const newsreaderNota = localFont({
  src: [{ path: "../fonts/Newsreader-nota.woff2", style: "normal", weight: "400" }],
  variable: "--font-newsreader-nota",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const newsreaderNotaItalic = localFont({
  src: [{ path: "../fonts/Newsreader-nota-Italic.woff2", style: "italic", weight: "400" }],
  variable: "--font-newsreader-nota-italic",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const fontClassName = [archivo, archivoRiga, newsreader, newsreaderItalic, newsreaderNota, newsreaderNotaItalic].map((f) => f.variable).join(" ");
