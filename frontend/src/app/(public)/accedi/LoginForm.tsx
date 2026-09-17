"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/endpoints";
import { isApiError, writeAuth } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    if (!email || !password) {
      setError("Email e password servono tutte e due.");
      document.getElementById(!email ? "email" : "password")?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const pair = await api.auth.login({ email, password });
      writeAuth(pair);
      router.replace(next && next.startsWith("/") ? next : "/oggi");
    } catch (err) {
      if (isApiError(err) && err.status === 401) setError("Email o password non corrispondono.");
      else if (isApiError(err)) setError(err.detail);
      else setError("Errore. Riprova.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack-6">
      {error ? (
        <div className="form-alert" role="alert">
          <p className="t-corpo">Errore: {error}</p>
          {error === "Email o password non corrispondono." ? (
            <Link href="/password/reset" className="btn btn-tertiary">
              Password dimenticata
            </Link>
          ) : null}
        </div>
      ) : null}
      <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" variant="primary" block loading={busy} loadingText="Entro…">
        Entra
      </Button>
      <p className="t-nota muted">
        <Link href="/password/reset">Password dimenticata</Link> · Nuovo qui? <Link href="/registrati">Fai la tua scheda</Link>
      </p>
    </form>
  );
}
