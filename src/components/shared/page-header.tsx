import type * as React from "react";

/** Intestazione di pagina: un solo `<h1>` per rotta, gerarchia senza salti (§8.9). */
export function PageHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="app-container flex flex-wrap items-center justify-between gap-4 pt-9 pb-5">
      <div className="min-w-0">
        <h1 className="text-h1 text-[var(--text-primary)]">{title}</h1>
        {children}
      </div>
      {action}
    </header>
  );
}
