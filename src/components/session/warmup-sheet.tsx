"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import type { Equipment } from "@/lib/db/schema";
import { formatKg, formatKgValue, parseDecimal } from "@/lib/format";
import { buildWarmupPlan, loadableStepKg } from "@/lib/logic/warmup";
import { useSettings } from "@/lib/session-context";

/**
 * Calcolatore di riscaldamento — spec §3.2, design §6.3.
 *
 * Il foglio mostra **la tabella prima di confermare**, non dopo. Il peso e' arrotondato
 * al passo caricabile e il valore teorico resta accanto in grigio.
 */
export function WarmupSheet({
  open,
  target,
  equipment,
  exerciseName,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  target: number | null;
  equipment: Equipment | null;
  exerciseName: string | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (sets: { weightKg: number; reps: number }[]) => void;
}) {
  const settings = useSettings();
  const [targetKg, setTargetKg] = React.useState<number | null>(target);

  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setTargetKg(target);
  }

  const includeBar = equipment === "barbell";
  const stepKg = loadableStepKg(settings.plateInventory, settings.stepKg);

  const plan = React.useMemo(
    () =>
      buildWarmupPlan({
        targetKg,
        barWeightKg: settings.barWeightKg,
        percents: settings.warmupPercents,
        stepKg,
        includeBar,
      }),
    [targetKg, settings.barWeightKg, settings.warmupPercents, stepKg, includeBar],
  );

  const canAdd = plan.status === "ok" && plan.sets.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Calcolatore di riscaldamento"
        description={exerciseName ?? undefined}
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-label text-[var(--text-secondary)]">
                Prima serie allenante
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  defaultValue={targetKg == null ? "" : formatKgValue(targetKg)}
                  onBlur={(event) => setTargetKg(parseDecimal(event.currentTarget.value))}
                  className="tnum h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-right text-num-set text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                />
                <span className="text-sm text-[var(--text-muted)]">kg</span>
              </span>
            </label>

            {includeBar ? (
              <label className="flex flex-col gap-2">
                <span className="text-label text-[var(--text-secondary)]">Bilanciere</span>
                <span className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={formatKgValue(settings.barWeightKg)}
                    onBlur={(event) => {
                      const value = parseDecimal(event.currentTarget.value);
                      if (value != null && value >= 0) {
                        void updateSettings(getDb(), { barWeightKg: value });
                      }
                    }}
                    className="tnum h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-right text-num-set text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  />
                  <span className="text-sm text-[var(--text-muted)]">kg</span>
                </span>
              </label>
            ) : null}
          </div>

          {plan.status === "no-target" ? (
            <p className="py-6 text-center text-base text-[var(--text-secondary)]">
              Inserisci il peso della tua prima serie allenante.
            </p>
          ) : plan.status === "below-bar" ? (
            <p
              role="status"
              className="rounded-[var(--radius-md)] border border-[var(--pr-border)] bg-[var(--pr-surface)] p-4 text-sm text-[var(--pr)]"
            >
              Il target è più leggero del bilanciere. Non serve riscaldarsi con meno di{" "}
              {formatKg(settings.barWeightKg)}.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Serie di riscaldamento proposte</caption>
              <thead>
                <tr className="text-label text-[var(--text-secondary)]">
                  <th scope="col" className="pb-2">Serie</th>
                  <th scope="col" className="pb-2">%</th>
                  <th scope="col" className="pb-2 text-right">Peso</th>
                  <th scope="col" className="pb-2 text-right">Reps</th>
                  <th scope="col" className="pb-2 text-right">Recupero</th>
                </tr>
              </thead>
              <tbody>
                {plan.sets.map((set, i) => (
                  <tr key={set.label} className="border-b border-[var(--border)]">
                    <th scope="row" className="py-3 font-display font-bold text-[var(--set-warmup)]">
                      <span translate="no">W{i + 1}</span>
                    </th>
                    <td className="py-3 text-sm text-[var(--text-secondary)]">{set.label}</td>
                    <td className="py-3 text-right">
                      <span className="tnum text-num-md text-[var(--text-primary)]">
                        {formatKgValue(set.weightKg)}
                      </span>
                      {set.weightKg !== set.exactKg ? (
                        <span className="tnum ml-1 text-sm text-[var(--text-muted)]">
                          ({formatKgValue(set.exactKg)})
                        </span>
                      ) : null}
                    </td>
                    <td className="tnum py-3 text-right text-num-md text-[var(--text-primary)]">
                      {set.reps}
                    </td>
                    <td className="tnum py-3 text-right text-sm text-[var(--text-secondary)]">
                      {set.restSec} s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <SheetFooter>
          {!canAdd ? (
            <p className="text-sm text-[var(--text-muted)] md:self-center">
              {plan.status === "no-target"
                ? "Serve il peso della prima serie allenante."
                : "Non c'è niente da aggiungere."}
            </p>
          ) : null}
          <Button
            block
            disabled={!canAdd}
            className="md:w-auto"
            onClick={() => {
              onAdd(plan.sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps })));
              onOpenChange(false);
            }}
          >
            {canAdd
              ? `Aggiungi ${plan.sets.length} serie di riscaldamento`
              : "Aggiungi le serie"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
