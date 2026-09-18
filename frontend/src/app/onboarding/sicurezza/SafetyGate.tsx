"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useOnboardingSchema } from "@/lib/hooks/useApi";
import { useOnboardingAnswers } from "../store";
import { Progress } from "../Progress";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { NoteMark } from "@/components/note/NoteMark";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import { useSWRConfig } from "swr";
import type { OnboardingIn } from "@/lib/api/types";

/** Gate di sicurezza (§3.2 passo 8): N domande sì/no dal backend, 409 safety_ack_required → testo fisso + [continuo] [Esco]. */
export function SafetyGate() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: schema, error, isLoading, mutate: reload } = useOnboardingSchema();
  const { answers, update } = useOnboardingAnswers();
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  if (isLoading) {
    return (
      <>
        <Progress step={6} />
        <Skeleton lines={3} label="Carico le domande…" />
      </>
    );
  }
  if (error || !schema) return <ErrorBox error={error} onRetry={() => reload()} title="Non riesco a caricare le domande." />;
  const gate = schema.gate;
  const sa = answers.safety_answers ?? {};

  function buildBody(ack: boolean): OnboardingIn | null {
    const a = answers;
    if (!a.goal || !a.level || !a.days_per_week || !a.minutes_per_session || !a.location) return null;
    return {
      goal: a.goal as OnboardingIn["goal"],
      level: a.level as OnboardingIn["level"],
      days_per_week: Number(a.days_per_week),
      minutes_per_session: Number(a.minutes_per_session) as OnboardingIn["minutes_per_session"],
      location: a.location as OnboardingIn["location"],
      equipment: (a.equipment ?? []) as OnboardingIn["equipment"],
      health_consent: Boolean(a.health_consent),
      constraints_text: a.health_consent && a.constraints_text ? a.constraints_text : null,
      safety_answers: sa,
      safety_acknowledged: ack,
    };
  }

  async function submit(ack: boolean) {
    if (inFlight.current) return;
    const body = buildBody(ack);
    if (!body) {
      setSubmitError("Manca una risposta ai passi precedenti.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setSubmitError(null);
    // QA produzione D3: quando si esce verso /onboarding/pronto la guardia resta chiusa — la navigazione non è
    // istantanea e un secondo invio creerebbe un secondo onboarding.
    let leaving = false;
    try {
      const out = await api.onboarding.submit(body);
      update({ result: { first_session_id: out.first_session_id, coach_comment_message_id: out.coach_comment_message_id, safety_notice_it: out.safety_notice_it ?? null } });
      await Promise.all([mutate("/me"), mutate("/today"), mutate("/plans/current"), mutate("/chat/messages")]);
      leaving = true;
      router.replace("/onboarding/pronto");
    } catch (err) {
      if (isApiError(err) && err.code === "safety_ack_required") {
        setBlocking(err.detail || gate.blocking_text_it);
      } else if (isApiError(err) && err.code === "onboarding_locked") {
        setSubmitError(`${err.detail} Vai a Oggi: il piano c'è già.`);
      } else if (isApiError(err)) {
        setSubmitError(err.detail);
      } else {
        setSubmitError("Errore. Riprova.");
      }
    } finally {
      if (!leaving) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = gate.questions.filter((q) => sa[q.id] === undefined).map((q) => q.id);
    setErrors(missing);
    if (missing.length > 0) {
      document.getElementById(`q-${missing[0]}`)?.focus();
      return;
    }
    void submit(false);
  }

  if (blocking) {
    return (
      <div className="stack-6">
        <Progress step={6} />
        <div className="safety-block stack" role="region" aria-label="Avviso di sicurezza">
          <h1 className="t-titolo">Prima di iniziare, senti un medico.</h1>
          <p className="t-voce">{blocking}</p>
        </div>
        <div className="pair">
          <Button variant="secondary" onClick={() => submit(true)} loading={busy} loadingText="Creo la scheda…">
            {gate.acknowledge_label_it}
          </Button>
          <Link href="/" className="btn btn-secondary">
            Esco
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Progress step={6} />
      <h1 className="t-titolo">
        {gate.title_it}
        <NoteMark note={gate.note} scope="gate" />
      </h1>
      <p className="t-voce" style={{ margin: "var(--space-3) 0 var(--space-6)" }}>
        {gate.intro_it}
      </p>
      {errors.length >= 2 ? (
        <div className="form-alert" role="alert" style={{ marginBottom: "var(--space-6)" }}>
          <p className="t-corpo-strong">Manca una risposta a {errors.length} domande.</p>
        </div>
      ) : null}
      {submitError ? (
        <div className="form-alert" role="alert" style={{ marginBottom: "var(--space-6)" }}>
          <p className="t-corpo">Errore: {submitError}</p>
          {submitError.includes("Oggi") ? (
            <Link href="/oggi" className="btn btn-tertiary">
              Vai a Oggi
            </Link>
          ) : null}
        </div>
      ) : null}
      {gate.questions.map((q, i) => (
        <fieldset key={q.id} className="gate-q" id={`q-${q.id}`} tabIndex={-1}>
          <legend className="t-corpo-strong">
            {i + 1}. {q.text_it}
          </legend>
          <div className="pills">
            <Pill name={q.id} value="no" checked={sa[q.id] === false} onChange={() => update({ safety_answers: { ...sa, [q.id]: false } })}>
              No
            </Pill>
            <Pill name={q.id} value="yes" checked={sa[q.id] === true} onChange={() => update({ safety_answers: { ...sa, [q.id]: true } })}>
              Sì
            </Pill>
          </div>
          {errors.includes(q.id) ? <span className="field-error t-corpo">Errore: rispondi sì o no.</span> : null}
        </fieldset>
      ))}
      <p className="t-nota muted" style={{ marginTop: "var(--space-6)" }}>
        {schema.disclaimer_it}
      </p>
      <div className="onb-actions">
        <Link href="/onboarding/5" className="btn btn-tertiary">
          Indietro
        </Link>
        <Button type="submit" variant="primary" loading={busy} loadingText="Creo la scheda…">
          Crea la mia scheda
        </Button>
      </div>
    </form>
  );
}
