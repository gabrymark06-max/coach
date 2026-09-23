"use client";

import { Dumbbell, LayoutList, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { QuickActions, RailCard, RightRail } from "@/components/layout/right-rail";
import { RoutineCard, RoutineCardSkeleton } from "@/components/routine/routine-card";
import { QuickStart } from "@/components/shared/quick-start";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { unlockAudio } from "@/lib/audio";
import { markSessionEntry } from "@/lib/session-entry";

export function AllenamentoView() {
  const router = useRouter();
  const routines = useLiveData(() => listRoutines(getDb()), []);
  const [toDelete, setToDelete] = React.useState<Routine | null>(null);

  const ultime = React.useMemo(
    () =>
      [...(routines.data ?? [])]
        .filter((routine) => routine.lastPerformedAt)
        .sort((a, b) => (b.lastPerformedAt ?? "").localeCompare(a.lastPerformedAt ?? ""))
        .slice(0, 3),
    [routines.data],
  );

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
        <QuickStart />

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
            loading={
              <ul className="flex flex-col gap-4 md:grid md:grid-cols-2">
                {[0, 1, 2].map((row) => (
                  <li key={row}>
                    <RoutineCardSkeleton />
                  </li>
                ))}
              </ul>
            }
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

      {/* la colonna in coda al centro non si monta prima del contenuto sopra: v. §4.20 */}
      <RightRail ready={routines.status !== "loading"}>
        <RailCard title="Azioni rapide">
          <QuickActions
            actions={[
              { href: "/allenamento/routine/nuova", label: "Nuova routine", icon: Plus },
              { href: "/esercizi/nuovo", label: "Nuovo esercizio", icon: Dumbbell },
            ]}
          />
        </RailCard>

        {/*
          «Ultime usate» — tre routine, per il caso frequente: si apre l'app e si
          riparte da dove si era rimasti. Una card di riepilogo senza dati non si mostra
          vuota: senza routine gia' usate questa non si monta affatto (§4.20).
        */}
        {ultime.length > 0 ? (
          <RailCard title="Ultime usate">
            <QuickActions
              actions={ultime.map((routine) => ({
                href: `/allenamento/routine/${routine.id}`,
                label: routine.name,
                icon: LayoutList,
              }))}
            />
          </RailCard>
        ) : null}
      </RightRail>
    </>
  );
}
