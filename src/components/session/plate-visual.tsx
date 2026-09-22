"use client";

import type { PlateCount } from "@/lib/logic/plates";
import { formatKgValue } from "@/lib/format";

/** Altezza del disco, proporzionale al peso (§6.4). Forma + colore + etichetta. */
const PLATE_HEIGHT: Record<string, number> = {
  "20": 100,
  "15": 88,
  "10": 76,
  "5": 60,
  "2.5": 46,
  "1.25": 36,
};

const PLATE_FILL: Record<string, string> = {
  "20": "var(--plate-20)",
  "15": "var(--plate-15)",
  "10": "var(--plate-10)",
  "5": "var(--plate-5)",
  "2.5": "var(--plate-2_5)",
  "1.25": "var(--plate-1_25)",
};

/** Colore dell'etichetta stampata sul disco: tutti ≥ 4,8:1 (§1.8). */
const PLATE_LABEL: Record<string, string> = {
  "20": "var(--plate-label-light)",
  "15": "var(--plate-label-dark)",
  "10": "var(--plate-label-dark)",
  "5": "var(--plate-label-dark)",
  "2.5": "var(--plate-label-light)",
  "1.25": "var(--plate-label-dark)",
};

const PLATE_WIDTH = 14;
const GAP = 3;
const BAR_START = 8;
const HEIGHT = 120;

const SPOKEN: Record<string, string> = {
  "20": "venti",
  "15": "quindici",
  "10": "dieci",
  "5": "cinque",
  "2.5": "due e mezzo",
  "1.25": "uno e un quarto",
};

/**
 * Resa grafica del bilanciere — §6.4.
 *
 * Si disegna **mezzo bilanciere**, perche' e' quello che si carica. L'SVG e' un solo
 * `role="img"` con la descrizione completa; la legenda testuale sotto e' la vera fonte
 * accessibile, e il peso e' stampato su ogni disco.
 */
export function PlateVisual({
  perSide,
  onRemovePlate,
}: {
  perSide: PlateCount[];
  onRemovePlate?: (kg: number) => void;
}) {
  const flat = perSide.flatMap(({ kg, count }) =>
    Array.from({ length: count }, () => kg),
  );

  const width = 48 + flat.length * (PLATE_WIDTH + GAP) + 24;
  const label =
    flat.length === 0
      ? "Solo il bilanciere, nessun disco."
      : `Per lato: ${perSide
          .map(
            ({ kg, count }) =>
              `${count === 1 ? "un disco" : `${count} dischi`} da ${SPOKEN[String(kg)] ?? formatKgValue(kg)} chili`,
          )
          .join(", ")}.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" data-scroll-area="">
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          className="max-w-full"
        >
          {/* barra */}
          <rect
            x={0}
            y={HEIGHT / 2 - 4}
            width={width}
            height={8}
            rx={2}
            fill="var(--plate-bar)"
          />
          {/* fermo interno */}
          <rect
            x={40}
            y={HEIGHT / 2 - 14}
            width={6}
            height={28}
            rx={2}
            fill="var(--plate-bar)"
          />
          {flat.map((kg, i) => {
            const key = String(kg);
            const height = PLATE_HEIGHT[key] ?? 40;
            const x = BAR_START + 48 + i * (PLATE_WIDTH + GAP);
            const y = (HEIGHT - height) / 2;
            return (
              <g key={`${kg}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={PLATE_WIDTH}
                  height={height}
                  rx={3}
                  fill={PLATE_FILL[key]}
                />
                <text
                  x={x + PLATE_WIDTH / 2}
                  y={HEIGHT / 2}
                  transform={`rotate(-90 ${x + PLATE_WIDTH / 2} ${HEIGHT / 2})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight={700}
                  fontFamily="var(--font-display)"
                  fill={PLATE_LABEL[key]}
                >
                  {formatKgValue(kg)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legenda testuale: la vera fonte accessibile, e i bottoni "ho solo questi" */}
      <ul className="flex flex-wrap gap-2">
        {perSide.map(({ kg, count }) => (
          <li key={kg}>
            <button
              type="button"
              disabled={!onRemovePlate}
              onClick={() => onRemovePlate?.(kg)}
              aria-label={`Rimuovi un disco da ${formatKgValue(kg)} chili`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-[var(--radius-xs)]"
                style={{ backgroundColor: PLATE_FILL[String(kg)] }}
              />
              <span className="tnum">
                {count} × {formatKgValue(kg)} kg
              </span>
            </button>
          </li>
        ))}
        {perSide.length === 0 ? (
          <li className="text-sm text-[var(--text-secondary)]">
            Servono solo i chili del bilanciere.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
