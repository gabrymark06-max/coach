"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { useToday } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { ReadinessIn, ReadinessOut } from "@/lib/api/types";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Apparatus } from "@/components/note/Apparatus";
import { AdaptedSummary, SafetyChoice } from "@/components/session/AdaptedSession";

const Q = [
  { id: "sleep", legend: "Sonno", opts: [["lt6", "Meno di 6 ore"], ["6to8", "6–8 ore"], ["gt8", "Più di 8"]] },
  { id: "mood", legend: "Voglia", opts: [["low", "Poca"], ["mid", "Così così"], ["high", "Tanta"]] },
  { id: "pain", legend: "Dolori", opts: [["none", "No"], ["mild", "Sì, lieve"], ["severe", "Sì, forte"]] },
] as const;

/** Readiness (§2.3): tre domande, pulsante attivo solo a tre risposte, poi la riga del coach e le modifiche a parole. */
export default function ReadinessPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: today, error, isLoading, mutate: reloadToday } = useToday();
  const [answers, setAnswers] = useState<Partial<ReadinessIn>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReadinessOut | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const sessionId = today?.session_preview?.session_id ?? null;

  const complete = Boolean(answers.sleep && answers.mood && answers.pain);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!complete || !sessionId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      const out = await api.sessions.readiness(sessionId, answers as ReadinessIn);
      await mutate(`/sessions/${sessionId}`, out.session, { revalidate: false });
      await mutate("/today");
      setResult(out);
    } catch (err) {
      if (isApiError(err) && err.code === "readiness_already_done") {
        router.replace("/oggi/seduta");
        return;
      }
      setSubmitError(isApiError(err) ? err.detail : "Errore.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div data-scale="palestra" className="readiness-col">
        <Skeleton lines={3} label="Apro la seduta…" />
      </div>
    );
  }
  if (error) return <ErrorBox error={error} onRetry={() => reloadToday()} title="Non riesco a caricare oggi." />;
  if (!sessionId) {
    return (
      <div className="empty">
        <h1 className="t-titolo">Oggi non c&apos;è una seduta da preparare.</h1>
        <Link href="/oggi" className="btn btn-secondary">
          Torna a Oggi
        </Link>
      </div>
    );
  }

  return (
    <div data-scale="palestra" className="readiness-col stack-6">
      <div className="stack-2">
        <h1 className="t-titolo">Come stai oggi?</h1>
        <p className="t-voce">Tre domande, dieci secondi. Il piano di oggi si adatta.</p>
      </div>
      <form onSubmit={onSubmit} className="readiness stack-6" noValidate>
        {Q.map((q) => (
          <fieldset key={q.id} disabled={result !== null}>
            <legend className="t-corpo-strong">{q.legend}</legend>
            <div className="pills">
              {q.opts.map(([v, label]) => (
                <Pill key={v} name={q.id} value={v} variant="wide" checked={answers[q.id] === v} onChange={(val) => setAnswers((a) => ({ ...a, [q.id]: val }))}>
                  {label}
                </Pill>
              ))}
            </div>
          </fieldset>
        ))}
        {!result ? (
          <>
            {submitError ? (
              <div role="alert" className="stack-2">
                <p className="t-corpo">Errore: non sono riuscito ad adattare la seduta. Puoi andare con il piano di oggi così com&apos;è.</p>
                <div className="pair">
                  <Button variant="secondary" onClick={() => onSubmit({ preventDefault() {} } as FormEvent)}>
                    Riprova
                  </Button>
                  <Link href="/oggi/seduta" className="btn btn-secondary">
                    Vai alla seduta
                  </Link>
                </div>
              </div>
            ) : null}
            <Button type="submit" variant="primary" block loading={busy} loadingText="Adatto la seduta…" softDisabled={!complete} aria-label={complete ? undefined : "Vai alla seduta: rispondi alle tre domande"}>
              Vai alla seduta
            </Button>
            <Link href="/oggi/seduta" className="btn btn-tertiary">
              Salta, oggi vado così
            </Link>
          </>
        ) : null}
      </form>

      {result ? <Result result={result} /> : null}
    </div>
  );
}

function Result({ result }: { result: ReadinessOut }) {
  if (result.safety) {
    return (
      <section aria-labelledby="coach-h" className="stack-6">
        <h2 id="coach-h" className="visually-hidden">
          Il coach
        </h2>
        <SafetyChoice safety={result.safety} />
        <Apparatus notes={result.notes} scope="readiness" />
      </section>
    );
  }
  return (
    <AdaptedSummary result={result} scope="readiness">
      <Button href="/oggi/seduta" variant="primary" block>
        Vai alla seduta
      </Button>
    </AdaptedSummary>
  );
}
