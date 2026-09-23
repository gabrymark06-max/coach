"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { ReasonIcon, ReasonSheet, TONE_LANE } from "@/components/trainer/progression-reason";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import type { ProgressionDecision } from "@/lib/db/trainer-schema";
import {
  DECISION_FILTERS,
  getCurrentProgram,
  getLastFinishedProgram,
  listDecisions,
  type DecisionFilter,
} from "@/lib/db/trainer-ops";
import { formatDay, formatKg } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { reasonView, registerLine } from "@/lib/trainer/reason";
import { cn } from "@/lib/utils";

const PAGINA = 50;

/**
 * `/trainer/progressione` — il registro delle decisioni (§4.25).
 *
 * Cronologia inversa di **tutte** le decisioni, con la corsia colorata, l'icona e la
 * frase: gli stessi tre canali della riga del perche'. Il filtro sta nella query string
 * (§11.5), cosi' «mostrami le riduzioni» e' un indirizzo che si puo' salvare.
 */
export function ProgressioneView() {
  const router = useRouter();
  const params = useSearchParams();
  const mounted = useMounted();
  const filtro = (params.get("filtro") ?? "tutte") as DecisionFilter;
  const [limite, setLimite] = React.useState(PAGINA);
  const [aperta, setAperta] = React.useState<ProgressionDecision | null>(null);

  const state = useLiveData(async () => {
    const db = getDb();
    const program = (await getCurrentProgram(db)) ?? (await getLastFinishedProgram(db));
    if (!program) return null;
    const { rows, total } = await listDecisions(db, program.id, filtro, limite);
    return { program, rows, total };
  }, [filtro, limite]);

  const cambiaFiltro = (value: DecisionFilter) => {
    setLimite(PAGINA);
    router.replace(value === "tutte" ? "/trainer/progressione" : `/trainer/progressione?filtro=${value}`);
  };

  return (
    <>
      <PageHeader title="Progressione" />

      <div className="app-container flex flex-col gap-5">
        <ul className="flex flex-wrap gap-2" aria-label="Filtra le decisioni">
          {DECISION_FILTERS.map((item) => {
            const on = filtro === item.value;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => cambiaFiltro(item.value)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-[var(--radius-full)] border px-4 text-sm",
                    on
                      ? "border-[var(--accent-blue)] bg-[var(--set-done-surface)] text-[var(--text-primary)]"
                      : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        <Async
          state={state}
          loading={<ListSkeleton rows={6} height={72} />}
          isEmpty={(data) => data === null || data.rows.length === 0}
          empty={
            filtro === "tutte" ? (
              <EmptyState
                icon={ClipboardList}
                title="Ancora nessuna decisione"
                line="Il registro si riempie dopo il tuo primo allenamento del programma: ogni cambio di carico finisce qui, con il motivo."
                action={
                  <Button block asChild>
                    <Link href="/trainer">Vai al programma</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title={vuotoPerFiltro(filtro)}
                line="Il filtro è attivo: togli il filtro per vedere tutte le decisioni."
                action={
                  <Button block onClick={() => cambiaFiltro("tutte")}>
                    Azzera filtri
                  </Button>
                }
              />
            )
          }
          errorDetail="Non riesco a leggere il registro su questo dispositivo."
        >
          {(data) =>
            data ? (
              <>
                <ul className="flex flex-col gap-2">
                  {data.rows.map((decision) => {
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
                      <li key={decision.id}>
                        <button
                          type="button"
                          onClick={() => setAperta(decision)}
                          className={cn(
                            "relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-[var(--radius-md)]",
                            "border border-[var(--border)] bg-[var(--card)] py-3 pr-4 pl-5 text-left",
                            "hover:bg-[var(--surface-hover)] press",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-0 left-0 w-[3px]",
                              TONE_LANE[view.tone],
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-[var(--text-secondary)]">
                              {mounted ? formatDay(decision.decidedAt) : ""} ·{" "}
                              {decision.exerciseName}
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <ReasonIcon tone={view.tone} />
                              <span className="tnum text-base text-[var(--text-primary)]">
                                {decision.fromWeightKg != null && decision.toWeightKg != null
                                  ? `${formatKg(decision.fromWeightKg)} → ${formatKg(decision.toWeightKg)}`
                                  : "Nessun carico proposto"}
                              </span>
                            </span>
                            <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                              {registerLine(decision)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {data.total > data.rows.length ? (
                  <Button
                    variant="secondary"
                    block
                    onClick={() => setLimite((value) => value + PAGINA)}
                  >
                    Carica altre {Math.min(PAGINA, data.total - data.rows.length)}
                  </Button>
                ) : null}
              </>
            ) : null
          }
        </Async>
      </div>

      {aperta ? (
        <ReasonSheet
          open
          onOpenChange={(open) => {
            if (!open) setAperta(null);
          }}
          exercise={{
            exerciseId: aperta.exerciseId,
            exerciseName: aperta.exerciseName,
            order: 0,
            sets: aperta.evidence.setsPlanned,
            repsMin: aperta.toReps?.[0] ?? 0,
            repsMax: aperta.toReps?.[1] ?? 0,
            rpeTarget: 8,
            restSec: 90,
            suggestedWeightKg: aperta.toWeightKg,
          }}
          decision={aperta}
          dayId={aperta.dayId}
          canOverride={false}
        />
      ) : null}
    </>
  );
}

/** «Nessuna riduzione di carico finora.» Detto cosi', è una buona notizia (§4.25). */
function vuotoPerFiltro(filtro: DecisionFilter): string {
  switch (filtro) {
    case "aumenti":
      return "Nessun aumento di carico finora.";
    case "riduzioni":
      return "Nessuna riduzione di carico finora.";
    case "scarichi":
      return "Nessuna settimana di scarico finora.";
    case "scelte":
      return "Non hai ancora scelto tu un carico.";
    default:
      return "Ancora nessuna decisione";
  }
}
