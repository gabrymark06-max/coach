import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pagina non trovata", robots: { index: false, follow: false } };

/** 404 con i landmark della casa (QA M6): un `main#contenuto` per lo skip link, un solo h1, due uscite. */
export default function NotFound() {
  return (
    <main id="contenuto" tabIndex={-1} className="container" style={{ padding: "var(--space-12) var(--space-4)" }}>
      <div className="empty">
        <p className="t-etichetta muted">Errore 404</p>
        <h1 className="t-titolo">Questa pagina non c&apos;è.</h1>
        <p className="t-voce">L&apos;indirizzo è sbagliato o la pagina è stata spostata. La tua scheda, se l&apos;hai, è in Oggi.</p>
        <div className="pair">
          <Link href="/oggi" className="btn btn-secondary">
            Vai a Oggi
          </Link>
          <Link href="/" className="btn btn-secondary">
            Torna alla home
          </Link>
        </div>
      </div>
    </main>
  );
}
