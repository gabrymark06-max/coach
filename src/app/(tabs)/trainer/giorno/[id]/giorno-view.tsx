"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DayExercises, daySummary } from "@/components/trainer/day-exercises";
import { StartDayButton } from "@/components/trainer/dashboard-cards";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { decisionsByIds, getDayRow, getProgram, locate } from "@/lib/db/trainer-ops";
import { formatDay } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { useRouteId } from "@/lib/hooks/use-route-id";

/**
 * `/trainer/giorno/[id]` — il giorno per intero.
 *
 * E' la rotta che le prove del foglio «Perche' questo carico» citano e che l'accordion
 * delle settimane apre: deve reggere un deep link anche offline, quindi legge l'id
 * dall'indirizzo (`useRouteId`) e non dal parametro della scocca.
 */
export function GiornoView() {
  const params = useParams<{ id: string }>();
  const id = useRouteId(params.id);
  const mounted = useMounted();

  const state = useLiveData(async () => {
    if (!id) return null;
    const db = getDb();
    const row = await getDayRow(db, id);
    if (!row) return null;
    const program = await getProgram(db, row.programId);
    if (!program) return null;
    const found = locate(program, id);
    if (!found) return null;

    const decisions = await decisionsByIds(
      db,
      found.day.exercises
        .map((exercise) => exercise.decisionId)
        .filter((value): value is string => Boolean(value)),
    );
    return { program, week: found.week, day: found.day, decisions };
  }, [id]);

  const titolo =
    state.status === "ready" && state.data ? state.data.day.name : "Giorno del programma";

  return (
    <>
      <PageHeader title={titolo} />

      <div className="app-container flex flex-col gap-6">
        <Async
          state={state}
          loading={<ListSkeleton rows={5} height={72} />}
          isEmpty={(data) => data === null}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="Giorno non trovato"
              line="Questo giorno non fa parte di nessun programma su questo dispositivo."
              action={
                <Button block asChild>
                  <Link href="/trainer">Torna al programma</Link>
                </Button>
              }
            />
          }
          errorDetail="Non riesco a leggere questo giorno su questo dispositivo."
        >
          {(data) =>
            data ? (
              <>
                <section
                  aria-labelledby="titolo-giorno"
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
                >
                  <h2 id="titolo-giorno" className="text-h3 text-[var(--text-primary)]">
                    Settimana {data.week.index}
                    {data.week.kind === "scarico" ? " · scarico" : ""}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {daySummary(data.day)}
                    {mounted && data.day.plannedFor
                      ? ` · previsto ${formatDay(data.day.plannedFor)}`
                      : ""}
                  </p>

                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <DayExercises day={data.day} decisions={data.decisions} />
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    {data.day.status === "completata" ? (
                      data.day.sessionId ? (
                        <Button variant="secondary" block asChild>
                          <Link href={`/profilo/sessione/${data.day.sessionId}`}>
                            Vedi il riepilogo
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)]">
                          Questo giorno è già stato chiuso.
                        </p>
                      )
                    ) : (
                      <StartDayButton day={data.day} />
                    )}
                    <Button variant="ghost" block asChild>
                      <Link href="/trainer/progressione">Registro delle decisioni</Link>
                    </Button>
                  </div>
                </section>
              </>
            ) : null
          }
        </Async>
      </div>
    </>
  );
}
