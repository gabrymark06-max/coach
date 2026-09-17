import type { ProgressHistory } from "@/lib/api/types";
import { formatKg } from "@/lib/format";

const W = 640;
const H = 220;
const PAD = { l: 44, r: 16, t: 16, b: 28 };

/** Linea in inchiostro su griglia --rule, un esercizio per grafico, PR con bordo e parola (§2.17). */
export function ExerciseChart({ name, points }: { name: string; points: ProgressHistory["points"] }) {
  const pts = points.filter((p) => p.best_weight_kg != null);
  const ys = pts.map((p) => p.best_weight_kg as number);
  let min = ys.length ? Math.min(...ys) : 0;
  let max = ys.length ? Math.max(...ys) : 0;
  if (min === max) {
    min = Math.max(0, min - 5);
    max = max + 5;
  }
  const x = (i: number) => PAD.l + (pts.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (pts.length - 1));
  const y = (v: number) => PAD.t + ((max - v) * (H - PAD.t - PAD.b)) / (max - min);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.best_weight_kg as number).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const titleId = `chart-${name.replace(/\W+/g, "-")}`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>
        {name}: carico migliore per settimana, in chili
      </title>
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text className="chart-text" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">
            {formatKg(Math.round(t * 2) / 2)}
          </text>
        </g>
      ))}
      <path className="chart-line" d={path} />
      {pts.map((p, i) => (
        <g key={p.date}>
          <circle className="chart-point" data-pr={p.is_pr || undefined} cx={x(i)} cy={y(p.best_weight_kg as number)} r={p.is_pr ? 5 : 3} tabIndex={0} aria-label={`Settimana ${p.week}: ${formatKg(p.best_weight_kg)} chili per ${p.reps}${p.is_pr ? ", record" : ""}`}>
            <title>{`Settimana ${p.week}: ${formatKg(p.best_weight_kg)} kg × ${p.reps}`}</title>
          </circle>
          {p.is_pr ? (
            <text className="chart-text chart-pr" x={x(i)} y={y(p.best_weight_kg as number) - 10} textAnchor="middle">
              PR
            </text>
          ) : null}
          <text className="chart-text" x={x(i)} y={H - 8} textAnchor="middle">
            {p.week}
          </text>
        </g>
      ))}
    </svg>
  );
}
