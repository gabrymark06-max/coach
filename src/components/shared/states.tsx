"use client";

import { AlertTriangle, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AsyncState } from "@/lib/hooks/use-live-data";
import { cn } from "@/lib/utils";

/**
 * `EmptyState` — §4.15.
 * Icona lucide (mai emoji) → titolo → una riga → una CTA primaria.
 * Lo stato vuoto e' la schermata che ogni utente nuovo vede per prima: e' un invito
 * ad agire, non un buco.
 */
export function EmptyState({
  icon: Icon,
  title,
  line,
  action,
  secondary,
  className,
}: {
  icon: LucideIcon;
  title: string;
  line: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-80 flex-col items-center gap-4 px-5 py-11 text-center",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-10 text-[var(--text-muted)]" strokeWidth={1.75} />
      <h3 className="text-h3 text-[var(--text-primary)]">{title}</h3>
      <p className="text-base text-[var(--text-secondary)]">{line}</p>
      {action ? <div className="mt-2 w-full">{action}</div> : null}
      {secondary ? <div className="w-full">{secondary}</div> : null}
    </div>
  );
}

/**
 * `ErrorState` — §4.14: il messaggio sta accanto a cio' che ha fallito, con icona e
 * testo (mai solo rosso), e ha sempre una via d'uscita.
 */
export function ErrorState({
  title = "Non riesco a leggere i dati di questo dispositivo.",
  detail,
  onRetry,
  className,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-[var(--danger)]",
        "bg-[var(--card)] p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--danger)]"
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <p className="text-base text-[var(--text-primary)]">{title}</p>
          {detail ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Riprova
        </Button>
      ) : null}
    </div>
  );
}

export function ListSkeleton({ rows = 5, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} style={{ height }} />
      ))}
    </div>
  );
}

/**
 * I tre stati di ogni lettura, in un posto solo.
 *
 * Il vuoto non e' opzionale: `empty` va passato ogni volta che il dato puo' essere una
 * lista vuota. Se non lo si passa, si renderizza comunque il contenuto — ed e' una
 * scelta esplicita di chi chiama, non una dimenticanza silenziosa.
 */
export function Async<T>({
  state,
  loading,
  empty,
  isEmpty,
  children,
  errorDetail,
}: {
  state: AsyncState<T> & { retry: () => void };
  loading: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
  errorDetail?: string;
}) {
  if (state.status === "loading") return <>{loading}</>;
  if (state.status === "error") {
    return (
      <ErrorState
        detail={errorDetail ?? state.error.message}
        onRetry={state.retry}
      />
    );
  }
  if (empty && isEmpty?.(state.data)) return <>{empty}</>;
  return <>{children(state.data)}</>;
}
