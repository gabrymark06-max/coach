"use client";

import { ArrowDown, ArrowUp, CheckCircle2, MoreVertical, Plus, Repeat2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EQUIPMENT_LABEL, type SessionExercise, type SetType } from "@/lib/db/schema";
import { setDisplayNumber } from "@/lib/db/session-ops";
import { cn } from "@/lib/utils";
import { SetRow } from "./set-row";

export interface ExerciseCardProps {
  exercise: SessionExercise;
  index: number;
  total: number;
  showRpe: boolean;
  stepKg: number;
  stepKgFine: number;
  readOnly?: boolean;
  onPatchSet: (setId: string, patch: { weightKg?: number | null; reps?: number | null; rpe?: number | null; type?: SetType }) => void;
  onToggleSet: (setId: string, completed: boolean) => void;
  onDeleteSet: (setId: string) => void;
  onCopyPrevious: (setId: string) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  onNotes: (notes: string) => void;
  onWarmup: () => void;
  onPlates: (weightKg: number | null) => void;
  onReplace?: () => void;
  /** maniglia di trascinamento, fornita dalla lista ordinabile */
  dragHandle?: React.ReactNode;
  errorBySetId?: Record<string, string>;
}

/**
 * `ExerciseCard` — §4.2.
 *
 * La tabella delle serie e' il punto piu' denso dell'app: righe da 52px, nessun
 * respiro superfluo. Quando tutte le serie sono completate la card **non** si chiude da
 * sola — lo segnala e basta.
 */
export function ExerciseCard({
  exercise,
  index,
  total,
  showRpe,
  stepKg,
  stepKgFine,
  readOnly,
  onPatchSet,
  onToggleSet,
  onDeleteSet,
  onCopyPrevious,
  onAddSet,
  onRemove,
  onMove,
  onNotes,
  onWarmup,
  onPlates,
  onReplace,
  dragHandle,
  errorBySetId,
}: ExerciseCardProps) {
  const [notesOpen, setNotesOpen] = React.useState(Boolean(exercise.notes));
  const done = exercise.sets.filter((set) => set.completed).length;
  const allDone = exercise.sets.length > 0 && done === exercise.sets.length;
  const headingId = `esercizio-${exercise.id}`;

  const firstWorkingWeight =
    exercise.sets.find((set) => set.type !== "warmup")?.weightKg ?? null;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 pt-5 pb-2 shadow-[var(--elev-1)]"
    >
      <header className="flex items-start gap-2 px-1">
        {dragHandle}
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="flex items-center gap-2 text-h2 text-[var(--text-primary)]">
            {allDone ? (
              <CheckCircle2
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--blue-brand)]"
                strokeWidth={1.75}
              />
            ) : null}
            <span className="min-w-0 break-words">{exercise.exerciseName}</span>
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {EQUIPMENT_LABEL[exercise.equipment]}
            {allDone ? (
              <>
                {" · "}
                <span className="tnum text-[var(--accent-blue)]">
                  {done}/{exercise.sets.length}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Azioni per ${exercise.exerciseName}`}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <MoreVertical aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setNotesOpen(true)}>
              Nota per questo esercizio
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onWarmup}>Calcola riscaldamento</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPlates(firstWorkingWeight)}>
              Calcola dischi
            </DropdownMenuItem>
            {onReplace ? (
              <DropdownMenuItem onSelect={onReplace}>
                <Repeat2 aria-hidden="true" /> Sostituisci esercizio
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp aria-hidden="true" /> Sposta su
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
              <ArrowDown aria-hidden="true" /> Sposta giù
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onRemove}>
              Rimuovi dalla sessione
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {notesOpen ? (
        <div className="mt-3 px-1">
          <label htmlFor={`nota-${exercise.id}`} className="sr-only">
            Nota per {exercise.exerciseName}
          </label>
          <textarea
            id={`nota-${exercise.id}`}
            defaultValue={exercise.notes ?? ""}
            rows={2}
            placeholder="Nota per questo esercizio…"
            onBlur={(event) => onNotes(event.currentTarget.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          />
        </div>
      ) : null}

      <table className="mt-4 w-full table-fixed border-collapse">
        <caption className="sr-only">
          Serie di {exercise.exerciseName}: {done} completate su {exercise.sets.length}
        </caption>
        <thead>
          <tr className="text-label text-[var(--text-secondary)]">
            <th scope="col" className="w-12 pb-2 text-center">
              Serie
            </th>
            <th scope="col" className="pb-2 text-center">
              Prec.
            </th>
            <th scope="col" className="pb-2 text-center">
              Kg
            </th>
            <th scope="col" className="w-16 pb-2 text-center">
              Reps
            </th>
            <th
              scope="col"
              className={cn("w-14 pb-2 text-center", showRpe ? "" : "hidden md:table-cell")}
            >
              <span translate="no">RPE</span>
            </th>
            <th scope="col" className="w-14 pb-2 text-center">
              <span className="sr-only">Completata</span>
              <span aria-hidden="true">✓</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              set={set}
              displayNumber={setDisplayNumber(exercise.sets, i)}
              exerciseName={exercise.exerciseName}
              showRpe={showRpe}
              stepKg={stepKg}
              stepKgFine={stepKgFine}
              readOnly={readOnly}
              error={errorBySetId?.[set.id] ?? null}
              onPatch={(patch) => onPatchSet(set.id, patch)}
              onToggleComplete={(completed) => onToggleSet(set.id, completed)}
              onDelete={() => onDeleteSet(set.id)}
              onCopyPrevious={() => onCopyPrevious(set.id)}
              onOpenPlates={() => onPlates(set.weightKg ?? set.prevWeightKg ?? null)}
            />
          ))}
        </tbody>
      </table>

      {exercise.sets.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-[var(--text-muted)]">
          Nessuna serie
        </p>
      ) : null}

      {readOnly ? null : (
        <Button variant="ghost" block className="mt-2" onClick={onAddSet}>
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Aggiungi serie
        </Button>
      )}
    </section>
  );
}
