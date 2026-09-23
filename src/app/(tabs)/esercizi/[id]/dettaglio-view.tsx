"use client";

import { Dumbbell, LineChart, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  ExerciseLibraryRail,
  TornaAllElenco,
  VaiAllElenco,
} from "@/components/exercises/exercise-library-rail";
import { PageHeader } from "@/components/shared/page-header";
import { announce } from "@/lib/announce";
import { useHasRightRail } from "@/lib/hooks/use-media-query";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getDb } from "@/lib/db/db";
import { deleteExercise } from "@/lib/db/mutations";
import { completedSetsHistory, getExercise } from "@/lib/db/queries";
import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from "@/lib/db/schema";
import { formatDay, formatKgValue } from "@/lib/format";
import {
  ChartDataTable,
  ChartEmpty,
  ChartFrame,
  ChartSinglePoint,
  ChartSkeleton,
  type SeriesDef,
} from "@/components/charts/chart-card";
import { TrendChart } from "@/components/charts/dynamic";
import { PRSummary } from "@/components/shared/pr-badge";
import { personalRecordsForExercise } from "@/lib/db/pr-ops";
import { e1rmSeries } from "@/lib/logic/stats";
import { formatFull } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useRouteId } from "@/lib/hooks/use-route-id";
import { useMounted } from "@/lib/hooks/use-now";
import { bestE1rm } from "@/lib/logic/e1rm";
import { useSettings } from "@/lib/session-context";

/**
 * Dettaglio esercizio: record, andamento del 1RM stimato, serie registrate.
 *
 * Lo storico c'e' quando esiste davvero: senza sessioni si mostra lo stato vuoto di
 * §4.15 ("Mai allenato"), non un grafico finto. Con un solo allenamento si mostra il
 * punto singolo, non una linea inventata (§4.10).
 */
const SERIE_1RM: SeriesDef[] = [
  { key: "value", name: "1RM stimato", color: "var(--chart-2)", shape: "diamond" },
];

export function DettaglioEsercizioView() {
  const params = useParams<{ id: string }>();
  // l'id vero viene dall'indirizzo: offline si atterra sulla scocca (route-shell)
  const id = useRouteId(params.id);
  const router = useRouter();
  const settings = useSettings();
  const formula = settings.e1rmFormula;
  const mounted = useMounted();
  const [deleting, setDeleting] = React.useState(false);

  const hasRail = useHasRightRail();
  const state = useLiveData(() => getExercise(getDb(), id), [id]);
  const history = useLiveData(() => completedSetsHistory(getDb(), id), [id]);
  const records = useLiveData(() => personalRecordsForExercise(getDb(), id), [id]);
  const trend = useLiveData(async () => {
    const sessions = await getDb().sessions.where("exerciseIds").equals(id).toArray();
    return e1rmSeries(sessions, id, formula);
  }, [id, formula]);

  const best = React.useMemo(
    () => bestE1rm(history.data ?? [], settings.e1rmFormula),
    [history.data, settings.e1rmFormula],
  );

  /*
    §8.10 — alla selezione il fuoco va sull'`h1` del dettaglio e `#sr-system` annuncia
    l'apertura. Senza, chi sceglie dall'elenco a destra resta con il fuoco a destra e
    non sa che al centro e' cambiato tutto. Solo a due pannelli: sotto 1280 il dettaglio
    e' una pagina nuova, e li' ci pensa il router.
  */
  const nome = state.status === "ready" ? state.data?.name : undefined;
  React.useEffect(() => {
    if (!hasRail || !nome) return;
    document.getElementById("titolo-pagina")?.focus();
    announce("system", `${nome}, dettaglio aperto`);
  }, [hasRail, nome]);

  return (
    <Async
      state={state}
      loading={
        <div className="app-container pt-9">
          <ListSkeleton rows={3} height={72} />
        </div>
      }
      isEmpty={(exercise) => exercise === undefined}
      empty={
        <EmptyState
          icon={Dumbbell}
          title="Esercizio non trovato"
          line="Questo esercizio non esiste più su questo dispositivo."
          action={
            <Button block asChild>
              <Link href="/esercizi">Torna alla libreria</Link>
            </Button>
          }
        />
      }
    >
      {(exercise) =>
        exercise ? (
          <>
            {/* §4.26: il primo elemento focalizzabile della colonna centrale */}
            <VaiAllElenco />
            <PageHeader
              focusable
              title={exercise.name}
              action={
                exercise.isCustom ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" asChild>
                      <Link href={`/esercizi/${exercise.id}/modifica`}>
                        <Pencil aria-hidden="true" className="size-5" strokeWidth={1.75} />
                        Modifica
                      </Link>
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={`Elimina ${exercise.name}`}
                      onClick={() => setDeleting(true)}
                    >
                      <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </Button>
                  </div>
                ) : null
              }
            >
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {MUSCLE_GROUP_LABEL[exercise.muscleGroup]} ·{" "}
                {EQUIPMENT_LABEL[exercise.equipment]}
                {exercise.isCustom ? (
                  <span className="ml-2 text-label text-[var(--accent-blue)]">
                    Personalizzato
                  </span>
                ) : null}
              </p>
            </PageHeader>

            <div className="app-container flex flex-col gap-6 pb-8">
              {exercise.notes ? (
                <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-base text-[var(--text-secondary)]">
                  {exercise.notes}
                </p>
              ) : null}

              {exercise.secondaryMuscles.length > 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Allena anche:{" "}
                  {exercise.secondaryMuscles
                    .map((muscle) => MUSCLE_GROUP_LABEL[muscle])
                    .join(", ")}
                </p>
              ) : null}

              {(records.data ?? []).length > 0 ? (
                <section aria-labelledby="titolo-record" className="flex flex-col gap-3">
                  <h2 id="titolo-record" className="text-h2 text-[var(--text-primary)]">
                    Record personali
                  </h2>
                  <PRSummary records={records.data ?? []} />
                </section>
              ) : null}

              <ChartFrame
                title="1RM stimato"
                titleId="titolo-1rm"
                subtitle={`Formula ${formula === "epley" ? "Epley" : "Brzycki"}, la serie migliore di ogni allenamento.`}
              >
                {trend.status === "loading" ? (
                  <ChartSkeleton />
                ) : trend.status === "error" || !trend.data ? (
                  <ChartEmpty line="Non riesco a calcolare l'andamento di questo esercizio." />
                ) : trend.data.length === 0 ? (
                  <ChartEmpty line="Quando userai questo esercizio, qui vedrai il tuo 1RM stimato." />
                ) : trend.data.length === 1 ? (
                  <ChartSinglePoint
                    value={`${formatKgValue(trend.data[0].value)} kg`}
                    label={mounted ? formatDay(trend.data[0].date) : "—"}
                    hint="Serve un secondo allenamento per tracciare una linea."
                  />
                ) : (
                  <>
                    <TrendChart
                      data={trend.data.map((point) => ({
                        date: point.date,
                        value: point.value,
                      }))}
                      series={SERIE_1RM}
                      xKey="date"
                      yUnit="kg"
                      domainMode="level"
                      unitStep={0.5}
                      formatX={(value) => formatDay(value)}
                      formatTooltipLabel={(value) => formatFull(value)}
                      formatValue={(value) => `${formatKgValue(value)} kg`}
                      ariaLabel={`Andamento del 1RM stimato di ${exercise.name}`}
                    />
                    <ChartDataTable
                      caption={`1RM stimato di ${exercise.name}`}
                      columns={["Data", "1RM stimato (kg)", "Serie migliore"]}
                      rows={trend.data.map((point) => [
                        mounted ? formatDay(point.date) : point.date,
                        formatKgValue(point.value),
                        `${formatKgValue(point.weightKg)} kg × ${point.reps}`,
                      ])}
                    />
                  </>
                )}
              </ChartFrame>

              <section aria-labelledby="titolo-storico" className="flex flex-col gap-4">
                <h2 id="titolo-storico" className="text-h2 text-[var(--text-primary)]">
                  Storico
                </h2>

                <Async
                  state={history}
                  loading={<ListSkeleton rows={3} />}
                  isEmpty={(rows) => rows.length === 0}
                  empty={
                    <EmptyState
                      icon={LineChart}
                      title="Mai allenato"
                      line="Quando userai questo esercizio, qui vedrai le serie registrate e il tuo 1RM stimato."
                    />
                  }
                  errorDetail="Non riesco a leggere lo storico di questo esercizio."
                >
                  {(rows) => (
                    <>
                      {best ? (
                        <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
                          <span className="text-label text-[var(--text-secondary)]">
                            1RM stimato ({settings.e1rmFormula === "epley" ? "Epley" : "Brzycki"})
                          </span>
                          <span className="tnum mt-1 block text-h1 text-[var(--text-primary)]">
                            {formatKgValue(best.value)} kg
                          </span>
                          <span className="tnum text-sm text-[var(--text-muted)]">
                            dalla serie migliore: {formatKgValue(best.weightKg)} kg × {best.reps}
                          </span>
                        </p>
                      ) : null}

                      <p className="text-sm text-[var(--text-muted)]">
                        {rows.length} serie registrate.
                      </p>

                      <ul className="flex flex-col">
                        {rows
                          .slice()
                          .reverse()
                          .slice(0, 20)
                          .map((row, i) => (
                            <li
                              key={`${row.sessionId}-${i}`}
                              className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"
                            >
                              <span className="text-sm text-[var(--text-secondary)]">
                                {mounted ? formatDay(row.date) : "—"}
                              </span>
                              <span className="tnum text-num-md text-[var(--text-primary)]">
                                {row.weightKg != null ? `${formatKgValue(row.weightKg)} kg` : "—"}
                                {" × "}
                                {row.reps ?? "—"}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </Async>
              </section>

              {/* sempre visibile, in fondo al pannello dettaglio (§4.26) */}
              <TornaAllElenco />
            </div>

            <ExerciseLibraryRail selectedId={exercise.id} basePath={`/esercizi/${exercise.id}`} />

            <ConfirmDialog
              open={deleting}
              onOpenChange={setDeleting}
              title={`Eliminare «${exercise.name}»?`}
              body="Lo storico che lo contiene resta, ma non potrai più aggiungerlo."
              confirmLabel="Elimina"
              onConfirm={async () => {
                try {
                  await deleteExercise(getDb(), exercise.id);
                  toast.success(`Esercizio «${exercise.name}» eliminato`);
                  router.replace("/esercizi");
                } catch {
                  toast.error("Non riesco a eliminare questo esercizio.");
                }
              }}
            />
          </>
        ) : null
      }
    </Async>
  );
}
