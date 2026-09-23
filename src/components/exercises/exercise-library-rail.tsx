"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { RightRail } from "@/components/layout/right-rail";
import { getDb } from "@/lib/db/db";
import { listExercises } from "@/lib/db/queries";
import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from "@/lib/db/schema";
import type { Equipment, MuscleGroup } from "@/lib/db/schema";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useHasRightRail } from "@/lib/hooks/use-media-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExercisePaneList } from "./exercise-pane-list";
import type { ExerciseFilterValue } from "./exercise-filters";

/**
 * L'elenco filtrabile della libreria dentro la colonna destra — §4.26, da 1280 in su.
 *
 * Vive su **due** rotte (`/esercizi` e `/esercizi/[id]`) perche' li' il pannello elenco
 * *e'* il contenuto, non un supporto: sotto 1280 diventa la pagina e il dettaglio torna
 * a essere una rotta a se'.
 *
 * I filtri stanno nella query string, come in v1 (§11.5).
 */
export function ExerciseLibraryRail({
  selectedId = null,
  basePath,
}: {
  selectedId?: string | null;
  basePath: string;
}) {
  const hasRail = useHasRightRail();
  const router = useRouter();
  const searchParams = useSearchParams();

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
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
    },
    [router, basePath],
  );

  const state = useLiveData(
    () => listExercises(getDb(), filter),
    [filter.q, filter.muscleGroup, filter.equipment],
  );

  if (!hasRail) return null;

  return (
    <RightRail>
      {/*
        §4.26 — lo skeleton esiste **solo al primo mount**, non al cambio filtro: i due
        pannelli falliscono e caricano in modo indipendente, e un elenco che sfarfalla a
        ogni tasto e' peggio di un elenco che aspetta 16ms.
      */}
      {state.status === "loading" ? (
        <div className="flex flex-col gap-1" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger)] p-4">
          <p className="text-base text-[var(--text-primary)]">
            Impossibile leggere la libreria.
          </p>
          <button
            type="button"
            onClick={state.retry}
            className="mt-2 h-11 rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Riprova
          </button>
        </div>
      ) : (
        <ExercisePaneList
          exercises={state.data}
          filter={filter}
          onChange={setFilter}
          selectedId={selectedId}
          search={searchParams.toString() ? `?${searchParams.toString()}` : ""}
        />
      )}
    </RightRail>
  );
}

/**
 * «Vai all'elenco esercizi» — **il primo elemento focalizzabile della colonna centrale**
 * (§4.26). L'elenco sta a destra ma si usa prima del dettaglio: senza questo link, la
 * tastiera dovrebbe attraversare tutto il dettaglio per arrivare ai filtri. Due link
 * reali, non un `tabindex` acrobatico.
 */
export function VaiAllElenco() {
  const hasRail = useHasRightRail();
  if (!hasRail) return null;
  return (
    <a href="#elenco-esercizi" className="skip-link">
      Vai all&apos;elenco esercizi
    </a>
  );
}

/** «Torna all'elenco», in fondo al pannello dettaglio: sempre visibile, in `ghost`. */
export function TornaAllElenco() {
  const hasRail = useHasRightRail();
  if (!hasRail) return null;
  return (
    <a
      href="#elenco-esercizi"
      className="inline-flex h-12 items-center rounded-[var(--radius-btn)] px-3 text-base font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      Torna all&apos;elenco
    </a>
  );
}

function asMuscle(value: string | null): MuscleGroup | null {
  return value && value in MUSCLE_GROUP_LABEL ? (value as MuscleGroup) : null;
}

function asEquipment(value: string | null): Equipment | null {
  return value && value in EQUIPMENT_LABEL ? (value as Equipment) : null;
}
