"use client";

import { Plus, SearchX } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { EmptyState, ListSkeleton, Async } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { getDb } from "@/lib/db/db";
import { listExercises } from "@/lib/db/queries";
import type { Exercise } from "@/lib/db/schema";
import { useLiveData } from "@/lib/hooks/use-live-data";
import {
  EMPTY_FILTER,
  ExerciseFilters,
  type ExerciseFilterValue,
} from "./exercise-filters";
import { ExerciseSelectRow } from "./exercise-row";

/**
 * Selezione esercizio — `?picker=exercise` (§6.1).
 * Selezione multipla: in sessione si aggiungono tre esercizi in un colpo solo,
 * non tre volte lo stesso foglio.
 */
export function ExercisePickerSheet({
  open,
  onOpenChange,
  onConfirm,
  title = "Aggiungi esercizi",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (exercises: Exercise[]) => void;
  title?: string;
}) {
  const [filter, setFilter] = React.useState<ExerciseFilterValue>(EMPTY_FILTER);
  const [selected, setSelected] = React.useState<string[]>([]);

  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFilter(EMPTY_FILTER);
      setSelected([]);
    }
  }

  const state = useLiveData(
    () => listExercises(getDb(), filter),
    [filter.q, filter.muscleGroup, filter.equipment],
  );

  const rows = React.useMemo(() => state.data ?? [], [state.data]);
  const byId = React.useMemo(
    () => new Map(rows.map((exercise) => [exercise.id, exercise])),
    [rows],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title} className="md:w-[560px]">
        <div className="flex flex-col gap-4">
          <ExerciseFilters value={filter} onChange={setFilter} resultCount={rows.length} />

          <Async
            state={state}
            loading={<ListSkeleton rows={6} />}
            isEmpty={(data) => data.length === 0}
            empty={
              <EmptyState
                icon={SearchX}
                title="Nessun risultato"
                line="Nessun esercizio con questi filtri."
                action={
                  <Button variant="secondary" block onClick={() => setFilter(EMPTY_FILTER)}>
                    Azzera filtri
                  </Button>
                }
                secondary={
                  <Button variant="ghost" block asChild>
                    <Link href="/esercizi/nuovo">Crea esercizio personalizzato</Link>
                  </Button>
                }
              />
            }
          >
            {(data) => (
              <ul className="-mx-5 md:mx-0">
                {data.map((exercise) => (
                  <li key={exercise.id} className="list-cv">
                    <ExerciseSelectRow
                      exercise={exercise}
                      selected={selected.includes(exercise.id)}
                      onToggle={() =>
                        setSelected((current) =>
                          current.includes(exercise.id)
                            ? current.filter((id) => id !== exercise.id)
                            : [...current, exercise.id],
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>

        <SheetFooter>
          <Button
            block
            size="lg"
            className="md:w-auto"
            disabled={selected.length === 0}
            onClick={() => {
              const picked = selected
                .map((id) => byId.get(id))
                .filter((item): item is Exercise => Boolean(item));
              onConfirm(picked);
              onOpenChange(false);
            }}
          >
            <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {selected.length === 0
              ? "Scegli almeno un esercizio"
              : selected.length === 1
                ? "Aggiungi 1 esercizio"
                : `Aggiungi ${selected.length} esercizi`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
