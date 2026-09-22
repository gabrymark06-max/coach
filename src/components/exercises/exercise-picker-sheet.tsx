"use client";

import { Plus, Repeat2, SearchX } from "lucide-react";
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
 *
 * Due modi, stesso foglio:
 *  - `add` — **selezione multipla**: in sessione si aggiungono tre esercizi in un colpo
 *    solo, non tre volte lo stesso foglio;
 *  - `replace` — **selezione singola**: si sta sostituendo un esercizio, e sostituirlo
 *    con tre non vuol dire niente. Il pulsante dice con cosa.
 */
export function ExercisePickerSheet({
  open,
  onOpenChange,
  onConfirm,
  title = "Aggiungi esercizi",
  mode = "add",
  replacing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (exercises: Exercise[]) => void;
  title?: string;
  mode?: "add" | "replace";
  /** nome dell'esercizio che si sta sostituendo, per il microcopy */
  replacing?: string | null;
}) {
  const [filter, setFilter] = React.useState<ExerciseFilterValue>(EMPTY_FILTER);
  /**
   * La selezione tiene **gli esercizi**, non i loro id.
   *
   * Tenere solo gli id sembra piu' pulito, ma la riga selezionata sparisce appena si
   * cambia ricerca: al momento di confermare, l'id non si potrebbe piu' risolvere e la
   * scelta fatta due ricerche fa andrebbe persa in silenzio. Cercare "panca", spuntarla,
   * cercare "squat", spuntarla e ottenere un esercizio solo e' esattamente il tipo di
   * bug che non si nota finche' non si e' in palestra.
   */
  const [selected, setSelected] = React.useState<Exercise[]>([]);

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
  const selectedIds = React.useMemo(
    () => new Set(selected.map((exercise) => exercise.id)),
    [selected],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={title}
        description={
          mode === "replace" && replacing
            ? `Al posto di ${replacing}. Le serie restano, i valori inseriti si azzerano.`
            : undefined
        }
        className="md:w-[560px]"
      >
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
                      selected={selectedIds.has(exercise.id)}
                      onToggle={() =>
                        setSelected((current) => {
                          const presente = current.some((item) => item.id === exercise.id);
                          if (mode === "replace") return presente ? [] : [exercise];
                          return presente
                            ? current.filter((item) => item.id !== exercise.id)
                            : [...current, exercise];
                        })
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
              onConfirm(selected);
              onOpenChange(false);
            }}
          >
            {mode === "add" ? (
              <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
            ) : (
              <Repeat2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
            )}
            {selected.length === 0
              ? "Scegli un esercizio"
              : mode === "replace"
                ? `Sostituisci con «${selected[0]?.name ?? ""}»`
                : selected.length === 1
                  ? "Aggiungi 1 esercizio"
                  : `Aggiungi ${selected.length} esercizi`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
