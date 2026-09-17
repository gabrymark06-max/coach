"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMe, useProgressHistory } from "@/lib/hooks/useApi";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { formatDate, formatKg } from "@/lib/format";
import { ExerciseChart } from "@/components/progress/ExerciseChart";

/** Grafico singolo (§2.17): una serie, SVG accessibile, tabella dati in <details>. */
export default function EsercizioPage() {
  const { esercizio } = useParams<{ esercizio: string }>();
  const slug = decodeURIComponent(esercizio);
  const { data: me } = useMe();
  const { data, error, isLoading, mutate } = useProgressHistory(slug);
  return (
    <>
      <PageHead title={data?.name_it ?? "Esercizio"} sub={<Link href="/progressi">Progressi</Link>} />
      <div className="stack-6" style={{ maxWidth: "var(--measure-ui)" }}>
        {isLoading ? <Skeleton lines={3} title={false} label="Carico lo storico…" /> : null}
        {error ? <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare lo storico." supportEmail={me?.support_email} /> : null}
        {data && data.points.length === 0 ? <p className="t-voce">Nessuna serie loggata per questo esercizio.</p> : null}
        {data && data.points.length > 0 ? (
          <>
            <ExerciseChart name={data.name_it} points={data.points} />
            <details className="details">
              <summary className="t-corpo">Vedi i numeri</summary>
              <table className="data-table t-corpo" style={{ marginTop: "var(--space-3)" }}>
                <caption className="visually-hidden">Storico di {data.name_it}</caption>
                <thead>
                  <tr className="t-etichetta muted">
                    <th scope="col">Settimana</th>
                    <th scope="col">Data</th>
                    <th scope="col">Carico</th>
                    <th scope="col">Rip.</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((p) => (
                    <tr key={p.date}>
                      <td>{p.week}</td>
                      <td>{formatDate(p.date)}</td>
                      <td>{p.best_weight_kg != null ? `${formatKg(p.best_weight_kg)} kg` : "—"}</td>
                      <td>{p.reps}</td>
                      <td>{p.is_pr ? "PR" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            {data.history_limited ? <p className="t-nota muted">In Base lo storico si ferma a 8 settimane.</p> : null}
          </>
        ) : null}
      </div>
    </>
  );
}
