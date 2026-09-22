"use client";

import { Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  CHART_SERIES_STYLES,
  ChartDataTable,
  ChartEmpty,
  ChartFrame,
  ChartSinglePoint,
  ChartSkeleton,
  RangeChips,
  SeriesGlyph,
  monthsForRange,
  type SeriesDef,
} from "@/components/charts/chart-card";
import { MuscleRadial, TrendChart, VolumeBars } from "@/components/charts/dynamic";
import { PRBadge, prValueLabel } from "@/components/shared/pr-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { listPersonalRecords } from "@/lib/db/pr-ops";
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from "@/lib/db/schema";
import { formatDay, formatFull, formatInt, formatKgValue, formatVolume } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import {
  aggregateByPeriod,
  e1rmSeries,
  volumeByMuscleGroup,
  type MuscleLookupEntry,
} from "@/lib/logic/stats";
import { useSettings } from "@/lib/session-context";

/**
 * Tab Statistiche (spec §3.5).
 *
 * Quattro blocchi: volume per periodo, distribuzione per gruppo muscolare, andamento del
 * 1RM stimato per esercizio, elenco dei record. Tutto cio' che e' stato di vista —
 * periodo, intervallo, esercizio scelto — vive **nella query string** (§11.5).
 *
 * I tre grafici arrivano da `charts/dynamic`: Recharts si scarica aprendo questa pagina
 * e non pesa sul resto dell'app.
 */
export function StatisticheView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useSettings();
  const mounted = useMounted();

  const period = searchParams.get("periodo") === "mese" ? "month" : "week";
  const range = searchParams.get("intervallo") ?? "6m";
  const exerciseParam = searchParams.get("esercizio");

  const state = useLiveData(async () => {
    const db = getDb();
    const [sessions, exercises, records] = await Promise.all([
      db.sessions.where("status").equals("completed").toArray(),
      db.exercises.toArray(),
      listPersonalRecords(db, 50),
    ]);
    const lookup = new Map<string, MuscleLookupEntry>();
    const nameById = new Map<string, string>();
    for (const exercise of exercises) {
      lookup.set(exercise.id, {
        muscleGroup: exercise.muscleGroup,
        secondaryMuscles: exercise.secondaryMuscles ?? [],
      });
      nameById.set(exercise.id, exercise.name);
    }
    return { sessions, lookup, nameById, records };
  }, []);

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set(key, value);
      router.replace(`?${query.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <>
      <PageHeader title="Statistiche" />

      <div className="app-container flex flex-col gap-6 pb-8">
        <Async
          state={state}
          loading={
            <div className="flex flex-col gap-6">
              <ChartSkeleton />
              <ListSkeleton rows={3} height={72} />
            </div>
          }
          isEmpty={(data) => data.sessions.length < 2}
          empty={
            <EmptyState
              icon={TrendingUp}
              title="Servono più dati"
              line="Completa almeno due sessioni per vedere le statistiche."
              action={
                <Button block asChild>
                  <Link href="/allenamento">Inizia ad allenarti</Link>
                </Button>
              }
            />
          }
          errorDetail="Non riesco a calcolare le statistiche da questo dispositivo."
        >
          {(data) => {
            const months = monthsForRange(range);
            const since =
              months == null
                ? null
                : new Date(new Date().setMonth(new Date().getMonth() - months)).toISOString();
            const inRange = since
              ? data.sessions.filter((session) => session.startedAt >= since)
              : data.sessions;

            const buckets = aggregateByPeriod(inRange, period);
            const muscles = volumeByMuscleGroup(inRange, data.lookup);

            const allenati = [...new Set(data.sessions.flatMap((s) => s.exerciseIds))]
              .map((id) => ({ id, name: data.nameById.get(id) ?? null }))
              .filter((item): item is { id: string; name: string } => item.name !== null)
              .toSorted((a, b) => a.name.localeCompare(b.name, "it-IT"));

            const exerciseId =
              exerciseParam && allenati.some((item) => item.id === exerciseParam)
                ? exerciseParam
                : (allenati[0]?.id ?? null);
            const punti = exerciseId
              ? e1rmSeries(inRange, exerciseId, settings.e1rmFormula)
              : [];

            const serie1rm: SeriesDef[] = [
              { key: "value", name: "1RM stimato", color: "var(--chart-2)", shape: "diamond" },
            ];

            const formatBucket = (key: string) => {
              const bucket = buckets.find((item) => item.key === key);
              if (!bucket) return key;
              return period === "week"
                ? formatDay(bucket.start)
                : new Intl.DateTimeFormat("it-IT", {
                    month: "short",
                    year: "2-digit",
                  }).format(new Date(bucket.start));
            };

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div role="group" aria-label="Periodo" className="flex gap-2">
                    {(
                      [
                        ["settimana", "Settimana", "week"],
                        ["mese", "Mese", "month"],
                      ] as const
                    ).map(([value, label, key]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={period === key}
                        onClick={() => setParam("periodo", value)}
                        className={
                          period === key
                            ? "press inline-flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--accent-blue)] bg-[var(--set-done-surface)] px-4 text-label text-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                            : "press inline-flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--card)] px-4 text-label text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <RangeChips
                    value={range}
                    onChange={(next) => setParam("intervallo", next)}
                    label="Intervallo delle statistiche"
                  />
                </div>

                <ChartFrame
                  title={period === "week" ? "Volume settimanale" : "Volume mensile"}
                  titleId="titolo-volume"
                  subtitle={`${formatInt(inRange.length)} allenamenti nell'intervallo scelto`}
                >
                  {buckets.length === 0 ? (
                    <ChartEmpty line="Nessun allenamento in questo intervallo. Prova ad allargarlo." />
                  ) : buckets.length === 1 ? (
                    <ChartSinglePoint
                      value={`${formatVolume(buckets[0].volumeKg)} kg`}
                      label={
                        period === "week"
                          ? `settimana del ${formatBucket(buckets[0].key)}`
                          : formatBucket(buckets[0].key)
                      }
                      hint="Serve un secondo periodo per tracciare un confronto."
                    />
                  ) : (
                    <>
                      <VolumeBars
                        data={buckets.map((bucket) => ({
                          key: bucket.key,
                          volumeKg: bucket.volumeKg,
                        }))}
                        xKey="key"
                        barKey="volumeKg"
                        barName="Volume"
                        formatX={formatBucket}
                        formatTooltipLabel={formatBucket}
                        formatValue={(value) => `${formatVolume(value)} kg`}
                        ariaLabel={
                          period === "week"
                            ? "Volume totale per settimana, in chilogrammi"
                            : "Volume totale per mese, in chilogrammi"
                        }
                      />
                      <ChartDataTable
                        caption={period === "week" ? "Volume settimanale" : "Volume mensile"}
                        columns={["Periodo", "Volume (kg)", "Serie", "Allenamenti"]}
                        rows={buckets.map((bucket) => [
                          mounted ? formatBucket(bucket.key) : bucket.key,
                          formatVolume(bucket.volumeKg),
                          String(bucket.sets),
                          String(bucket.sessions),
                        ])}
                      />
                    </>
                  )}
                </ChartFrame>

                <ChartFrame
                  title="Distribuzione per gruppo muscolare"
                  titleId="titolo-distribuzione"
                  subtitle="Il volume di un esercizio va per metà peso ai muscoli secondari."
                >
                  {muscles.length === 0 ? (
                    <ChartEmpty line="Serve almeno una serie completata con un peso." />
                  ) : (
                    <div className="flex flex-col gap-5 md:flex-row md:items-center">
                      <div className="w-full md:w-1/2">
                        <MuscleRadial
                          data={muscles.map((row, index) => ({
                            name: MUSCLE_GROUP_LABEL[row.muscleGroup],
                            volumeKg: row.volumeKg,
                            share: row.share,
                            color: CHART_SERIES_STYLES[index % CHART_SERIES_STYLES.length].color,
                          }))}
                          ariaLabel="Distribuzione del volume per gruppo muscolare"
                        />
                      </div>
                      <ul className="flex w-full flex-col gap-3 md:w-1/2">
                        {muscles.map((row, index) => (
                          <li
                            key={row.muscleGroup}
                            className="flex items-center gap-3 border-b border-[var(--border)] pb-2"
                          >
                            <SeriesGlyph
                              shape={CHART_SERIES_STYLES[index % CHART_SERIES_STYLES.length].shape}
                              color={CHART_SERIES_STYLES[index % CHART_SERIES_STYLES.length].color}
                            />
                            <span className="min-w-0 flex-1 truncate text-base text-[var(--text-primary)]">
                              {MUSCLE_GROUP_LABEL[row.muscleGroup as MuscleGroup]}
                            </span>
                            <span className="tnum text-num-md text-[var(--text-primary)]">
                              {formatVolume(row.volumeKg)} kg
                            </span>
                            <span className="tnum w-14 text-right text-sm text-[var(--text-secondary)]">
                              {Math.round(row.share * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </ChartFrame>

                <ChartFrame
                  title="1RM stimato"
                  titleId="titolo-1rm"
                  subtitle={`Formula ${settings.e1rmFormula === "epley" ? "Epley" : "Brzycki"}, la serie migliore di ogni allenamento.`}
                  actions={
                    allenati.length > 0 ? (
                      <div className="flex min-w-0 flex-col gap-2">
                        <label
                          htmlFor="scelta-esercizio"
                          className="text-label text-[var(--text-secondary)]"
                        >
                          Esercizio
                        </label>
                        <select
                          id="scelta-esercizio"
                          value={exerciseId ?? ""}
                          onChange={(event) => setParam("esercizio", event.target.value)}
                          className="h-12 max-w-60 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-base text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                        >
                          {allenati.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null
                  }
                >
                  {punti.length === 0 ? (
                    <ChartEmpty line="Nessuna serie stimabile per questo esercizio nell'intervallo scelto." />
                  ) : punti.length === 1 ? (
                    <ChartSinglePoint
                      value={`${formatKgValue(punti[0].value)} kg`}
                      label={mounted ? formatDay(punti[0].date) : "—"}
                      hint="Serve un secondo allenamento per tracciare una linea."
                    />
                  ) : (
                    <>
                      <TrendChart
                        data={punti.map((point) => ({
                          date: point.date,
                          value: point.value,
                        }))}
                        series={serie1rm}
                        xKey="date"
                        yUnit="kg"
                        formatX={(value) => formatDay(value)}
                        formatTooltipLabel={(value) => formatFull(value)}
                        formatValue={(value) => `${formatKgValue(value)} kg`}
                        ariaLabel={`Andamento del 1RM stimato di ${data.nameById.get(exerciseId ?? "") ?? ""}`}
                      />
                      <ChartDataTable
                        caption="1RM stimato per allenamento"
                        columns={["Data", "1RM stimato (kg)", "Serie migliore"]}
                        rows={punti.map((point) => [
                          mounted ? formatDay(point.date) : point.date,
                          formatKgValue(point.value),
                          `${formatKgValue(point.weightKg)} kg × ${point.reps}`,
                        ])}
                      />
                    </>
                  )}
                </ChartFrame>

                <section aria-labelledby="titolo-record" className="flex flex-col gap-4">
                  <h2 id="titolo-record" className="text-h2 text-[var(--text-primary)]">
                    Record personali
                  </h2>
                  {data.records.length === 0 ? (
                    <EmptyState
                      icon={Trophy}
                      title="Nessun record ancora"
                      line="Il primo allenamento con un peso e delle ripetizioni ne genera tre."
                    />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {data.records.map((record) => (
                        <li
                          key={record.id}
                          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
                        >
                          <PRBadge kind={record.kind} />
                          <Link
                            href={`/esercizi/${record.exerciseId}`}
                            className="min-w-0 flex-1 truncate text-base text-[var(--accent-blue)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                          >
                            {data.nameById.get(record.exerciseId) ?? "Esercizio rimosso"}
                          </Link>
                          <span className="tnum text-num-md text-[var(--text-primary)]">
                            {prValueLabel(record)}
                          </span>
                          <span className="tnum text-sm text-[var(--text-muted)]">
                            {mounted ? formatDay(record.achievedAt) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            );
          }}
        </Async>
      </div>
    </>
  );
}
