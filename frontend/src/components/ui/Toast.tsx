"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastState = { id: number; text: string } | null;
const Ctx = createContext<(text: string) => void>(() => {});

/** Toast (§2.14): solo per conferme ("Seduta sincronizzata"), 6 s, chiudibile. Mai per errori. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);
  useEffect(() => {
    if (!toast) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 6000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [toast]);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <div className="toast t-corpo" role="status">
          <span>{toast.text}</span>
          <button type="button" className="btn btn-tertiary" onClick={() => setToast(null)}>
            Chiudi
          </button>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
