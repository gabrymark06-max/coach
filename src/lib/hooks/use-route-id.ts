"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DYNAMIC_SHELL_PARAM } from "@/lib/route-shell";

/**
 * Il parametro dinamico della rotta, letto dalla **barra degli indirizzi**.
 *
 * Perche' non basta `useParams()`: l'app deve aprirsi senza rete (spec §1, PWA). Le
 * rotte con un segmento dinamico — `/esercizi/[id]`, `/profilo/sessione/[id]`,
 * `/misure/[metrica]` — non possono essere prerenderizzate per ogni id possibile, cosi'
 * ognuna ha una **scocca** prerenderizzata con il segnaposto `_` (vedi
 * `generateStaticParams` nelle rispettive `page.tsx`), che il service worker serve per
 * qualunque id quando non c'e' connessione. In quella scocca `useParams()` risponde `_`:
 * l'unica fonte che non mente e' `location.pathname`.
 *
 * Online e in navigazione client il valore coincide con quello di `useParams()`, quindi
 * il comportamento non cambia; `usePathname()` resta la dipendenza che fa rileggere la
 * posizione a ogni cambio di rotta.
 */

const subscribe = () => () => {};
const readLocation = () => window.location.pathname;
const readServer = () => "";

export function useRouteId(fallback: string, position = -1): string {
  // `usePathname()` fa rileggere lo snapshot a ogni cambio di rotta; l'indirizzo vero
  // arriva da `location`, che in SSR e durante l'idratazione e' una stringa vuota.
  const pathname = usePathname();
  const live = useSyncExternalStore(subscribe, readLocation, readServer);

  const source = live || pathname;
  const segment = source.split("/").filter(Boolean).at(position);
  if (!segment || segment === DYNAMIC_SHELL_PARAM) {
    return fallback === DYNAMIC_SHELL_PARAM ? "" : fallback;
  }
  return decodeURIComponent(segment);
}
