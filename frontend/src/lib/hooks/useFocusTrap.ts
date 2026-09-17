"use client";

// Fogli e pannelli (§5.3): Esc chiude, il focus resta dentro quando il foglio è modale, e torna a chi lo ha aperto.
import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Esc → onClose. Il listener vive sul documento perché il foglio non è sempre l'elemento a fuoco. */
export function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** Tab e Shift+Tab girano dentro `box` finché `active`. Il titolo con tabindex=-1 non entra nel giro. */
export function useFocusTrap(box: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const el = box.current;
      if (!el) return;
      const f = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (f.length === 0) {
        e.preventDefault();
        return;
      }
      const first = f[0]!;
      const last = f[f.length - 1]!;
      // -1: fuori dal foglio, o sul titolo (tabindex=-1): in entrambi i casi si rientra dal capo giusto
      const idx = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          last.focus();
        }
      } else if (idx === -1 || idx === f.length - 1) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [box, active]);
}

/** Alla chiusura il focus torna all'elemento che ha aperto il foglio (o a chi era a fuoco al mount), se è ancora nel DOM. */
export function useReturnFocus(returnTo?: RefObject<HTMLElement | null>): void {
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // chi ha aperto il foglio esiste già al mount: lo si fissa qui, non alla chiusura
    const opener = returnTo?.current ?? null;
    return () => {
      const target = opener ?? previous.current;
      if (target && target.isConnected) requestAnimationFrame(() => target.focus());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
