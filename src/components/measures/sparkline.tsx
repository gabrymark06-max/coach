"use client";

/**
 * Sparkline scritta a mano, non con Recharts.
 *
 * Nell'elenco delle misure ce ne sono otto contemporaneamente: caricare una libreria di
 * grafici per otto polilinee da dodici punti sarebbe un chunk da centinaia di KB per un
 * disegno che sta in dodici coordinate. Qui e' un `<svg>` di dieci righe, `aria-hidden`
 * perche' il valore e il delta accanto dicono gia' tutto a parole.
 */
export function Sparkline({
  points,
  className,
}: {
  points: readonly { value: number }[];
  className?: string;
}) {
  if (points.length < 2) return null;

  const width = 96;
  const height = 28;
  const padding = 3;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - padding * 2) / (points.length - 1);

  const path = values
    .map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastX = padding + (values.length - 1) * stepX;
  const lastY =
    height - padding - ((values.at(-1)! - min) / span) * (height - padding * 2);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} />
      <circle cx={lastX} cy={lastY} r={2.5} fill="var(--chart-1)" />
    </svg>
  );
}
