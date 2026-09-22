"use client";

import { LayoutList } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RoutineEditor } from "@/components/routine/routine-editor";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { getRoutine } from "@/lib/db/queries";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useRouteId } from "@/lib/hooks/use-route-id";

export function ModificaRoutineView() {
  const params = useParams<{ id: string }>();
  // l'id vero viene dall'indirizzo: offline si atterra sulla scocca (route-shell)
  const id = useRouteId(params.id);
  const state = useLiveData(() => getRoutine(getDb(), id), [id]);

  return (
    <>
      <PageHeader title="Modifica routine" />
      <div className="app-container">
        <Async
          state={state}
          loading={<ListSkeleton rows={4} height={72} />}
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
          {(routine) => (routine ? <RoutineEditor key={routine.id} routine={routine} /> : null)}
        </Async>
      </div>
    </>
  );
}
