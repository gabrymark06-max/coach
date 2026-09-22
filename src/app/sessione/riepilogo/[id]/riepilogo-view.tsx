"use client";

import { History } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { getSession } from "@/lib/db/queries";
import { SET_TYPE_LABEL } from "@/lib/db/schema";
import { formatFull, formatKgValue, formatVolumeKg } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { formatMinutes } from "@/lib/logic/timer";

/**
 * Riepilogo post-workout (§6.2).
 *
 * I record personali arrivano nel secondo passaggio: qui non c'e' un badge PR finto,
 * c'e' quello che l'app sa davvero — durata, volume, serie, esercizi.
 */
export function RiepilogoView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mounted = useMounted();
  const state = useLiveData(() => getSession(getDb(), params.id), [params.id]);

  return (
    <div className="app-container flex flex-col gap-6 py-11">
      <Async
        state={state}
        loading={<ListSkeleton rows={3} height={96} />}
        isEmpty={(session) => session === undefined}
        empty={
          <EmptyState
            icon={History}
            title="Allenamento non trovato"
            line="Questo allenamento non esiste più su questo dispositivo."
            action={
              <Button block onClick={() => router.replace("/allenamento")}>
                Torna ad Allenamento
              </Button>
            }
          />
        }
      >
        {(session) =>
          session ? (
            <>
              <header>
                <h1 className="text-h1 text-[var(--text-primary)]">Allenamento salvato</h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {session.routineName ? `${session.routineName} · ` : null}
                  {mounted ? formatFull(session.startedAt) : null}
                </p>
              </header>

              <dl className="grid grid-cols-3 gap-3">
                {[
                  ["Durata", formatMinutes(session.durationSec * 1000)],
                  ["Volume", formatVolumeKg(session.totalVolumeKg)],
                  ["Serie", String(session.totalSets)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
                  >
                    <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
                    <dd className="tnum mt-1 text-h2 text-[var(--text-primary)]">{value}</dd>
                  </div>
                ))}
              </dl>

              {session.exercises.length === 0 ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-base text-[var(--text-secondary)]">
                  Nessuna serie completata in questo allenamento.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {session.exercises.map((exercise) => (
                    <li
                      key={exercise.id}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                      <h2 className="break-words text-h3 text-[var(--text-primary)]">
                        {exercise.exerciseName}
                      </h2>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {exercise.sets.map((set, i) => (
                          <li
                            key={set.id}
                            className="tnum rounded-[var(--radius-sm)] bg-[var(--popover)] px-2 py-1 text-sm text-[var(--text-secondary)]"
                          >
                            <span translate="no">
                              {set.type === "normal" ? i + 1 : SET_TYPE_LABEL[set.type][0]}
                            </span>
                            {" · "}
                            {set.weightKg != null ? `${formatKgValue(set.weightKg)} kg` : "—"}
                            {" × "}
                            {set.reps ?? "—"}
                            {set.rpe != null ? ` · RPE ${formatKgValue(set.rpe)}` : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              <Button size="lg" block onClick={() => router.replace("/allenamento")}>
                Fatto
              </Button>
            </>
          ) : null
        }
      </Async>
    </div>
  );
}
