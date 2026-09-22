"use client";

import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: Error };

/**
 * Lettura reattiva da Dexie con i **tre stati espliciti**: caricamento, dato, errore.
 *
 * `liveQuery` rinotifica da solo a ogni scrittura sulle tabelle toccate, quindi la UI
 * resta allineata senza invalidazioni manuali. Lo stato vuoto non e' qui: e' una
 * proprieta' del dato (lista di lunghezza zero) e lo decide chi renderizza.
 */
export function useLiveData<T>(
  querier: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { retry: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: undefined,
    error: undefined,
  });

  const retry = useCallback(() => {
    setState({ status: "loading", data: undefined, error: undefined });
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    const subscription = liveQuery(querier).subscribe({
      next: (data) => {
        if (alive) setState({ status: "ready", data, error: undefined });
      },
      error: (error: unknown) => {
        if (alive) {
          setState({
            status: "error",
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, retry };
}
