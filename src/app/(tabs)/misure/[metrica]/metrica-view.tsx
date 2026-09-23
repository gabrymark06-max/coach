"use client";

import { Pencil, Plus, Ruler } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  ChartDataTable,
  ChartEmpty,
  ChartFrame,
  ChartSinglePoint,
  ChartSkeleton,
  RangeChips,
  monthsForRange,
  type SeriesDef,
} from "@/components/charts/chart-card";
import { TrendChart } from "@/components/charts/dynamic";
import { MeasureForm } from "@/components/measures/measure-form";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import {
  createMeasurement,
  deleteMeasurement,
  listMeasurements,
  updateMeasurement,
} from "@/lib/db/measurements";
import {
  METRIC_LABEL,
  METRIC_ORDER,
  METRIC_UNIT,
  type MeasurementEntry,
  type MetricKey,
} from "@/lib/db/schema";
import { formatDay, formatFull, formatKgValue } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { useRouteId } from "@/lib/hooks/use-route-id";

/**
 * Dettaglio di una metrica: **grafico di andamento + elenco voci + inserimento**.
 *
 * L'intervallo sta nella query string (§11.5), cosi' il tasto Indietro lo annulla e
 * ricaricare non lo azzera. Il grafico ha i tre stati di §4.10, compreso il caso da un
 * punto solo: si mostra il punto, non una linea inventata.
 */
export function MetricaView() {
  const params = useParams<{ metrica: string }>();
  const raw = useRouteId(params.metrica);
  const metric = (METRIC_ORDER as readonly string[]).includes(raw)
    ? (raw as MetricKey)
    : null;

  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const range = searchParams.get("intervallo") ?? "1a";

  const [editing, setEditing] = React.useState<MeasurementEntry | null>(null);
  const [adding, setAdding] = React.useState(searchParams.get("nuova") === "1");
  const [toDelete, setToDelete] = React.useState<MeasurementEntry | null>(null);

  const state = useLiveData(
    () => (metric ? listMeasurements(getDb(), metric) : Promise.resolve([])),
    [metric],
  );

  const setRange = React.useCallback(
    (next: string) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set("intervallo", next);
      router.replace(`?${query.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  if (!metric) {
    return (
      <EmptyState
        icon={Ruler}
        title="Misura sconosciuta"
        line="Questa metrica non esiste in Lifted."
        action={
          <Button block asChild>
            <Link href="/misure">Torna alle misure</Link>
          </Button>
        }
      />
    );
  }

  const unit = METRIC_UNIT[metric];
  const label = METRIC_LABEL[metric];
  const all = state.status === "ready" ? state.data : [];
  const last = all.at(-1) ?? null;

  const months = monthsForRange(range);
  const since =
    months == null
      ? null
      : new Date(new Date().setMonth(new Date().getMonth() - months)).toISOString();
  const visible = since ? all.filter((entry) => entry.date >= since) : all;

  const series: SeriesDef[] = [
    { key: "value", name: label, color: "var(--chart-3)", shape: "circle", unit },
  ];

  return (
    <>
      <PageHeader
        title={label}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Aggiungi
          </Button>
        }
      >
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {last
            ? `Ultima: ${formatKgValue(last.value)} ${unit}`
            : `Nessuna misurazione in ${unit}`}
        </p>
      </PageHeader>

      <div className="app-container flex flex-col gap-6 pb-8">
        <ChartFrame
          title="Andamento"
          titleId="titolo-andamento"
          actions={
            <RangeChips
              value={range}
              onChange={setRange}
              label="Intervallo del grafico"
            />
          }
        >
          {state.status === "loading" ? (
            <ChartSkeleton />
          ) : visible.length === 0 ? (
            <ChartEmpty
              line="Registra almeno due misurazioni per vedere l'andamento."
              action={
                <Button variant="secondary" onClick={() => setAdding(true)}>
                  Aggiungi misurazione
                </Button>
              }
            />
          ) : visible.length === 1 ? (
            <ChartSinglePoint
              value={`${formatKgValue(visible[0].value)} ${unit}`}
              label={mounted ? formatDay(visible[0].date) : "—"}
              hint="Serve un secondo dato per tracciare una linea."
            />
          ) : (
            <>
              <TrendChart
                data={visible.map((entry) => ({ date: entry.date, value: entry.value }))}
                series={series}
                xKey="date"
                yUnit={unit}
                domainMode="level"
                unitStep={0.5}
                formatX={(value) => formatDay(value)}
                formatTooltipLabel={(value) => formatFull(value)}
                formatValue={(value) => `${formatKgValue(value)} ${unit}`}
                ariaLabel={`Andamento di ${label} in ${unit}`}
              />
              <ChartDataTable
                caption={`Andamento di ${label}`}
                columns={["Data", `Valore (${unit})`]}
                rows={visible.map((entry) => [
                  mounted ? formatDay(entry.date) : entry.date,
                  formatKgValue(entry.value),
                ])}
              />
            </>
          )}
        </ChartFrame>

        <section aria-labelledby="titolo-voci" className="flex flex-col gap-4">
          <h2 id="titolo-voci" className="text-h2 text-[var(--text-primary)]">
            Registrazioni
          </h2>

          <Async
            state={state}
            loading={<ListSkeleton rows={4} />}
            isEmpty={(rows) => rows.length === 0}
            empty={
              <EmptyState
                icon={Ruler}
                title="Nessuna misurazione"
                line={`Registra ${label.toLocaleLowerCase("it-IT")} per vedere l'andamento nel tempo.`}
                action={
                  <Button block onClick={() => setAdding(true)}>
                    Aggiungi misurazione
                  </Button>
                }
              />
            }
            errorDetail="Non riesco a leggere questa metrica su questo dispositivo."
          >
            {(rows) => (
              <ul className="flex flex-col">
                {rows
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="flex min-h-14 items-center gap-4 border-b border-[var(--border)] py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base text-[var(--text-primary)]">
                          {mounted ? formatDay(entry.date) : "—"}
                        </p>
                        {entry.note ? (
                          <p className="truncate text-sm text-[var(--text-muted)]">
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                      <span className="tnum text-num-md text-[var(--text-primary)]">
                        {formatKgValue(entry.value)} {unit}
                      </span>
                      <button
                        type="button"
                        aria-label={`Modifica la misurazione del ${mounted ? formatDay(entry.date) : ""}, ${formatKgValue(entry.value)} ${unit}`}
                        onClick={() => setEditing(entry)}
                        className="press inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                      >
                        <Pencil aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Async>
        </section>
      </div>

      <MeasureForm
        open={adding}
        onOpenChange={setAdding}
        metric={metric}
        lastValue={last?.value ?? null}
        onSubmit={async (input) => {
          await createMeasurement(getDb(), { metric, ...input });
          toast.success(`${label}: ${formatKgValue(input.value)} ${unit} registrato`);
          announce("system", `${label} registrata: ${formatKgValue(input.value)} ${unit}.`);
        }}
      />

      <MeasureForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        metric={metric}
        entry={editing}
        lastValue={last?.value ?? null}
        onSubmit={async (input) => {
          if (!editing) return;
          await updateMeasurement(getDb(), editing.id, { metric, ...input });
          toast.success("Misurazione aggiornata");
        }}
        onDelete={() => {
          setToDelete(editing);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminare questa misurazione?"
        body="Sparisce dall'elenco e dal grafico."
        confirmLabel="Elimina"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteMeasurement(getDb(), toDelete.id);
          toast.success("Misurazione eliminata");
          setToDelete(null);
        }}
      />
    </>
  );
}
