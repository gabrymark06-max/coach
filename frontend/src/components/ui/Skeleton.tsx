/** Skeleton (§2.13): blocchi --rule senza shimmer, aria-busy e "Carico…" nascosto. Max 3 blocchi. */
export function Skeleton({ lines = 3, title = true, label = "Carico…" }: { lines?: number; title?: boolean; label?: string }) {
  const n = Math.min(lines, 3);
  return (
    <div aria-busy="true" role="status">
      <span className="visually-hidden">{label}</span>
      {title ? <span className="skeleton skeleton-title" /> : null}
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonBig({ label = "Carico…" }: { label?: string }) {
  return (
    <div aria-busy="true" role="status">
      <span className="visually-hidden">{label}</span>
      <span className="skeleton skeleton-big" />
    </div>
  );
}
