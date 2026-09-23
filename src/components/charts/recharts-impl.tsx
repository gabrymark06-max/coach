"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKgValue } from "@/lib/format";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { levelDomain } from "@/lib/logic/chart-domain";
import { cn } from "@/lib/utils";
import { SeriesGlyph, type DotShape, type SeriesDef } from "./chart-card";

/**
 * I grafici veri (§4.10). **Questo file non viene mai importato staticamente**: ci si
 * arriva solo da `charts/dynamic.tsx`, cosi' Recharts sta in un chunk suo e non pesa
 * sul primo caricamento dell'app.
 *
 * Regole del design system applicate qui, tutte verificabili:
 *  - colori solo da token (`var(--chart-N)`), assi `--chart-axis`, griglia `--chart-grid`
 *    orizzontale e tratteggiata, nessuna griglia verticale;
 *  - **nessuna serie distinta dal solo colore**: ogni serie ha la forma del punto
 *    diversa (cerchio, quadrato, rombo, triangolo) e il nome per esteso in legenda;
 *  - `accessibilityLayer` di Recharts: il grafico prende il focus e le frecce muovono
 *    il punto attivo; accanto c'e' comunque la tabella `sr-only` (`ChartDataTable`);
 *  - `prefers-reduced-motion` → `isAnimationActive={false}`.
 */

interface DotProps {
  cx?: number;
  cy?: number;
  fill?: string;
}

const DOT_SIZE = 5;

function shapeDot(shape: DotShape, color: string) {
  function Dot({ cx, cy }: DotProps) {
    if (cx == null || cy == null) return null;
    switch (shape) {
      case "square":
        return (
          <rect
            x={cx - DOT_SIZE}
            y={cy - DOT_SIZE}
            width={DOT_SIZE * 2}
            height={DOT_SIZE * 2}
            fill={color}
          />
        );
      case "diamond":
        return (
          <polygon
            points={`${cx},${cy - DOT_SIZE - 1} ${cx + DOT_SIZE + 1},${cy} ${cx},${cy + DOT_SIZE + 1} ${cx - DOT_SIZE - 1},${cy}`}
            fill={color}
          />
        );
      case "triangle":
        return (
          <polygon
            points={`${cx},${cy - DOT_SIZE - 1} ${cx + DOT_SIZE + 1},${cy + DOT_SIZE} ${cx - DOT_SIZE - 1},${cy + DOT_SIZE}`}
            fill={color}
          />
        );
      default:
        return <circle cx={cx} cy={cy} r={DOT_SIZE} fill={color} />;
    }
  }
  Dot.displayName = `Dot-${shape}`;
  return Dot;
}

const AXIS_TICK = {
  fill: "var(--chart-axis)",
  fontSize: 12,
  fontFamily: "var(--font-sans)",
} as const;

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  formatLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  series: readonly SeriesDef[];
  formatLabel: (value: string) => string;
  formatValue: (value: number, series: SeriesDef) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--popover)] p-4 shadow-[var(--elev-2)]">
      <p className="text-label text-[var(--text-secondary)]">{formatLabel(String(label))}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {payload.map((item) => {
          const definition = series.find((one) => one.key === item.dataKey);
          if (!definition || typeof item.value !== "number") return null;
          return (
            <li key={definition.key} className="flex items-center gap-3">
              <SeriesGlyph shape={definition.shape} color={definition.color} />
              <span className="text-sm text-[var(--text-secondary)]">{definition.name}</span>
              <span className="tnum text-num-md text-[var(--text-primary)]">
                {formatValue(item.value, definition)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Legenda fuori dall'SVG: sono pulsanti veri, con area da 48px e `aria-pressed`. */
export function ChartLegend({
  series,
  hidden,
  onToggle,
}: {
  series: readonly SeriesDef[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-2">
      {series.map((one) => {
        const visible = !hidden.has(one.key);
        return (
          <li key={one.key}>
            <button
              type="button"
              aria-pressed={visible}
              onClick={() => onToggle(one.key)}
              className={cn(
                "press inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                visible
                  ? "border-[var(--border-strong)] bg-[var(--card)] text-[var(--text-primary)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] line-through",
              )}
            >
              <SeriesGlyph
                shape={one.shape}
                color={visible ? one.color : "var(--text-disabled)"}
              />
              {one.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export type ChartDatum = Readonly<Record<string, string | number | null | undefined>>;

export interface TrendChartProps {
  data: readonly ChartDatum[];
  series: readonly SeriesDef[];
  xKey: string;
  formatX: (value: string) => string;
  formatTooltipLabel: (value: string) => string;
  formatValue: (value: number, series: SeriesDef) => string;
  yUnit?: string;
  ariaLabel: string;
  /**
   * §4.10-bis. `"level"` = grandezza di livello (peso, 1RM, circonferenza): l'asse
   * parte dal minimo e il piede dichiara la scala. `"zero"` = grandezza cumulativa.
   * Non ha default di comodo: chi monta un grafico deve rispondere alla domanda.
   */
  domainMode: "level" | "zero";
  /** incremento sotto il quale la grandezza non si misura: 0,5 kg / 0,5 % / 0,5 cm */
  unitStep?: number;
}

export function TrendChart({
  data,
  series,
  xKey,
  formatX,
  formatTooltipLabel,
  formatValue,
  yUnit,
  domainMode,
  unitStep = 0.5,
  ariaLabel,
}: TrendChartProps) {
  const reduced = useReducedMotion();
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggle = React.useCallback((key: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const visible = React.useMemo(
    () => series.filter((one) => !hidden.has(one.key)),
    [series, hidden],
  );

  /**
   * §4.10-bis. Il dominio si calcola **sulle sole serie visibili**: nascondere una
   * curva dalla legenda deve riscalare l'asse, altrimenti resta il vuoto lasciato da
   * un dato che non c'e' piu'.
   */
  const domain = React.useMemo(() => {
    if (domainMode === "zero") return null;
    const values: number[] = [];
    for (const row of data) {
      for (const one of visible) {
        const value = row[one.key];
        if (typeof value === "number") values.push(value);
      }
    }
    return levelDomain(values, unitStep);
  }, [data, domainMode, unitStep, visible]);

  return (
    <div>
      <ChartLegend series={series} hidden={hidden} onToggle={toggle} />
      <ResponsiveContainer width="100%" height="100%" className="h-60! md:h-70!">
        <LineChart
          data={data as Record<string, unknown>[]}
          margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
          accessibilityLayer
          role="img"
          aria-label={ariaLabel}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatX}
            tick={AXIS_TICK}
            stroke="var(--border)"
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke="var(--border)"
            width={56}
            domain={domain ? [domain.min, domain.max] : [0, "auto"]}
            tickCount={domain ? domain.tickCount : undefined}
            allowDecimals={domain ? domain.step < 1 : true}
            tickFormatter={(value: number, index: number) =>
              index === 0 && yUnit
                ? `${formatKgValue(value)} ${yUnit}`
                : formatKgValue(value)
            }
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={
              <ChartTooltip
                series={series}
                formatLabel={formatTooltipLabel}
                formatValue={formatValue}
              />
            }
          />
          {visible.map((one) => (
            <Line
              key={one.key}
              type="monotone"
              dataKey={one.key}
              name={one.name}
              stroke={one.color}
              strokeWidth={2}
              connectNulls
              isAnimationActive={!reduced}
              dot={shapeDot(one.shape, one.color)}
              activeDot={shapeDot(one.shape, one.color)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/*
        §4.10-bis — la dichiarazione obbligatoria. Quando l'asse non parte da zero il
        lettore ha perso il riferimento piu' forte che aveva, e la riga glielo ridà in
        numeri. Sui grafici ancorati a zero non compare: sarebbe rumore, lo zero e' li'.
      */}
      {domain ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {domain.flat ? (
            "Nessuna variazione nel periodo."
          ) : (
            <>
              Scala:{" "}
              <span className="tnum">
                {formatKgValue(domain.min)} – {formatKgValue(domain.max)}
              </span>
              {yUnit ? ` ${yUnit}` : null}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

export interface VolumeBarsProps {
  data: readonly ChartDatum[];
  xKey: string;
  barKey: string;
  barName: string;
  formatX: (value: string) => string;
  formatTooltipLabel: (value: string) => string;
  formatValue: (value: number, series: SeriesDef) => string;
  ariaLabel: string;
}

export function VolumeBars({
  data,
  xKey,
  barKey,
  barName,
  formatX,
  formatTooltipLabel,
  formatValue,
  ariaLabel,
}: VolumeBarsProps) {
  const reduced = useReducedMotion();
  const series: SeriesDef[] = React.useMemo(
    () => [{ key: barKey, name: barName, color: "var(--chart-1)", shape: "square" }],
    [barKey, barName],
  );

  return (
    <ResponsiveContainer width="100%" height="100%" className="h-60! md:h-70!">
      <BarChart
        data={data as Record<string, unknown>[]}
        margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
        accessibilityLayer
        role="img"
        aria-label={ariaLabel}
      >
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="2 4" />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatX}
          tick={AXIS_TICK}
          stroke="var(--border)"
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          stroke="var(--border)"
          width={56}
          tickFormatter={(value: number, index: number) =>
            index === 0 ? `${value} kg` : String(value)
          }
        />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={
            <ChartTooltip
              series={series}
              formatLabel={formatTooltipLabel}
              formatValue={formatValue}
            />
          }
        />
        <Bar
          dataKey={barKey}
          name={barName}
          fill="var(--chart-1)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface MuscleSlice {
  name: string;
  volumeKg: number;
  share: number;
  color: string;
}

/**
 * Distribuzione per gruppo muscolare: **barre radiali**.
 *
 * Ogni gruppo sta su un raggio diverso, quindi la posizione lo identifica gia' senza il
 * colore; accanto c'e' comunque l'elenco con nome, chili e percentuale (lo rende la
 * pagina), che e' la versione leggibile in ogni condizione.
 */
export function MuscleRadial({
  data,
  ariaLabel,
}: {
  data: readonly MuscleSlice[];
  ariaLabel: string;
}) {
  const reduced = useReducedMotion();
  const max = data.reduce((top, row) => Math.max(top, row.share), 0) || 1;

  return (
    <ResponsiveContainer width="100%" height="100%" className="h-60! md:h-70!">
      <RadialBarChart
        data={data as MuscleSlice[]}
        innerRadius="22%"
        outerRadius="100%"
        startAngle={90}
        endAngle={-270}
        role="img"
        aria-label={ariaLabel}
      >
        <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
        <RadialBar
          dataKey="share"
          background={{ fill: "var(--chart-grid)" }}
          cornerRadius={3}
          isAnimationActive={!reduced}
        >
          {data.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </RadialBar>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
