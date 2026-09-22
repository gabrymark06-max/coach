"use client";

import { ChevronRight, Ruler } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Sparkline } from "@/components/measures/sparkline";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { measurementSummaries, type MetricSummary } from "@/lib/db/measurements";
import { METRIC_LABEL, METRIC_ORDER, METRIC_UNIT } from "@/lib/db/schema";
import { formatKgValue, formatRelativeDay } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";

/**
 * Tab Misure (spec §3.6).
 *
 * Una riga per metrica con l'ultimo valore, la differenza dalla volta prima e la
 * sparkline. Il **segno della differenza non e' affidato al colore**: c'e' sempre il `+`
 * o il `−` scritto, e la parola nel nome accessibile.
 */
export function MisureView() {
  const state = useLiveData(
    () => measurementSummaries(getDb(), METRIC_ORDER),
    [],
  );

  return (
    <>
      <PageHeader title="Misure" />

      <div className="app-container flex flex-col gap-5">
        <Async
          state={state}
          loading={<ListSkeleton rows={6} height={72} />}
          isEmpty={(rows) => rows.every((row) => row.count === 0)}
          empty={
            <EmptyState
              icon={Ruler}
              title="Nessuna misurazione"
              line="Registra peso e circonferenze per vedere l'andamento nel tempo."
              action={
                <Button block asChild>
                  <Link href="/misure/bodyweight?nuova=1">Aggiungi misurazione</Link>
                </Button>
              }
            />
          }
          errorDetail="Non riesco a leggere le misure salvate su questo dispositivo."
        >
          {(rows) => (
            <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
              {rows.map((row) => (
                <li key={row.metric}>
                  <MetricRow summary={row} />
                </li>
              ))}
            </ul>
          )}
        </Async>
      </div>
    </>
  );
}

function MetricRow({ summary }: { summary: MetricSummary }) {
  const mounted = useMounted();
  const unit = METRIC_UNIT[summary.metric];
  const label = METRIC_LABEL[summary.metric];
  const delta = summary.delta;

  const deltaText =
    delta == null || delta === 0
      ? null
      : `${delta > 0 ? "+" : "−"}${formatKgValue(Math.abs(delta))} ${unit}`;

  return (
    <Link
      href={`/misure/${summary.metric}`}
      className="press flex min-h-14 items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-h3 text-[var(--text-primary)]">{label}</p>
        {summary.latest ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {mounted ? formatRelativeDay(summary.latest.date) : "—"}
            {deltaText ? (
              <>
                {" · "}
                <span className="tnum">{deltaText}</span>
                <span className="sr-only">
                  {delta! > 0 ? " in aumento" : " in calo"} rispetto alla misura precedente
                </span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--text-muted)]">Mai registrata</p>
        )}
      </div>

      <Sparkline points={summary.spark} className="hidden shrink-0 sm:block" />

      <span className="tnum shrink-0 text-num-set text-[var(--text-primary)]">
        {summary.latest ? `${formatKgValue(summary.latest.value)} ${unit}` : "—"}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
    </Link>
  );
}
