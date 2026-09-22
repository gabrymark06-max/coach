import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Le impostazioni stanno **fuori dalle cinque tab** (§6.1): sono una destinazione, non
 * una sezione in cui si vive. Non c'e' la bottom nav, quindi c'e' una via d'uscita
 * esplicita — un link vero, non un `history.back()` che dipende da come ci si e'
 * arrivati.
 */
export default function ImpostazioniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <div className="app-container pt-5">
        <Link
          href="/profilo"
          className="press inline-flex h-12 items-center gap-3 rounded-[var(--radius-btn)] px-3 text-base text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Profilo
        </Link>
      </div>
      <main id="contenuto" tabIndex={-1} className="pb-9">
        {children}
      </main>
    </div>
  );
}
