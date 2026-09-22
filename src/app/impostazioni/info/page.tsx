import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { APP_VERSION } from "@/lib/app-version";

export const metadata: Metadata = {
  title: "Informazioni",
  description: "Versione di Lifted, dove stanno i dati e licenze dei componenti usati.",
};

const LICENZE = [
  ["Next.js, React", "MIT"],
  ["Dexie.js", "Apache-2.0"],
  ["Recharts", "MIT"],
  ["Radix UI, dnd kit, lucide-react, sonner", "MIT / ISC"],
  ["Serwist", "MIT"],
  ["Archivo, Public Sans", "SIL Open Font License 1.1"],
] as const;

export default function InfoPage() {
  return (
    <>
      <PageHeader title="Informazioni" />

      <div className="app-container flex flex-col gap-8 pb-8">
        <section aria-labelledby="titolo-dati" className="flex flex-col gap-3">
          <h2 id="titolo-dati" className="text-h2 text-[var(--text-primary)]">
            Dove stanno i tuoi dati
          </h2>
          <p className="text-base text-[var(--text-secondary)]">
            Su questo dispositivo, nel database IndexedDB del browser. Lifted non ha un
            server, non ha account, non manda niente da nessuna parte e non raccoglie
            nessuna statistica d&apos;uso. Questo significa anche che{" "}
            <strong className="text-[var(--text-primary)]">
              se cancelli i dati del sito o cambi telefono, senza un backup perdi tutto
            </strong>
            .
          </p>
          <p className="text-base text-[var(--text-secondary)]">
            <Link
              href="/impostazioni/backup"
              className="text-[var(--accent-blue)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Fai un backup adesso
            </Link>{" "}
            e conservalo dove conservi le cose che non vuoi perdere.
          </p>
        </section>

        <section aria-labelledby="titolo-versione" className="flex flex-col gap-3">
          <h2 id="titolo-versione" className="text-h2 text-[var(--text-primary)]">
            Versione
          </h2>
          <p className="tnum text-base text-[var(--text-secondary)]">
            Lifted <span translate="no">{APP_VERSION}</span> · formato di backup 1
          </p>
        </section>

        <section aria-labelledby="titolo-licenze" className="flex flex-col gap-3">
          <h2 id="titolo-licenze" className="text-h2 text-[var(--text-primary)]">
            Licenze
          </h2>
          <ul className="flex flex-col">
            {LICENZE.map(([nome, licenza]) => (
              <li
                key={nome}
                className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-2"
              >
                <span className="min-w-0 text-base text-[var(--text-primary)]">{nome}</span>
                <span className="text-sm text-[var(--text-secondary)]">{licenza}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
