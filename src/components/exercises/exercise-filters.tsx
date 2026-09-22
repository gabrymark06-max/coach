"use client";

import { Check, Search } from "lucide-react";
import * as React from "react";
import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Equipment,
  type MuscleGroup,
} from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export interface ExerciseFilterValue {
  q: string;
  muscleGroup: MuscleGroup | null;
  equipment: Equipment | null;
}

export const EMPTY_FILTER: ExerciseFilterValue = {
  q: "",
  muscleGroup: null,
  equipment: null,
};

const MUSCLES = Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

/**
 * Ricerca + chip di filtro — §4.8.
 *
 * Il chip selezionato porta **fondo, icona `Check` e `aria-pressed`**: tre segnali, non
 * solo il colore. Il conteggio dei risultati e' sempre visibile, e `Azzera filtri`
 * compare solo quando c'e' qualcosa da azzerare.
 */
export function ExerciseFilters({
  value,
  onChange,
  resultCount,
  autoFocusSearch = false,
}: {
  value: ExerciseFilterValue;
  onChange: (value: ExerciseFilterValue) => void;
  resultCount: number;
  autoFocusSearch?: boolean;
}) {
  const active = value.muscleGroup !== null || value.equipment !== null || value.q !== "";
  const searchId = React.useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Cerca un esercizio
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[var(--text-muted)]"
          strokeWidth={1.75}
        />
        <input
          id={searchId}
          type="search"
          value={value.q}
          // §11.1: niente autoFocus su telefono, aprirebbe il tastierino sopra la lista
          autoFocus={autoFocusSearch}
          onChange={(event) => onChange({ ...value, q: event.target.value })}
          placeholder="Cerca un esercizio…"
          className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] pl-11 pr-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        />
      </div>

      <div
        data-scroll-area=""
        aria-label="Filtri"
        role="group"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {MUSCLES.map((muscle) => (
          <FilterChip
            key={muscle}
            label={MUSCLE_GROUP_LABEL[muscle]}
            ariaLabel={`Filtra per ${MUSCLE_GROUP_LABEL[muscle]}`}
            selected={value.muscleGroup === muscle}
            onClick={() =>
              onChange({
                ...value,
                muscleGroup: value.muscleGroup === muscle ? null : muscle,
              })
            }
          />
        ))}
        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-[var(--border)]" />
        {EQUIPMENT.map((item) => (
          <FilterChip
            key={item}
            label={EQUIPMENT_LABEL[item]}
            ariaLabel={`Filtra per ${EQUIPMENT_LABEL[item]}`}
            selected={value.equipment === item}
            onClick={() =>
              onChange({ ...value, equipment: value.equipment === item ? null : item })
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]" role="status">
          {resultCount} {resultCount === 1 ? "esercizio" : "esercizi"}
        </p>
        {active ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="h-11 rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Azzera filtri
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  ariaLabel,
  selected,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm",
        "transition-[background-color,color] duration-[var(--dur-1)] ease-[var(--ease-out)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        selected
          ? "border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
          : "border-[var(--border-strong)] bg-[var(--popover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
      )}
    >
      {selected ? (
        <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
      ) : null}
      {label}
    </button>
  );
}
