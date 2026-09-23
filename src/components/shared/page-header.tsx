import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Intestazione di pagina: un solo `<h1>` per rotta, gerarchia senza salti (§8.9).
 *
 * `focusable` mette l'`h1` nel mirino di `focus()` senza metterlo nel tab order: serve
 * alla libreria a due pannelli, dove dopo aver scelto una voce nell'elenco il fuoco
 * deve atterrare sul titolo del dettaglio (§8.10) invece di restare nella colonna di
 * destra a dodici tabulazioni di distanza.
 */
export function PageHeader({
  title,
  action,
  children,
  focusable,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  focusable?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "app-container flex flex-wrap items-center justify-between gap-4 pt-9 pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          id={focusable ? "titolo-pagina" : undefined}
          tabIndex={focusable ? -1 : undefined}
          className="text-h1 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {title}
        </h1>
        {children}
      </div>
      {action}
    </header>
  );
}
