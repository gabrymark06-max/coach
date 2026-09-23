import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Il `<main>` delle rotte che stanno **fuori dal guscio** — sessione, riepilogo,
 * impostazioni, questionario.
 *
 * Esiste per un difetto preciso (QA GRAVE 5): `<main id="contenuto">` viveva solo
 * dentro `AppShell` e dentro il layout delle impostazioni, quindi `/sessione` — la
 * rotta su cui si passa tutto il tempo — non aveva un landmark, non aveva un `h1`, e
 * lo skip link globale puntava a un bersaglio che non c'era. Tre regole axe insieme.
 *
 * La regola che chiude: **ogni rotta monta esattamente un `<main id="contenuto">` e
 * esattamente un `<h1>` dentro di esso** (§8.9). Qui c'e' il primo; il secondo lo mette
 * chi usa il componente, in ogni ramo — anche in quello di caricamento e in quello
 * d'errore, che sono rotte a pieno titolo.
 */
export function RouteMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main id="contenuto" tabIndex={-1} className={cn("min-h-dvh", className)}>
      {children}
    </main>
  );
}
