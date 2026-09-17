"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/endpoints";
import { isApiError, writeAuth } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field } from "@/components/ui/Field";

type Errors = { email?: string; password?: string; terms?: string; form?: string };

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // doppio click: una sola registrazione
    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "scrivi un indirizzo email valido.";
    if (password.length < 10) next.password = "la password deve avere almeno 10 caratteri.";
    if (!terms) next.terms = "per registrarti devi accettare Termini e Privacy.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = next.email ? "email" : next.password ? "password" : "terms";
      document.getElementById(first)?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const pair = await api.auth.register({ email, password, accept_terms: true });
      writeAuth(pair);
      router.replace("/onboarding/1");
    } catch (err) {
      if (isApiError(err) && err.code === "email_taken") setErrors({ email: "questa email è già registrata." });
      else if (isApiError(err) && err.status === 422) setErrors({ form: err.detail });
      else if (isApiError(err)) setErrors({ form: err.detail });
      else setErrors({ form: "Errore. Riprova." });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const errCount = Object.keys(errors).filter((k) => k !== "form").length;

  return (
    <form onSubmit={onSubmit} noValidate className="stack-6">
      {errCount >= 2 ? (
        <div className="form-alert" role="alert">
          <p className="t-corpo-strong">Manca qualcosa:</p>
          <ul style={{ listStyle: "none" }}>
            {errors.email ? (
              <li>
                <a href="#email">Email</a>
              </li>
            ) : null}
            {errors.password ? (
              <li>
                <a href="#password">Password</a>
              </li>
            ) : null}
            {errors.terms ? (
              <li>
                <a href="#terms">Termini e Privacy</a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {errors.form ? (
        <p className="form-alert t-corpo" role="alert">
          Errore: {errors.form}
        </p>
      ) : null}
      <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Field
        id="password"
        label="Password"
        help="Almeno 10 caratteri."
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <div>
        <Checkbox id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={errors.terms ? true : undefined} aria-describedby={errors.terms ? "terms-err" : undefined} label={
          <>
            Accetto i <Link href="/termini">Termini</Link> e la <Link href="/privacy">Privacy</Link>
          </>
        } />
        {errors.terms ? (
          <span className="field-error t-corpo" id="terms-err">
            Errore: {errors.terms}
          </span>
        ) : null}
      </div>
      <Button type="submit" variant="primary" block loading={busy} loadingText="Creo l'account…">
        Crea l&apos;account
      </Button>
      <p className="t-nota muted">
        Hai già un account? <Link href="/accedi">Accedi</Link>
      </p>
      {errors.email === "questa email è già registrata." ? (
        <p className="t-corpo">
          <Link href="/accedi">Accedi</Link> con questa email.
        </p>
      ) : null}
    </form>
  );
}
