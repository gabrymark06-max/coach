"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOnboardingSchema } from "@/lib/hooks/useApi";
import { useOnboardingAnswers, type OnbAnswers } from "../store";
import { Progress } from "../Progress";
import { Pill } from "@/components/ui/Pill";
import { Checkbox, Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { NoteMark } from "@/components/note/NoteMark";
import type { OnboardingField } from "@/lib/api/types";

/** Passi 1–5 dell'onboarding (§2.9), alimentati da GET /onboarding/schema: nessuna domanda hard-coded. */
export function StepForm({ step }: { step: number }) {
  const router = useRouter();
  const { data: schema, error, isLoading, mutate } = useOnboardingSchema();
  const { answers, update } = useOnboardingAnswers();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <>
        <Progress step={step} />
        <Skeleton lines={3} label="Carico le domande…" />
      </>
    );
  }
  if (error || !schema) return <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare le domande." />;

  const s = schema.steps[step - 1];
  if (!s) return <ErrorBox error={null} title="Questo passo non esiste." />;
  const isLast = step === schema.steps.length;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    for (const f of s!.fields) {
      if (!f.required) continue;
      const v = answers[f.id as keyof OnbAnswers];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) next[f.id] = `${f.label_it}`;
    }
    setErrors(next);
    const firstErr = Object.keys(next)[0];
    if (firstErr) {
      document.getElementById(`f-${firstErr}`)?.focus();
      return;
    }
    router.push(isLast ? "/onboarding/sicurezza" : `/onboarding/${step + 1}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Progress step={step} />
      <h1 className="t-titolo" style={{ marginBottom: "var(--space-6)" }}>
        {s.title_it}
      </h1>
      {Object.keys(errors).length >= 2 ? (
        <div className="form-alert" role="alert" style={{ marginBottom: "var(--space-6)" }}>
          <p className="t-corpo-strong">Manca una risposta:</p>
          <ul style={{ listStyle: "none" }}>
            {Object.entries(errors).map(([id, label]) => (
              <li key={id}>
                <a href={`#f-${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {s.fields.map((f) => (
        <FieldRenderer key={f.id} field={f} answers={answers} update={update} error={errors[f.id]} consent={schema.consent} />
      ))}
      <div className="onb-actions">
        {step > 1 ? (
          <Link href={`/onboarding/${step - 1}`} className="btn btn-tertiary">
            Indietro
          </Link>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary">
          {isLast ? "Avanti: sicurezza" : "Avanti"}
        </Button>
      </div>
    </form>
  );
}

function FieldRenderer({
  field,
  answers,
  update,
  error,
  consent,
}: {
  field: OnboardingField;
  answers: OnbAnswers;
  update: (p: Partial<OnbAnswers>) => void;
  error?: string;
  consent: { label_it: string; text_it: string; note: import("@/lib/api/types").Note };
}) {
  // Passo 5: consenso art. 9 come casella + apice; la textarea compare solo con la casella spuntata (§2.9).
  if (field.id === "health_consent") {
    return (
      <div className="field" id="f-health_consent" tabIndex={-1}>
        <Checkbox id="health_consent" checked={Boolean(answers.health_consent)} onChange={(e) => update({ health_consent: e.target.checked, constraints_text: e.target.checked ? answers.constraints_text : "" })} label={
          <>
            {consent.label_it}
            <NoteMark note={consent.note} scope="onb" />
          </>
        }>
          <span className="t-nota muted" style={{ display: "block" }}>
            {consent.text_it}
          </span>
        </Checkbox>
      </div>
    );
  }
  if (field.id === "constraints_text") {
    if (!answers.health_consent) return null;
    return (
      <Field
        id="f-constraints_text"
        multiline
        label={field.label_it}
        help={field.help_it}
        rows={3}
        value={answers.constraints_text ?? ""}
        onChange={(e) => update({ constraints_text: e.target.value })}
      />
    );
  }
  if (field.type === "text") {
    return (
      <Field id={`f-${field.id}`} multiline label={field.label_it} help={field.help_it} rows={3} value={(answers[field.id as keyof OnbAnswers] as string) ?? ""} onChange={(e) => update({ [field.id]: e.target.value } as Partial<OnbAnswers>)} error={error ? "manca una risposta." : null} />
    );
  }
  if (field.type === "multi") {
    const cur = (answers[field.id as keyof OnbAnswers] as string[] | undefined) ?? [];
    return (
      <fieldset className="field" id={`f-${field.id}`} tabIndex={-1}>
        <legend className="field-label">{field.label_it}</legend>
        {field.help_it ? <span className="field-help t-nota">{field.help_it}</span> : null}
        {field.options?.map((o) => (
          <Checkbox
            key={o.id}
            id={`f-${field.id}-${o.id}`}
            checked={cur.includes(o.id)}
            onChange={(e) => update({ [field.id]: e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id) } as Partial<OnbAnswers>)}
            label={o.label_it}
          />
        ))}
      </fieldset>
    );
  }
  const value = answers[field.id as keyof OnbAnswers] as string | undefined;
  const numeric = field.options?.every((o) => /^\d+\+?$/.test(o.label_it));
  return (
    <fieldset className="field" id={`f-${field.id}`} tabIndex={-1} aria-describedby={error ? `f-${field.id}-err` : undefined}>
      <legend className="field-label">{field.label_it}</legend>
      {field.help_it ? <span className="field-help t-nota">{field.help_it}</span> : null}
      <div className={`pills${numeric ? "" : " pills-col"}`}>
        {field.options?.map((o) => (
          <Pill key={o.id} name={field.id} value={o.id} checked={value === o.id} onChange={(v) => update({ [field.id]: v } as Partial<OnbAnswers>)} variant={numeric ? "default" : "full"} help={o.help_it}>
            {o.label_it}
          </Pill>
        ))}
      </div>
      {error ? (
        <span className="field-error t-corpo" id={`f-${field.id}-err`}>
          Errore: scegli una risposta.
        </span>
      ) : null}
    </fieldset>
  );
}
