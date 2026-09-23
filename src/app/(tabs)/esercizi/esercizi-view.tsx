"use client";

import { Dumbbell, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  EMPTY_FILTER,
  ExerciseFilters,
  type ExerciseFilterValue,
} from "@/components/exercises/exercise-filters";
import { ExerciseLinkRow } from "@/components/exercises/exercise-row";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  ExerciseLibraryRail,
  VaiAllElenco,
} from "@/components/exercises/exercise-library-rail";
import { announce } from "@/lib/announce";
import { useHasRightRail } from "@/lib/hooks/use-media-query";
import { getDb } from "@/lib/db/db";
import { listExercises } from "@/lib/db/queries";
import type { Equipment, MuscleGroup } from "@/lib/db/schema";
import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from "@/lib/db/schema";
import { seedLibrary } from "@/lib/db/seed";
import { useLiveData } from "@/lib/hooks/use-live-data";

/**
 * Libreria esercizi — §4.8.
 *
 * I filtri stanno **nella query string**, non in `useState` (§11.5): sono condivisibili,
 * il tasto Indietro li annulla e ricaricare non azzera la vista.
 */
export function EserciziView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRail = useHasRightRail();

  const filter = React.useMemo<ExerciseFilterValue>(
    () => ({
      q: searchParams.get("q") ?? "",
      muscleGroup: asMuscle(searchParams.get("muscolo")),
      equipment: asEquipment(searchParams.get("attrezzo")),
    }),
    [searchParams],
  );

  const setFilter = React.useCallback(
    (next: ExerciseFilterValue) => {
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      if (next.muscleGroup) params.set("muscolo", next.muscleGroup);
      if (next.equipment) params.set("attrezzo", next.equipment);
      const query = params.toString();
      router.replace(query ? `/esercizi?${query}` : "/esercizi", { scroll: false });
    },
    [router],
  );

  const state = useLiveData(
    () => listExercises(getDb(), filter),
    [filter.q, filter.muscleGroup, filter.equipment],
  );

  const count = state.data?.length ?? 0;
  React.useEffect(() => {
    if (state.status === "ready") {
      announce("system", `${count} esercizi trovati.`);
    }
  }, [state.status, count]);

  const filterNames = [
    filter.muscleGroup ? MUSCLE_GROUP_LABEL[filter.muscleGroup] : null,
    filter.equipment ? EQUIPMENT_LABEL[filter.equipment] : null,
  ].filter(Boolean);

  const hasFilters = filterNames.length > 0 || filter.q !== "";

  /*
    §4.26 — a >=1280 la libreria diventa **due pannelli**: l'elenco con i filtri passa
    nella colonna destra e il centro tiene il dettaglio. Qui, senza una voce scelta, il
    centro mostra lo stato «Scegli un esercizio»: e' lo stato del riferimento, e va
    implementato, non lasciato bianco.
  */
  if (hasRail) {
    return (
      <>
        <VaiAllElenco />
        <PageHeader title="Esercizio" />
        <div className="app-container">
          <EmptyState
            icon={Dumbbell}
            title="Scegli un esercizio"
            line="Seleziona una voce dall'elenco per vedere storico, 1RM stimato e record."
          />
        </div>
        <ExerciseLibraryRail basePath="/esercizi" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Esercizi"
        action={
          <Button variant="secondary" asChild>
            <Link href="/esercizi/nuovo">
              <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Nuovo
            </Link>
          </Button>
        }
      />

      <div className="app-container">
        <ExerciseFilters value={filter} onChange={setFilter} resultCount={count} />
      </div>

      <div className="mt-4">
        <Async
          state={state}
          loading={
            <div className="app-container">
              <ListSkeleton rows={8} />
            </div>
          }
          isEmpty={(data) => data.length === 0}
          empty={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Nessun risultato"
                line={
                  filterNames.length > 0 ? (
                    <>
                      Nessun esercizio per <em>{filterNames.join(" + ")}</em>.
                    </>
                  ) : (
                    <>
                      Nessun esercizio per <em>{filter.q}</em>.
                    </>
                  )
                }
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
            ) : (
              <EmptyState
                icon={Dumbbell}
                title="Libreria vuota"
                line="Ricarica gli esercizi di base o creane uno tuo."
                action={
                  <Button
                    block
                    onClick={async () => {
                      const result = await seedLibrary(getDb());
                      toast.success(`Libreria ricaricata: ${result.added} esercizi`);
                    }}
                  >
                    Ricarica libreria
                  </Button>
                }
                secondary={
                  <Button variant="ghost" block asChild>
                    <Link href="/esercizi/nuovo">Crea esercizio</Link>
                  </Button>
                }
              />
            )
          }
          errorDetail="Non riesco a leggere la libreria su questo dispositivo."
        >
          {(data) => (
            <ul className="md:app-container md:grid md:grid-cols-2 md:gap-x-4 xl:grid-cols-3">
              {data.map((exercise) => (
                <li key={exercise.id} className="list-cv">
                  <ExerciseLinkRow exercise={exercise} />
                </li>
              ))}
            </ul>
          )}
        </Async>
      </div>
    </>
  );
}

function asMuscle(value: string | null): MuscleGroup | null {
  return value && value in MUSCLE_GROUP_LABEL ? (value as MuscleGroup) : null;
}

function asEquipment(value: string | null): Equipment | null {
  return value && value in EQUIPMENT_LABEL ? (value as Equipment) : null;
}
