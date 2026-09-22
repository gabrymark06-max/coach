"use client";

import { ArrowDown, ArrowUp, MoreVertical } from "lucide-react";
import Link from "next/link";
import type { Routine } from "@/lib/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatExerciseCount, formatRelativeDay } from "@/lib/format";
import { useMounted } from "@/lib/hooks/use-now";

/**
 * `RoutineCard` — §4.7.
 *
 * `AVVIA` disabilitato su una routine senza esercizi **non e' mai muto**: accanto c'e'
 * il testo che spiega perche' (§4.14).
 */
export function RoutineCard({
  routine,
  index,
  total,
  onStart,
  onDuplicate,
  onDelete,
  onMove,
}: {
  routine: Routine;
  index: number;
  total: number;
  onStart: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}) {
  const mounted = useMounted();
  const empty = routine.exercises.length === 0;
  const names = routine.exercises.map((item) => item.exerciseName);

  return (
    <article className="flex min-h-22 flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-h3 text-[var(--text-primary)]">
            <Link
              href={`/allenamento/routine/${routine.id}`}
              className="rounded-[var(--radius-sm)] hover:text-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              {routine.name}
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {empty ? "Nessun esercizio" : names.join(" · ")}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {formatExerciseCount(routine.exercises.length)}
            {routine.lastPerformedAt && mounted
              ? ` · ultimo: ${formatRelativeDay(routine.lastPerformedAt)}`
              : null}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Azioni per la routine ${routine.name}`}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <MoreVertical aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/allenamento/routine/${routine.id}/modifica`}>Modifica</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>Duplica</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" /> Sposta su
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
              <ArrowDown aria-hidden="true" /> Sposta giù
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              Elimina routine
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-end gap-3">
        {empty ? (
          <p className="min-w-0 flex-1 text-sm text-[var(--text-muted)]">
            Aggiungi almeno un esercizio per avviarla
          </p>
        ) : null}
        <Button onClick={onStart} disabled={empty} className="h-12 px-5">
          AVVIA
        </Button>
      </div>
    </article>
  );
}

/**
 * Lo scheletro della card, **con la stessa struttura della card vera**.
 *
 * Non e' un rettangolo di altezza indovinata: e' lo stesso guscio con dentro dei blocchi
 * grigi, quindi l'altezza coincide per costruzione e non c'e' salto di layout quando il
 * dato arriva. (Il primo intervento misurava 0,0414 di CLS su `/allenamento` proprio per
 * questo: skeleton da 88px, card da 172.)
 */
export function RoutineCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="flex min-h-22 flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-2/3 rounded-[var(--radius-sm)]" />
          <Skeleton className="mt-1 h-5 w-full rounded-[var(--radius-sm)]" />
          <Skeleton className="mt-1 h-5 w-1/3 rounded-[var(--radius-sm)]" />
        </div>
        <div className="size-12 shrink-0" />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-12 w-28 rounded-[var(--radius-btn)]" />
      </div>
    </article>
  );
}
