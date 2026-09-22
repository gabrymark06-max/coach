"use client";

import { LayoutList, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { RoutineCard } from "@/components/routine/routine-card";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import {
  ActiveSessionExistsError,
  deleteRoutine,
  duplicateRoutine,
  moveRoutine,
  startSession,
} from "@/lib/db/mutations";
import { listRoutines } from "@/lib/db/queries";
import type { Routine } from "@/lib/db/schema";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useNow } from "@/lib/hooks/use-now";
import { elapsedSessionMs, formatStopwatch } from "@/lib/logic/timer";
import { useActiveSession } from "@/lib/session-context";
import { unlockAudio } from "@/lib/audio";
import { markSessionEntry } from "@/lib/session-entry";

export function AllenamentoView() {
  const router = useRouter();
  const routines = useLiveData(() => listRoutines(getDb()), []);
  const [toDelete, setToDelete] = React.useState<Routine | null>(null);

  const start = async (routineId?: string) => {
    // il gesto che avvia la sessione e' anche quello che sblocca l'audio del timer
    unlockAudio();
    try {
      await startSession(getDb(), { routineId });
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
    <>
      <PageHeader title="Allenamento" />

      <div className="app-container flex flex-col gap-8">
        <QuickStart onStartEmpty={() => void start()} />

        <section aria-labelledby="titolo-routine" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="titolo-routine" className="text-h2 text-[var(--text-primary)]">
              Routine
            </h2>
            <Button variant="ghost" asChild className="px-3">
              <Link href="/allenamento/routine/nuova">
                <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
                Nuova
              </Link>
            </Button>
          </div>

          <Async
            state={routines}
            loading={<ListSkeleton rows={3} height={88} />}
            isEmpty={(data) => data.length === 0}
            empty={
              <EmptyState
                icon={LayoutList}
                title="Nessuna routine"
                line="Crea la tua prima routine, o avvia subito una sessione vuota."
                action={
                  <Button block asChild>
                    <Link href="/allenamento/routine/nuova">Crea routine</Link>
                  </Button>
                }
                secondary={
                  <Button variant="ghost" block onClick={() => void start()}>
                    Sessione vuota
                  </Button>
                }
              />
            }
            errorDetail="Non riesco a leggere le routine salvate su questo dispositivo."
          >
            {(data) => (
              <ul className="flex flex-col gap-4 md:grid md:grid-cols-2">
                {data.map((routine, index) => (
                  <li key={routine.id}>
                    <RoutineCard
                      routine={routine}
                      index={index}
                      total={data.length}
                      onStart={() => void start(routine.id)}
                      onDelete={() => setToDelete(routine)}
                      onDuplicate={async () => {
                        const copy = await duplicateRoutine(getDb(), routine.id);
                        if (copy) toast.success(`Routine «${copy.name}» creata`);
                      }}
                      onMove={async (delta) => {
                        await moveRoutine(getDb(), routine.id, delta);
                        announce(
                          "system",
                          `${routine.name} spostata in posizione ${index + 1 + delta} di ${data.length}.`,
                        );
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </section>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Eliminare «${toDelete?.name ?? ""}»?`}
        body="La routine sparisce. Gli allenamenti già registrati restano."
        confirmLabel="Elimina"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteRoutine(getDb(), toDelete.id);
          toast.success(`Routine «${toDelete.name}» eliminata`);
          setToDelete(null);
        }}
      />
    </>
  );
}

/** `QuickStart` — §4.6. Con una sessione gia' attiva non esiste piu' un "avvia". */
function QuickStart({ onStartEmpty }: { onStartEmpty: () => void }) {
  const { data: session, status } = useActiveSession();
  const active = status === "ready" ? session : undefined;
  const now = useNow(1000, Boolean(active));

  if (status === "loading") {
    return <Skeleton className="h-24" />;
  }

  return (
    <section
      aria-labelledby="titolo-quickstart"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <h2 id="titolo-quickstart" className="text-h3 text-[var(--text-primary)]">
        Inizia ad allenarti
      </h2>
      <div className="mt-4">
        {active ? (
          <Button variant="secondary" size="lg" block asChild>
            <Link href="/sessione" onClick={markSessionEntry}>
              Riprendi sessione ·{" "}
              <span className="tnum">
                {now === 0 ? "--:--:--" : formatStopwatch(elapsedSessionMs(active, now))}
              </span>
            </Link>
          </Button>
        ) : (
          <Button size="lg" block onClick={onStartEmpty}>
            <Play aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Avvia sessione vuota
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        {active ? "L'allenamento continua finché non lo termini." : "Oppure scegli una routine."}
      </p>
    </section>
  );
}
