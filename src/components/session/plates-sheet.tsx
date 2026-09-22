"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import { PLATE_KGS } from "@/lib/db/schema";
import { formatKg, formatKgValue, parseDecimal } from "@/lib/format";
import { solvePlates, toPlateInventory, type PlateInventory } from "@/lib/logic/plates";
import { useSettings } from "@/lib/session-context";
import { PlateVisual } from "./plate-visual";

/**
 * Calcolatore di dischi — spec §3.3, design §6.4.
 *
 * Deep-linkabile: `?tool=plates&target=100`. Il tasto Indietro lo chiude.
 * Quando il target non si compone esattamente **lo dice**, con l'alternativa per
 * eccesso e quella per difetto: mai un arrotondamento silenzioso.
 */
export function PlatesSheet({
  open,
  target,
  onOpenChange,
}: {
  open: boolean;
  target: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useSettings();
  const [targetKg, setTargetKg] = React.useState<number | null>(target);
  const [removed, setRemoved] = React.useState<Record<string, number>>({});

  // Reset all'apertura: aggiustamento di stato **durante il render**, il modo che
  // React raccomanda al posto di un effetto che fa da eco a una prop.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTargetKg(target);
      setRemoved({});
    }
  }

  const inventory = React.useMemo<PlateInventory>(() => {
    const base = toPlateInventory(settings.plateInventory);
    for (const kg of PLATE_KGS) {
      const taken = removed[String(kg)] ?? 0;
      base[kg] = Math.max(0, base[kg] - taken);
    }
    return base;
  }, [settings.plateInventory, removed]);

  const result = React.useMemo(
    () =>
      targetKg == null
        ? null
        : solvePlates(targetKg, settings.barWeightKg, inventory),
    [targetKg, settings.barWeightKg, inventory],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Calcolatore di dischi" description="Quanto caricare per lato.">
        <div className="flex flex-col gap-5 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-label text-[var(--text-secondary)]">Carico target</span>
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
          </div>

          {result === null ? (
            <p className="py-6 text-center text-base text-[var(--text-secondary)]">
              Inserisci il carico che vuoi raggiungere.
            </p>
          ) : result.status === "below-bar" ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 text-base text-[var(--text-secondary)]">
              Il target è sotto il peso del bilanciere ({formatKg(settings.barWeightKg)}).
              Cambia il bilanciere qui sopra, o alza il target.
            </p>
          ) : (
            <>
              <p className="text-h3 text-[var(--text-primary)]">
                Per lato ·{" "}
                <span className="tnum text-[var(--accent-blue)]">
                  {formatKg(result.best?.perSideKg ?? 0)}
                </span>{" "}
                <span className="text-[var(--text-secondary)]">
                  · Totale{" "}
                  <span className="tnum">{formatKg(result.best?.totalKg ?? 0)}</span>
                </span>
              </p>

              <PlateVisual
                perSide={result.best?.perSide ?? []}
                onRemovePlate={(kg) =>
                  setRemoved((current) => ({
                    ...current,
                    [String(kg)]: (current[String(kg)] ?? 0) + 1,
                  }))
                }
              />

              {result.status === "inexact" ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--pr-border)] bg-[var(--pr-surface)] p-4"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-[var(--pr)]"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 text-sm text-[var(--pr)]">
                    <p>
                      Con i dischi disponibili il più vicino è{" "}
                      <strong className="tnum">{formatKg(result.best?.totalKg ?? 0)}</strong>{" "}
                      <span className="tnum">
                        ({(result.best?.deltaKg ?? 0) > 0 ? "+" : ""}
                        {formatKgValue(result.best?.deltaKg ?? 0)})
                      </span>
                      .
                    </p>
                    {result.below && result.above ? (
                      <p className="mt-1">
                        Per difetto{" "}
                        <span className="tnum">{formatKg(result.below.totalKg)}</span>, per
                        eccesso <span className="tnum">{formatKg(result.above.totalKg)}</span>.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {Object.keys(removed).length > 0 ? (
                <button
                  type="button"
                  onClick={() => setRemoved({})}
                  className="h-12 rounded-[var(--radius-btn)] text-base text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  Rimetti tutti i dischi
                </button>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
