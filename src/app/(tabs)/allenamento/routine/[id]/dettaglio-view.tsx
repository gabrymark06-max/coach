"use client";

import { LayoutList, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { unlockAudio } from "@/lib/audio";
import { markSessionEntry } from "@/lib/session-entry";
import { getDb } from "@/lib/db/db";
import { ActiveSessionExistsError, startSession } from "@/lib/db/mutations";
import { getRoutine } from "@/lib/db/queries";
import { SET_TYPE_LABEL } from "@/lib/db/schema";
import { formatExerciseCount, formatKgValue } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useRouteId } from "@/lib/hooks/use-route-id";

export function DettaglioRoutineView() {
  const params = useParams<{ id: string }>();
  // l'id vero viene dall'indirizzo: offline si atterra sulla scocca (route-shell)
  const id = useRouteId(params.id);
  const router = useRouter();
  const state = useLiveData(() => getRoutine(getDb(), id), [id]);

  const start = async () => {
    unlockAudio();
    try {
      await startSession(getDb(), { routineId: id });
      markSessionEntry();
      router.push("/sessione");
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        toast.error("C'è già un allenamento in corso.", {
          action: {
            label: "Riprendi",
            onClick: () => {
              markSessionEntry();
              router.push("/sessione");
            },
          },
        });
        return;
      }
      toast.error("Non riesco ad avviare l'allenamento su questo dispositivo.");
    }
  };

  return (
    <Async
      state={state}
      loading={
        <div className="app-container pt-9">
          <ListSkeleton rows={4} height={72} />
        </div>
      }
      isEmpty={(routine) => routine === undefined}
      empty={
        <EmptyState
          icon={LayoutList}
          title="Routine non trovata"
          line="Questa routine non esiste più su questo dispositivo."
          action={
            <Button block asChild>
              <Link href="/allenamento">Torna alle routine</Link>
            </Button>
          }
        />
      }
    >
      {(routine) =>
        routine ? (
          <>
            <PageHeader
              title={routine.name}
              action={
                <Button variant="secondary" asChild>
                  <Link href={`/allenamento/routine/${routine.id}/modifica`}>
                    <Pencil aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    Modifica
                  </Link>
                </Button>
              }
            >
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {routine.split ? `${routine.split} · ` : null}
                {formatExerciseCount(routine.exercises.length)}
              </p>
            </PageHeader>

            <div className="app-container flex flex-col gap-6 pb-8">
              {routine.exercises.length === 0 ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-base text-[var(--text-secondary)]">
                  Questa routine non ha ancora esercizi.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {routine.exercises.map((exercise) => (
                    <li
                      key={exercise.exerciseId}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                      <h2 className="break-words text-h3 text-[var(--text-primary)]">
                        {exercise.exerciseName}
                      </h2>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {exercise.sets.map((set, i) => (
                          <li
                            key={i}
                            className="tnum rounded-[var(--radius-sm)] bg-[var(--popover)] px-2 py-1 text-sm text-[var(--text-secondary)]"
                          >
                            {set.type === "normal" ? `S${i + 1}` : SET_TYPE_LABEL[set.type][0]}
                            {" · "}
                            {set.targetWeightKg != null ? `${formatKgValue(set.targetWeightKg)} kg` : "—"}
                            {" × "}
                            {set.targetReps ?? "—"}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <Button
                  size="lg"
                  block
                  disabled={routine.exercises.length === 0}
                  onClick={() => void start()}
                >
                  AVVIA
                </Button>
                {routine.exercises.length === 0 ? (
                  <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
                    Aggiungi almeno un esercizio per avviarla
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null
      }
    </Async>
  );
}
