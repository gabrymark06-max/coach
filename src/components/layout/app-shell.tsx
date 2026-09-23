"use client";

import * as React from "react";
import { BottomNav } from "./bottom-nav";
import { RailTargetContext } from "./right-rail";
import { Sidebar } from "./sidebar";
import { useHasRightRail, useIsDesktop } from "@/lib/hooks/use-media-query";
import { useActiveSession } from "@/lib/session-context";

/**
 * Il guscio delle cinque tab — §7.4 e §7.5.
 *
 * Tre forme, una sola struttura di DOM:
 *
 * ```
 * < 1024   bottom nav + una colonna
 * >=1024   sidebar 264px + colonna centrale a 760px
 * >=1280   sidebar 264px + centro + colonna destra 320px
 * ```
 *
 * **Ordine del DOM: skip link, `nav`, `main`, `aside`** — e non cambia a nessuna
 * larghezza. L'unica eccezione motivata e' la libreria a due pannelli, che si risolve
 * con due link reali (§4.26) e non con un `tabindex` acrobatico.
 *
 * **Un solo `<nav aria-label="Navigazione principale">`** (§8.9): la bottom nav e la
 * sidebar non coesistono mai, nemmeno con una delle due a `display:none` in un ramo di
 * React che resta montato. Per questo la soglia passa da `useIsDesktop` e non da una
 * media query CSS: una media query nasconde, non smonta.
 *
 * Fra 768 e 1023 non cambia **niente** rispetto alla v1 (§7.6): bottom nav, contenuto a
 * 680px. La soglia sta a 1024 perche' e' li' che il dispositivo smette di essere quasi
 * sempre touch.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const desktop = useIsDesktop();
  const hasRail = useHasRightRail();
  const { data: session, status } = useActiveSession();
  const hasSession = status === "ready" && Boolean(session);

  /*
    Il bersaglio del portale della colonna destra. E' uno stato e non un `useRef`
    perche' i figli devono ri-renderizzare quando il nodo compare: con un ref
    resterebbero in attesa di un aggiornamento che non arriva mai.
  */
  const [railTarget, setRailTarget] = React.useState<HTMLElement | null>(null);

  return (
    <RailTargetContext.Provider value={railTarget}>
      <div className="shell min-h-dvh">
        {desktop ? <Sidebar /> : null}

        <div className="shell__content">
          <main
            id="contenuto"
            tabIndex={-1}
            data-session={hasSession ? "true" : "false"}
            className="app-main min-w-0"
          >
            {children}
          </main>

          {hasRail ? (
            <aside
              ref={setRailTarget}
              aria-label="Riepilogo e azioni rapide"
              className="rail-right flex min-w-0 flex-col gap-5 pb-9"
            />
          ) : null}
        </div>

        {desktop ? null : <BottomNav />}
      </div>
    </RailTargetContext.Provider>
  );
}
