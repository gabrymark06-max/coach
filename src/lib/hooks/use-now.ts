"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Orologio condiviso per ridisegnare cronometro e timer.
 *
 * **Il tick non conta il tempo**: espone solo `Date.now()`, e chi lo usa ricalcola la
 * durata dai timestamp salvati (§10.5). Se la scheda va in background e il tick si
 * ferma, al ritorno il numero e' comunque giusto.
 *
 * Un solo `setInterval` per tutta l'app, e lo snapshot e' arrotondato all'intervallo
 * richiesto da chi legge: cosi' un componente che aggiorna al secondo non si ridisegna
 * quattro volte al secondo.
 */
const TICK_MS = 250;
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function publish() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(publish, TICK_MS);
    document.addEventListener("visibilitychange", publish);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", publish);
    }
  };
}

const noopSubscribe = () => () => {};

export function useNow(intervalMs = 1000, enabled = true): number {
  const getSnapshot = useCallback(() => {
    if (!enabled || current === 0) return 0;
    return Math.floor(current / intervalMs) * intervalMs;
  }, [intervalMs, enabled]);

  return useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    getSnapshot,
    () => 0,
  );
}

/** Vero solo dopo l'idratazione: serve a non formattare date durante l'SSR (§11.7). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
