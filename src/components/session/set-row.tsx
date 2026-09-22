"use client";

import { Check } from "lucide-react";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SET_TYPE_LABEL, type SetEntry, type SetType } from "@/lib/db/schema";
import { formatKgValue, speakSet } from "@/lib/format";
import { cn } from "@/lib/utils";
import { focusNextField, NumberField } from "./number-field";

const TYPE_COLOR: Record<SetType, string> = {
  normal: "text-[var(--set-normal)]",
  warmup: "text-[var(--set-warmup)]",
  drop: "text-[var(--set-drop)]",
  failure: "text-[var(--set-failure)]",
};

const TYPE_GLYPH: Record<SetType, string | null> = {
  normal: null,
  warmup: "W",
  drop: "D",
  failure: "F",
};

const RPE_VALUES = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

export interface SetRowProps {
  set: SetEntry;
  displayNumber: number | null;
  exerciseName: string;
  showRpe: boolean;
  stepKg: number;
  stepKgFine: number;
  readOnly?: boolean;
  onPatch: (patch: { weightKg?: number | null; reps?: number | null; rpe?: number | null; type?: SetType }) => void;
  onToggleComplete: (completed: boolean) => void;
  onDelete: () => void;
  onCopyPrevious: () => void;
  onOpenPlates: () => void;
  error?: string | null;
}

/**
 * `SetRow` — §4.1. L'elemento piu' toccato dell'app; tutto il resto gli cede spazio.
 *
 * E' una `<tr>` di una `<table>` vera (§8.9), non un grid di div: una tabella di serie
 * con intestazioni di colonna deve essere navigabile come una tabella.
 *
 * Il tipo di serie non e' mai **solo** un colore: la cella indice porta sempre la
 * lettera `W`/`D`/`F` o il numero (§1.5). Togliendo i colori, il tipo resta leggibile.
 */
export const SetRow = React.memo(function SetRow({
  set,
  displayNumber,
  exerciseName,
  showRpe,
  stepKg,
  stepKgFine,
  readOnly,
  onPatch,
  onToggleComplete,
  onDelete,
  onCopyPrevious,
  onOpenPlates,
  error,
}: SetRowProps) {
  const glyph = TYPE_GLYPH[set.type];
  const indexLabel = glyph ?? String(displayNumber ?? set.index);
  const setName = glyph
    ? `${SET_TYPE_LABEL[set.type]}`
    : `Serie ${displayNumber ?? set.index}`;

  const hasPrevious = set.prevWeightKg != null || set.prevReps != null;
  const previousText = hasPrevious
    ? `${set.prevWeightKg != null ? formatKgValue(set.prevWeightKg) : "—"}×${set.prevReps ?? "—"}`
    : "—";

  return (
    <tr
      data-completed={set.completed ? "true" : "false"}
      className={cn(
        "border-b border-[var(--border)] align-middle",
        set.completed ? "bg-[var(--set-done-surface)]" : "bg-[var(--card)]",
      )}
    >
      {/* TIPO — 48x48, apre il menu: cambia tipo o elimina (alternativa non gestuale) */}
      <th scope="row" className="relative w-12 p-0">
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-[3px] rounded-[var(--radius-xs)]",
            set.completed
              ? "bg-[var(--blue-brand)]"
              : set.type === "warmup"
                ? "border-l-[3px] border-dashed border-[var(--set-warmup)]"
                : "bg-transparent",
          )}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={readOnly}
            aria-label={`${setName}, tipo: ${SET_TYPE_LABEL[set.type].toLowerCase()}. Cambia tipo o elimina`}
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-[var(--radius-xs)]",
              "font-display text-sm font-bold",
              "hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
              TYPE_COLOR[set.type],
            )}
          >
            <span translate="no">{indexLabel}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(SET_TYPE_LABEL) as SetType[]).map((type) => (
              <DropdownMenuItem key={type} onSelect={() => onPatch({ type })}>
                <span className={cn("w-4 text-center font-display font-bold", TYPE_COLOR[type])} translate="no">
                  {TYPE_GLYPH[type] ?? "#"}
                </span>
                {SET_TYPE_LABEL[type]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              Elimina serie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </th>

      {/* PRECEDENTE — tocco = copia i valori nei campi */}
      <td className={cn("p-0", set.type === "drop" && "pl-3")}>
        <button
          type="button"
          disabled={!hasPrevious || readOnly}
          onClick={onCopyPrevious}
          aria-label={
            hasPrevious
              ? `Serie precedente: ${speakSet(set.prevWeightKg ?? null, set.prevReps ?? null)}. Tocca per copiare`
              : "Nessuna serie precedente"
          }
          className={cn(
            "tnum h-12 w-full rounded-[var(--radius-sm)] px-1 text-sm",
            "hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
            hasPrevious ? "text-[var(--text-muted)]" : "text-[var(--text-disabled)]",
          )}
        >
          {previousText}
        </button>
      </td>

      {/* KG */}
      <td className="p-0 pl-2">
        <NumberField
          kind="decimal"
          step={stepKg}
          stepFine={stepKgFine}
          value={set.weightKg}
          onCommit={(value) => onPatch({ weightKg: value })}
          placeholder={set.prevWeightKg != null ? formatKgValue(set.prevWeightKg) : undefined}
          label={`Peso in chili, ${setName.toLowerCase()}, ${exerciseName}`}
          disabled={readOnly}
          error={error}
          extraAction={{ label: "Dischi", onSelect: onOpenPlates }}
        />
      </td>

      {/* REPS */}
      <td className="p-0 pl-2">
        <NumberField
          kind="integer"
          step={1}
          value={set.reps}
          onCommit={(value) => onPatch({ reps: value })}
          placeholder={set.prevReps != null ? String(set.prevReps) : undefined}
          label={`Ripetizioni, ${setName.toLowerCase()}, ${exerciseName}`}
          disabled={readOnly}
        />
      </td>

      {/* RPE — opzionale a 375, sempre visibile da 768 (§7.2) */}
      <td className={cn("p-0 pl-2", showRpe ? "" : "hidden md:table-cell")}>
        <select
          data-set-focus=""
          value={set.rpe == null ? "" : String(set.rpe)}
          disabled={readOnly}
          aria-label={`RPE da 1 a 10, ${setName.toLowerCase()}, ${exerciseName}`}
          onChange={(event) =>
            onPatch({ rpe: event.target.value === "" ? null : Number(event.target.value) })
          }
          className={cn(
            "tnum h-12 w-12 rounded-[var(--radius-sm)] border border-[var(--border-strong)]",
            "bg-[var(--input)] px-1 text-center text-num-md text-[var(--text-primary)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
          )}
        >
          <option value="">—</option>
          {RPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {formatKgValue(value)}
            </option>
          ))}
        </select>
      </td>

      {/* CHECK */}
      <td className="w-12 p-0 pl-2">
        <button
          type="button"
          role="checkbox"
          data-set-focus=""
          aria-checked={set.completed}
          disabled={readOnly}
          aria-label={`Completa ${setName.toLowerCase()} di ${exerciseName}, ${speakSet(set.weightKg, set.reps)}`}
          onClick={(event) => {
            onToggleComplete(!set.completed);
            if (!set.completed) focusNextField(event.currentTarget);
          }}
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-[var(--radius-sm)]",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
          )}
        >
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border-2",
              "origin-center transition-transform duration-[var(--dur-1)] ease-[var(--ease-tap)]",
              set.completed
                ? "scale-100 border-[var(--blue-brand)] bg-[var(--blue-brand)]"
                : "border-[var(--border-strong)] bg-transparent",
            )}
          >
            {set.completed ? (
              <Check aria-hidden="true" className="size-[18px] text-white" strokeWidth={2.5} />
            ) : null}
          </span>
        </button>
      </td>
    </tr>
  );
});
