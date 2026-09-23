"use client";

import { useSyncExternalStore } from "react";

/**
 * Un media query letto da React.
 *
 * Serve per una cosa sola, e non e' un vezzo: §8.9 impone **un solo
 * `<nav aria-label="Navigazione principale">` per documento**, e vieta di tenerne due
 * montati con uno nascosto da `display:none`. Una media query CSS non basta — nasconde,
 * non smonta — quindi la soglia fra bottom nav e sidebar deve passare da qui.
 *
 * `useSyncExternalStore` con `getServerSnapshot` a `false` significa: sul server si
 * renderizza sempre la versione telefono, e al primo frame dopo l'idratazione il
 * desktop passa alla sidebar. Il costo e' un frame di bottom nav su schermo grande;
 * il guadagno e' che non esiste un istante in cui i due `<nav>` coesistono.
 */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => (typeof window === "undefined" ? false : window.matchMedia(query).matches),
    () => false,
  );
}

/** `--bp-lg`: da qui in su la bottom nav diventa la `Sidebar` (§7.4). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/** `--bp-3col`: da qui in su compare la colonna destra (§7.5). */
export function useHasRightRail(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}
