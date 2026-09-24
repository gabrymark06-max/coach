"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useHasRightRail } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Il bersaglio dell'`<aside>`, pubblicato da `AppShell`. Vale `null` sotto 1280, dove
 * la colonna destra non esiste.
 */
export const RailTargetContext = React.createContext<HTMLElement | null>(null);

/**
 * `RightRail` — §4.20.
 *
 * Le card di supporto di una rotta. Sopra 1280 finiscono nell'`<aside>` del guscio con
 * un portale (cosi' l'ordine del DOM resta `main` poi `aside`); **sotto 1280 restano
 * dove il componente e' scritto**, cioe' in coda alla colonna centrale.
 *
 * E' la stessa istanza in entrambi i casi: non due alberi che si somigliano, uno dei
 * quali si dimentica di essere aggiornato. La regola «a 1279px nessun dato e' scomparso
 * rispetto a 1280px» (§8.10) qui e' vera per costruzione.
 */
export function RightRail({
  children,
  ready = true,
}: {
  children: React.ReactNode;
  /**
   * `false` finche' il contenuto **sopra** di lei non ha finito di caricare.
   *
   * Sotto 1280 questa colonna vive in coda al centro, quindi comparire mentre la
   * schermata principale sta ancora scambiando lo scheletro con il contenuto vero
   * significa farsi spingere in giu' — ed e' esattamente quello che il Cumulative
   * Layout Shift misura. Con `ready` a `false` non si monta affatto: niente si sposta
   * perche' non c'e' ancora niente sotto.
   */
  ready?: boolean;
}) {
  const target = React.useContext(RailTargetContext);
  const hasRail = useHasRightRail();

  if (hasRail) {
    // Un frame prima che il `ref` dell'aside sia attaccato: non si duplica il contenuto
    // nel centro, si aspetta.
    return target ? createPortal(children, target) : null;
  }

  if (!ready) return null;

  return (
    <div className="app-container mt-8 flex flex-col gap-5">
      <h2 className="sr-only">Riepilogo e azioni rapide</h2>
      {children}
    </div>
  );
}

/**
 * Una card della colonna destra. Padding `--space-5`, **16px contro i 20 della colonna
 * centrale**: e' una colonna di supporto, e la densita' lo dice prima del contenuto.
 */
export function RailCard({
  title,
  children,
  action,
  bleed,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /**
   * Il contenuto arriva ai bordi della card invece di stare dentro l'imbottitura.
   * Serve alla griglia del calendario: dentro i 16px per lato la cella scende a 37px,
   * sotto i 40px del cerchio che il sistema disegna (QA, secondo audit, DIFETTO 7).
   */
  bleed?: boolean;
}) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--elev-1)]"
    >
      <h2 id={titleId} className="text-h3 text-[var(--text-primary)]">
        {title}
      </h2>
      <div className={cn("mt-3", bleed && "-mx-4")}>{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

export interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Le «Azioni rapide» del riferimento (`Nuova routine ›`), ridisegnate con i token di v1:
 * righe da 48px, icona in un quadrato 32x32, separatore fra le righe, chevron a destra.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <ul className="-my-2">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <li key={action.href}>
            <Link
              href={action.href}
              className={cn(
                "flex h-12 items-center gap-3 rounded-[var(--radius-sm)] px-2",
                "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                index > 0 && "border-t border-[var(--border)]",
              )}
            >
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--popover)] text-[var(--text-secondary)]"
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate text-base">{action.label}</span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--text-muted)]"
                strokeWidth={1.75}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Una riga numerica di una card di riepilogo: etichetta a sinistra, numero a destra.
 *
 * In colonna e non in griglia: la colonna destra e' larga 288px al netto
 * dell'imbottitura, e tre celle affiancate con etichette come «ALLENAMENTI» si
 * toccherebbero. Qui il numero resta allineato a destra e si legge in colonna.
 */
export function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
      <dd className="tnum shrink-0 text-num-md text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}
