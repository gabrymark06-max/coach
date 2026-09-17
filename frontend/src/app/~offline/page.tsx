import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Senza rete", robots: { index: false } };

/** Fallback del service worker per le pagine non in cache. */
export default function OfflinePage() {
  return (
    <main id="contenuto" className="container" style={{ padding: "var(--space-12) var(--space-4)" }}>
      <div className="empty">
        <h1 className="t-titolo">Senza rete.</h1>
        <p className="t-voce">Quello che vedi è l&apos;ultima versione che ho. La seduta, se l&apos;avevi aperta, è salvata sul telefono.</p>
        <Link href="/oggi/seduta" className="btn btn-secondary">
          Vai alla seduta
        </Link>
      </div>
    </main>
  );
}
