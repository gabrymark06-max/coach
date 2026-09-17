"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useConsistency, useMe, useProgressExercises } from "@/lib/hooks/useApi";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Consistency } from "@/components/progress/Consistency";
import { formatDate, formatKg } from "@/lib/format";
import { Apparatus } from "@/components/note/Apparatus";

/** Progressi (§2.17): costanza con forme, elenco esercizi con PR, link ai grafici. */
export default function ProgressiPage() {
  return (
    <Suspense>
      <Progressi />
    </Suspense>
  );
}

function Progressi() {
  const { data: me } = useMe();
  const weeks = Number(useSearchParams().get("settimane")) || 4;
  const cons = useConsistency(weeks);
  const exs = useProgressExercises();
  return (
    <>
      <PageHead title="Progressi" />
      <div className="stack-8" style={{ maxWidth: "var(--measure-ui)" }}>
        <section aria-labelledby="cost-h">
          <h2 id="cost-h" className="visually-hidden">
            Costanza
          </h2>
          {cons.isLoading ? <Skeleton lines={3} label="Carico la costanza…" /> : null}
          {cons.error ? <ErrorBox error={cons.error} onRetry={() => cons.mutate()} title="Non riesco a caricare la costanza." supportEmail={me?.support_email} /> : null}
          {cons.data ? <Consistency data={cons.data} plan={me?.entitlement.plan ?? "free"} weeks={weeks} /> : null}
        </section>
        <section aria-labelledby="ex-h" className="stack">
          <h2 id="ex-h" className="t-corpo-strong">
            Esercizi e record
          </h2>
          {exs.isLoading ? <Skeleton lines={3} title={false} label="Carico gli esercizi…" /> : null}
          {exs.error ? <ErrorBox error={exs.error} onRetry={() => exs.mutate()} /> : null}
          {exs.data && exs.data.length === 0 ? <p className="t-voce">Nessun record ancora. Arrivano da soli quando un carico supera il precedente.</p> : null}
          {exs.data && exs.data.length > 0 ? (
            <table className="data-table t-corpo">
              <caption className="visually-hidden">Esercizi con ultimo carico e record</caption>
              <thead>
                <tr className="t-etichetta muted">
                  <th scope="col">Esercizio</th>
                  <th scope="col">Ultimo carico</th>
                  <th scope="col">Record</th>
                </tr>
              </thead>
              <tbody>
                {exs.data.map((e) => (
                  <tr key={e.exercise_id}>
                    <th scope="row" style={{ fontWeight: 500 }}>
                      <Link href={`/progressi/${encodeURIComponent(e.exercise_id)}`}>{e.name_it}</Link>
                    </th>
                    <td>{e.last_weight_kg != null ? `${formatKg(e.last_weight_kg)} kg` : "—"}</td>
                    <td>
                      {e.pr ? (
                        <>
                          {formatKg(e.pr.weight_kg)} kg × {e.pr.reps} <span className="t-etichetta">PR</span> <span className="muted">{formatDate(e.pr.date)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        {cons.data ? <Apparatus notes={[cons.data.note]} scope="progress" /> : null}
      </div>
    </>
  );
}
