"use client";

import { useEffect, useState } from "react";

/** Skeleton (§2.13): blocchi --rule senza shimmer, aria-busy e l'etichetta di caricamento (§6.1, verbo al presente).
 *
 * QA produzione D1: l'etichetta era `visually-hidden`, quindi chi vede lo schermo restava davanti a barre grigie mute
 * per tutto il risveglio di Render (6,1 s misurati). Ora si vede, ed è nel DOM dal primo paint: nessuno spostamento.
 * Dopo qualche secondo si aggiunge **sotto** le barre una riga che dice perché si aspetta — sotto, così non sposta
 * niente di quello che è già a schermo. Solo sugli scheletri con titolo, che sono il blocco principale di una
 * schermata: due scheletri sulla stessa pagina non ripetono la stessa frase. Max 3 blocchi. */

const WAKE_AFTER_MS = 3500;
const WAKE_TEXT = "Sto svegliando il server: ci vuole qualche secondo.";

function useWaited(enabled: boolean): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => setWaited(true), WAKE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [enabled]);
  return waited;
}

function WakeLine({ show }: { show: boolean }) {
  return show ? <span className="skeleton-label skeleton-wake t-nota muted">{WAKE_TEXT}</span> : null;
}

export function Skeleton({ lines = 3, title = true, label = "Carico…" }: { lines?: number; title?: boolean; label?: string }) {
  const n = Math.min(lines, 3);
  const waited = useWaited(title);
  return (
    <div aria-busy="true" role="status">
      <span className="skeleton-label t-nota muted">{label}</span>
      {title ? <span className="skeleton skeleton-title" /> : null}
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
      ))}
      <WakeLine show={waited} />
    </div>
  );
}

export function SkeletonBig({ label = "Carico…" }: { label?: string }) {
  const waited = useWaited(true);
  return (
    <div aria-busy="true" role="status">
      <span className="skeleton-label t-nota muted">{label}</span>
      <span className="skeleton skeleton-big" />
      <WakeLine show={waited} />
    </div>
  );
}
