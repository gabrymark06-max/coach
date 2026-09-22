"use client";

import { History } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { SessionDetail } from "@/components/history/session-detail";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { prSpokenLabel, sortByKind } from "@/components/shared/pr-badge";
import { Button } from "@/components/ui/button";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { personalRecordsForSession } from "@/lib/db/pr-ops";
import { getSession } from "@/lib/db/queries";
import { formatFull } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { useRouteId } from "@/lib/hooks/use-route-id";
import { useSettings } from "@/lib/session-context";

/**
 * Riepilogo post-workout (§6.2).
 *
 * I record conquistati stanno in cima, pieni e animati una volta sola, e vengono
 * **annunciati** nella regione `#sr-pr` (§8.5) — con `prefers-reduced-motion`
 * l'animazione sparisce, l'annuncio no.
 */
export function RiepilogoView() {
  const params = useParams<{ id: string }>();
  const id = useRouteId(params.id);
  const router = useRouter();
  const mounted = useMounted();
  const settings = useSettings();

  const state = useLiveData(
    async () => {
      if (!id) return null;
      const db = getDb();
      const [session, records] = await Promise.all([
        getSession(db, id),
        personalRecordsForSession(db, id),
      ]);
      if (!session) return null;
      const names = await db.exercises.bulkGet([
        ...new Set(records.map((record) => record.exerciseId)),
      ]);
      const nameById = new Map<string, string>();
      for (const exercise of names) {
        if (exercise) nameById.set(exercise.id, exercise.name);
      }
      for (const exercise of session.exercises) {
        if (!nameById.has(exercise.exerciseId)) {
          nameById.set(exercise.exerciseId, exercise.exerciseName);
        }
      }
      return { session, records, nameById };
    },
    [id],
  );

  const records = state.status === "ready" ? state.data?.records : undefined;
  const nameById = state.status === "ready" ? state.data?.nameById : undefined;
  const announced = React.useRef(false);

  React.useEffect(() => {
    if (announced.current || !records || records.length === 0 || !nameById) return;
    announced.current = true;
    announce(
      "pr",
      sortByKind(records)
        .map((record) =>
          prSpokenLabel(record, nameById.get(record.exerciseId) ?? "esercizio"),
        )
        .join(" "),
    );
  }, [records, nameById]);

  return (
    <div className="app-container flex flex-col gap-6 py-11">
      <Async
        state={state}
        loading={<ListSkeleton rows={3} height={96} />}
        isEmpty={(data) => data === null}
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
        errorDetail="Non riesco a leggere questo allenamento su questo dispositivo."
      >
        {(data) =>
          data ? (
            <>
              <header>
                <h1 className="text-h1 text-[var(--text-primary)]">Allenamento salvato</h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {data.session.routineName ? `${data.session.routineName} · ` : null}
                  {mounted ? formatFull(data.session.startedAt) : null}
                </p>
              </header>

              <SessionDetail
                session={data.session}
                records={data.records}
                nameById={data.nameById}
                fresh
                formula={settings.e1rmFormula}
              />

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
