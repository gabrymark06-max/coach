"use client";

import type { ProgressionDecision, TrainerDay } from "@/lib/db/trainer-schema";
import { formatKg } from "@/lib/format";
import { ReasonRow } from "./progression-reason";

/**
 * L'elenco degli esercizi di un giorno, con il carico proposto e **la riga del perche'
 * sotto ognuno** (§4.24, §4.25).
 *
 * Il carico e la sua spiegazione non si separano mai: sono la stessa informazione letta
 * a due profondita'. Per questo vivono in una riga sola di componente e non in due
 * posti che si possono dimenticare l'uno dell'altro.
 */
export function DayExercises({
  day,
  decisions,
  limit,
  canOverride = true,
}: {
  day: TrainerDay;
  decisions: Map<string, ProgressionDecision>;
  /** quanti mostrarne; il resto si riassume in una riga */
  limit?: number;
  canOverride?: boolean;
}) {
  const visibili = limit ? day.exercises.slice(0, limit) : day.exercises;
  const nascosti = day.exercises.length - visibili.length;

  return (
    <div>
      <ul className="flex flex-col">
        {visibili.map((exercise) => {
          const decision = exercise.decisionId ? decisions.get(exercise.decisionId) : undefined;
          return (
            <li
              key={exercise.exerciseId}
              className="border-t border-[var(--border)] py-3 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 text-base text-[var(--text-primary)]">
                  {exercise.exerciseName}
                </p>
                <p className="tnum shrink-0 text-sm text-[var(--text-secondary)]">
                  {exercise.sets} × {exercise.repsMin}-{exercise.repsMax}
                </p>
                <p className="tnum w-20 shrink-0 text-right text-num-md text-[var(--text-primary)]">
                  {exercise.suggestedWeightKg == null
                    ? "—"
                    : formatKg(exercise.suggestedWeightKg)}
                </p>
              </div>
              <ReasonRow
                exercise={exercise}
                decision={decision}
                dayId={day.id}
                canOverride={canOverride}
              />
            </li>
          );
        })}
      </ul>

      {nascosti > 0 ? (
        <p className="border-t border-[var(--border)] pt-3 text-sm text-[var(--text-secondary)]">
          … altri {nascosti} {nascosti === 1 ? "esercizio" : "esercizi"}
        </p>
      ) : null}
    </div>
  );
}

/** «5 esercizi · ~60 min · 18 serie» — la riga di sottotitolo di un giorno. */
export function daySummary(day: TrainerDay): string {
  const serie = day.exercises.reduce((total, exercise) => total + exercise.sets, 0);
  return `${day.exercises.length} ${
    day.exercises.length === 1 ? "esercizio" : "esercizi"
  } · ~${day.estimatedMinutes} min · ${serie} serie`;
}
