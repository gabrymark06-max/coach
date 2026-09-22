"use client";

import { History, Settings } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SessionRow } from "@/components/history/session-row";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { listPersonalRecords } from "@/lib/db/pr-ops";
import { listCompletedSessions } from "@/lib/db/queries";
import { formatInt, formatRelativeDay, formatVolumeKg } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted, useNow } from "@/lib/hooks/use-now";
import { formatMinutes } from "@/lib/logic/timer";
import { personalTotals } from "@/lib/logic/stats";

const STORICO_LIMITE = 200;

/**
 * Tab Profilo: **riepilogo personale + storico**, e niente altro.
 *
 * Nessun social, nessuna condivisione: la spec e' esplicita. Quello che c'e' qui e' la
 * risposta a due domande — "quanto mi sono allenato finora" e "cosa ho fatto l'ultima
 * volta" — e una porta per le impostazioni, che altrimenti non ne avrebbe nessuna.
 */
export function ProfiloView() {
  const sessions = useLiveData(
    () => listCompletedSessions(getDb(), STORICO_LIMITE),
    [],
  );
  const records = useLiveData(() => listPersonalRecords(getDb()), []);

  const prBySession = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records.data ?? []) {
      counts.set(record.sessionId, (counts.get(record.sessionId) ?? 0) + 1);
    }
    return counts;
  }, [records.data]);

  return (
    <>
      <PageHeader
        title="Profilo"
        action={
          <Button variant="secondary" asChild>
            <Link href="/impostazioni">
              <Settings aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Impostazioni
            </Link>
          </Button>
        }
      />

      <div className="app-container flex flex-col gap-8">
        <Async
          state={sessions}
          loading={<ListSkeleton rows={4} height={72} />}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState
              icon={History}
              title="Nessun allenamento registrato"
              line="Il tuo storico comparirà qui dopo la prima sessione."
              action={
                <Button block asChild>
                  <Link href="/allenamento">Inizia ad allenarti</Link>
                </Button>
              }
            />
          }
          errorDetail="Non riesco a leggere lo storico salvato su questo dispositivo."
        >
          {(rows) => (
            <>
              <Riepilogo sessions={rows} recordCount={records.data?.length ?? 0} />

              <section aria-labelledby="titolo-storico" className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="titolo-storico" className="text-h2 text-[var(--text-primary)]">
                    Storico
                  </h2>
                  <p className="tnum text-sm text-[var(--text-secondary)]">
                    {formatInt(rows.length)}
                    {rows.length === STORICO_LIMITE ? "+" : ""} allenamenti
                  </p>
                </div>

                <ul className="flex flex-col gap-3">
                  {rows.map((session) => (
                    <li key={session.id} className="list-cv">
                      <SessionRow
                        session={session}
                        prCount={prBySession.get(session.id) ?? 0}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </Async>
      </div>
    </>
  );
}

function Riepilogo({
  sessions,
  recordCount,
}: {
  sessions: Parameters<typeof personalTotals>[0];
  recordCount: number;
}) {
  const mounted = useMounted();
  // `personalTotals` dipende dall'orologio: durante l'SSR `useNow` vale 0 e la media
  // settimanale non si mostra (§11.7). L'aggiornamento al minuto basta e avanza.
  const now = useNow(60_000);
  const totals = React.useMemo(() => personalTotals(sessions, now || 0), [sessions, now]);

  const celle: [string, string][] = [
    ["Allenamenti", formatInt(totals.sessions)],
    ["Volume totale", formatVolumeKg(totals.volumeKg)],
    ["Serie", formatInt(totals.sets)],
    ["Tempo in palestra", formatMinutes(totals.durationSec * 1000)],
    [
      "A settimana",
      now ? totals.sessionsPerWeek.toFixed(1).replace(".", ",") : "—",
    ],
    ["Record personali", formatInt(recordCount)],
  ];

  return (
    <section aria-labelledby="titolo-riepilogo" className="flex flex-col gap-4">
      <h2 id="titolo-riepilogo" className="text-h2 text-[var(--text-primary)]">
        Il tuo riepilogo
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {celle.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
          >
            <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
            <dd className="tnum mt-1 truncate text-h2 text-[var(--text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {totals.firstAt ? (
        <p className="text-sm text-[var(--text-muted)]">
          Dal {mounted ? formatRelativeDay(totals.firstAt) : "—"}, su{" "}
          <span className="tnum">{totals.weeksTracked}</span> settimane.
        </p>
      ) : null}
    </section>
  );
}
