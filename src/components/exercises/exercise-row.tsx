"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Exercise,
} from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * `ExerciseListRow` — §4.8. Riga da 56px, separatore 1px, nessun gap: e' densita'
 * voluta. Il quadratino porta **l'iniziale del gruppo muscolare**, non un'icona
 * generica e men che meno un'emoji.
 */
function Marker({ muscleGroup }: { muscleGroup: Exercise["muscleGroup"] }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--popover)] text-label text-[var(--text-secondary)]"
    >
      {MUSCLE_GROUP_LABEL[muscleGroup].slice(0, 2)}
    </span>
  );
}

function Body({ exercise }: { exercise: Exercise }) {
  return (
    <>
      <Marker muscleGroup={exercise.muscleGroup} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-h3 text-[var(--text-primary)]">
          {exercise.name}
        </span>
        <span className="block truncate text-sm text-[var(--text-secondary)]">
          {MUSCLE_GROUP_LABEL[exercise.muscleGroup]} · {EQUIPMENT_LABEL[exercise.equipment]}
          {exercise.isCustom ? (
            <span className="ml-2 text-label text-[var(--accent-blue)]">Personalizzato</span>
          ) : null}
        </span>
      </span>
    </>
  );
}

const ROW_CLASS = cn(
  "flex w-full items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 text-left",
  "min-h-14 py-2",
  "hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
);

export function ExerciseLinkRow({ exercise }: { exercise: Exercise }) {
  return (
    <Link href={`/esercizi/${exercise.id}`} className={ROW_CLASS}>
      <Body exercise={exercise} />
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
    </Link>
  );
}

export function ExerciseSelectRow({
  exercise,
  selected,
  onToggle,
}: {
  exercise: Exercise;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(ROW_CLASS, selected && "bg-[var(--set-done-surface)]")}
    >
      <Body exercise={exercise} />
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2",
          selected
            ? "border-[var(--blue-brand)] bg-[var(--blue-brand)]"
            : "border-[var(--border-strong)]",
        )}
      >
        {selected ? <Check className="size-[18px] text-white" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}
