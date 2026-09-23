"use client";

import Link from "next/link";
import type { ProgressionDecision } from "@/lib/db/trainer-schema";
import { formatKg } from "@/lib/format";
import { reasonView } from "@/lib/trainer/reason";
import { cn } from "@/lib/utils";
import { ReasonIcon, TONE_LANE } from "./progression-reason";

/**
 * «Cosa cambia la prossima volta» — in coda al riepilogo (§6.8, passo 3).
 *
 * Non e' un riassunto in piu': e' **il** momento in cui la trasparenza costa meno.
 * L'utente ha appena finito, ha in testa i numeri che ha fatto, e leggere adesso che
 * la panca sale a 82,5 kg perche' ha chiuso tre serie su tre a RPE 7 e' un'informazione
 * che si incastra da sola. Fra sei giorni sarebbe una sorpresa da spiegare.
 */
export function NextTimeCard({ decisions }: { decisions: ProgressionDecision[] }) {
  if (decisions.length === 0) return null;
  const mostrate = decisions.slice(0, 5);

  return (
    <section
      aria-labelledby="titolo-prossima"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <h2 id="titolo-prossima" className="text-h3 text-[var(--text-primary)]">
        Cosa cambia la prossima volta
      </h2>

      <ul className="mt-3 flex flex-col">
        {mostrate.map((decision) => {
          const view = reasonView(
            {
              exerciseId: decision.exerciseId,
              exerciseName: decision.exerciseName,
              order: 0,
              sets: decision.evidence.setsPlanned,
              repsMin: decision.toReps?.[0] ?? 0,
              repsMax: decision.toReps?.[1] ?? 0,
              rpeTarget: 8,
              restSec: 90,
              suggestedWeightKg: decision.toWeightKg,
            },
            decision,
          );
          return (
            <li
              key={decision.id}
              className="relative border-t border-[var(--border)] py-3 pl-4 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden="true"
                className={cn("absolute inset-y-2 left-0 w-[3px]", TONE_LANE[view.tone])}
              />
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 text-base text-[var(--text-primary)]">
                  {decision.exerciseName}
                </p>
                <p className="tnum shrink-0 text-num-md text-[var(--text-primary)]">
                  {decision.toWeightKg == null ? "—" : formatKg(decision.toWeightKg)}
                </p>
              </div>
              <p className="mt-1 flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <ReasonIcon tone={view.tone} className="mt-0.5" />
                <span className="min-w-0">{view.text}</span>
              </p>
              <p className="mt-1 pl-6 text-sm text-[var(--text-muted)]">{view.nextStepHint}</p>
            </li>
          );
        })}
      </ul>

      {decisions.length > mostrate.length ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          … altre {decisions.length - mostrate.length} decisioni nel registro.
        </p>
      ) : null}

      <p className="mt-4">
        <Link
          href="/trainer/progressione"
          className="inline-flex min-h-11 items-center text-sm text-[var(--accent-blue)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Vedi tutto il registro
        </Link>
      </p>
    </section>
  );
}
