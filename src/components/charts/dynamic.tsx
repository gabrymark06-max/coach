"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "./chart-card";

/**
 * Recharts arriva **solo quando serve davvero**.
 *
 * Il primo intervento aveva 757 KB di JS: mettere una libreria di grafici nel bundle
 * comune li avrebbe peggiorati per ogni schermata, compresa la sessione in palestra —
 * che di grafici non ne ha nemmeno uno. Con `next/dynamic` e `ssr: false` Recharts vive
 * in un chunk suo, scaricato quando si apre Statistiche, Misure o il dettaglio di un
 * esercizio.
 *
 * `ssr: false` e' corretto due volte: i dati stanno in IndexedDB (sul server non
 * esistono) e un SVG renderizzato lato server verrebbe comunque rimisurato al mount.
 * Il `loading` ha l'altezza esatta del grafico, quindi non c'e' CLS.
 */

export const TrendChart = dynamic(
  () => import("./recharts-impl").then((mod) => mod.TrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const VolumeBars = dynamic(
  () => import("./recharts-impl").then((mod) => mod.VolumeBars),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const MuscleRadial = dynamic(
  () => import("./recharts-impl").then((mod) => mod.MuscleRadial),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export type { MuscleSlice } from "./recharts-impl";
