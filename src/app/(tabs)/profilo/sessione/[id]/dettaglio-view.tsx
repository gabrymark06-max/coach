"use client";

import { History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { SessionDetail } from "@/components/history/session-detail";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getDb } from "@/lib/db/db";
import { deleteSession } from "@/lib/db/mutations";
import { personalRecordsForSession } from "@/lib/db/pr-ops";
import { getSession } from "@/lib/db/queries";
import { formatFull } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { useRouteId } from "@/lib/hooks/use-route-id";
import { useSettings } from "@/lib/session-context";

/** Dettaglio di un allenamento passato (§6.1, TAB 2). Identico al riepilogo, ma senza festa. */
export function DettaglioSessioneView() {
  const params = useParams<{ id: string }>();
  const id = useRouteId(params.id);
  const router = useRouter();
  const mounted = useMounted();
  const settings = useSettings();
  const [deleting, setDeleting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const state = useLiveData(
    async () => {
      if (!id) return null;
      const db = getDb();
      const [session, records] = await Promise.all([
        getSession(db, id),
        personalRecordsForSession(db, id),
      ]);
      if (!session) return null;
      const nameById = new Map<string, string>();
      for (const exercise of session.exercises) {
        nameById.set(exercise.exerciseId, exercise.exerciseName);
      }
      return { session, records, nameById };
    },
    [id],
  );

  return (
    <Async
      state={state}
      loading={
        <div className="app-container pt-9">
          <ListSkeleton rows={3} height={96} />
        </div>
      }
      isEmpty={(data) => data === null}
      empty={
        <EmptyState
          icon={History}
          title="Allenamento non trovato"
          line="Questo allenamento non esiste più su questo dispositivo."
          action={
            <Button block asChild>
              <Link href="/profilo">Torna allo storico</Link>
            </Button>
          }
        />
      }
      errorDetail="Non riesco a leggere questo allenamento su questo dispositivo."
    >
      {(data) =>
        data ? (
          <>
            <PageHeader
              title={data.session.routineName ?? "Sessione libera"}
              action={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Elimina questo allenamento"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </Button>
              }
            >
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {mounted ? formatFull(data.session.startedAt) : "—"}
              </p>
            </PageHeader>

            <div className="app-container flex flex-col gap-6 pb-8">
              <SessionDetail
                session={data.session}
                records={data.records}
                nameById={data.nameById}
                formula={settings.e1rmFormula}
              />
            </div>

            <ConfirmDialog
              open={deleting}
              onOpenChange={setDeleting}
              title="Eliminare questo allenamento?"
              body="Volume, serie e PR calcolati da questa sessione verranno ricalcolati."
              confirmLabel="Elimina"
              onConfirm={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await deleteSession(getDb(), data.session.id);
                  toast.success("Allenamento eliminato");
                  router.replace("/profilo");
                } catch {
                  toast.error("Non riesco a eliminare questo allenamento.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : null
      }
    </Async>
  );
}
