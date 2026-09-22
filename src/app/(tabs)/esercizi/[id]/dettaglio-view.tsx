"use client";

import { Dumbbell, LineChart, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getDb } from "@/lib/db/db";
import { deleteExercise } from "@/lib/db/mutations";
import { completedSetsHistory, getExercise } from "@/lib/db/queries";
import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from "@/lib/db/schema";
import { formatDay, formatKgValue } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { bestE1rm } from "@/lib/logic/e1rm";
import { useSettings } from "@/lib/session-context";

/**
 * Dettaglio esercizio.
 *
 * Lo storico c'e' quando esiste davvero: senza sessioni registrate si mostra lo stato
 * vuoto di §4.15 ("Mai allenato"), non un grafico finto. I grafici arrivano nel secondo
 * passaggio; l'1RM stimato invece e' gia' un numero vero.
 */
export function DettaglioEsercizioView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const settings = useSettings();
  const mounted = useMounted();
  const [deleting, setDeleting] = React.useState(false);

  const state = useLiveData(() => getExercise(getDb(), params.id), [params.id]);
  const history = useLiveData(
    () => completedSetsHistory(getDb(), params.id),
    [params.id],
  );

  const best = React.useMemo(
    () => bestE1rm(history.data ?? [], settings.e1rmFormula),
    [history.data, settings.e1rmFormula],
  );

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
            <PageHeader
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
                        {rows.length} serie registrate. I grafici arrivano nel prossimo
                        passaggio.
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
            </div>

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
