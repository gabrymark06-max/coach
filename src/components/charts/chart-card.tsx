"use client";

import { LineChart as LineChartIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `Chart` — §4.10, la parte che **non** costa Recharts.
 *
 * Il contenitore, l'altezza, i chip d'intervallo e i tre stati stanno qui e finiscono
 * nel bundle principale; il grafico vero arriva con `next/dynamic` (vedi `dynamic.tsx`).
 * Lo scheletro ha esattamente l'altezza del grafico e disegna gia' la griglia: quando il
 * dato arriva non si sposta niente (CLS 0).
 */

export const CHART_HEIGHT = "h-60 md:h-70";

export function ChartFrame({
  title,
  titleId,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  titleId: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-h3 text-[var(--text-primary)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Scheletro con la griglia gia' disegnata: nessun salto quando arriva il dato. */
export function ChartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        CHART_HEIGHT,
        "w-full rounded-[var(--radius-sm)] bg-[var(--popover)]",
        "animate-pulse motion-reduce:animate-none",
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, var(--chart-grid) 0 1px, transparent 1px 25%)",
      }}
    />
  );
}

export function ChartEmpty({
  line,
  action,
}: {
  line: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        CHART_HEIGHT,
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-5 text-center",
      )}
    >
      <LineChartIcon
        aria-hidden="true"
        className="size-10 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
      <p className="text-base text-[var(--text-primary)]">
        Non c&apos;è ancora niente da mostrare.
      </p>
      <p className="max-w-80 text-sm text-[var(--text-secondary)]">{line}</p>
      {action}
    </div>
  );
}

/** Un punto solo: si mostra il punto, non una linea inventata (§4.10). */
export function ChartSinglePoint({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div
      className={cn(
        CHART_HEIGHT,
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-5 text-center",
      )}
    >
      <p className="tnum text-display text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="max-w-80 text-sm text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

export function ChartError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        CHART_HEIGHT,
        "flex flex-col items-center justify-center gap-4 rounded-[var(--radius-sm)] border border-[var(--danger)] px-5 text-center",
      )}
    >
      <p className="text-base text-[var(--text-primary)]">
        Impossibile calcolare questo grafico.
      </p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Riprova
        </Button>
      ) : null}
    </div>
  );
}

export interface RangeOption {
  value: string;
  label: string;
  months: number | null;
}

export const RANGE_OPTIONS: RangeOption[] = [
  { value: "1m", label: "1M", months: 1 },
  { value: "3m", label: "3M", months: 3 },
  { value: "6m", label: "6M", months: 6 },
  { value: "1a", label: "1A", months: 12 },
  { value: "tutto", label: "Tutto", months: null },
];

export function monthsForRange(value: string | null): number | null {
  return RANGE_OPTIONS.find((option) => option.value === value)?.months ?? null;
}

/** Chip d'intervallo. Lo stato vive nella query string, non in `useState` (§11.5). */
export function RangeChips({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {RANGE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "press inline-flex h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] px-3 text-label",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
              active
                ? "border border-[var(--accent-blue)] bg-[var(--set-done-surface)] text-[var(--accent-blue)]"
                : "border border-[var(--border-strong)] bg-[var(--card)] text-[var(--text-secondary)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tabella `sr-only` con gli stessi dati del grafico.
 *
 * Un `<svg>` di Recharts non si legge con uno screen reader, e la navigazione a frecce
 * copre l'esplorazione ma non la lettura d'insieme. La tabella e' l'equivalente testuale
 * completo, sempre montata accanto al grafico.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type DotShape = "circle" | "square" | "diamond" | "triangle";

export interface SeriesDef {
  key: string;
  name: string;
  /** sempre un token: `var(--chart-1)`, mai un esadecimale */
  color: string;
  shape: DotShape;
  unit?: string;
}

/**
 * Il glifo di una serie: la stessa forma che il grafico usa per il punto.
 *
 * Vive qui e non nel modulo di Recharts perche' serve anche alle legende fuori dal
 * grafico (l'elenco dei gruppi muscolari), che non devono tirarsi dietro la libreria.
 */
export function SeriesGlyph({ shape, color }: { shape: DotShape; color: string }) {
  return (
    <svg aria-hidden="true" width={12} height={12} viewBox="0 0 12 12" className="shrink-0">
      {shape === "square" ? (
        <rect x={1} y={1} width={10} height={10} fill={color} />
      ) : shape === "diamond" ? (
        <polygon points="6,0 12,6 6,12 0,6" fill={color} />
      ) : shape === "triangle" ? (
        <polygon points="6,0 12,11 0,11" fill={color} />
      ) : (
        <circle cx={6} cy={6} r={5} fill={color} />
      )}
    </svg>
  );
}

/** I sei colori delle serie, nell'ordine consigliato da §1.7, con la loro forma. */
export const CHART_SERIES_STYLES: readonly { color: string; shape: DotShape }[] = [
  { color: "var(--chart-1)", shape: "circle" },
  { color: "var(--chart-2)", shape: "square" },
  { color: "var(--chart-3)", shape: "diamond" },
  { color: "var(--chart-4)", shape: "triangle" },
  { color: "var(--chart-5)", shape: "circle" },
  { color: "var(--chart-6)", shape: "square" },
];
