/** Progresso (§2.9): "Passo N di 6" è l'informazione; i segmenti sono aria-hidden. */
export function Progress({ step, total = 6 }: { step: number; total?: number }) {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <p className="t-etichetta muted">
        Passo {step} di {total}
      </p>
      <div className="progress" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} data-done={i < step} />
        ))}
      </div>
    </div>
  );
}
