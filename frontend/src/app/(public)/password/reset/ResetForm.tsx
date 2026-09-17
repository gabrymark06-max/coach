"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

/** Senza token: chiede l'email (202 sempre). Con ?token=: nuova password. */
export function ResetForm({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (token) {
      if (password.length < 10) {
        setError("la password deve avere almeno 10 caratteri.");
        return;
      }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("scrivi un indirizzo email valido.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (token) {
        await api.auth.reset(token, password);
        setDone("Password cambiata. Le sessioni aperte sono state chiuse: entra di nuovo.");
      } else {
        const r = await api.auth.forgot(email);
        setDone(r.detail || "Se questa email è registrata, ti ho mandato il link. Vale 24 ore.");
      }
    } catch (err) {
      setError(isApiError(err) ? err.detail : "Errore. Riprova.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="stack">
        <h1 className="t-titolo">{token ? "Fatto." : "Controlla la posta."}</h1>
        <p className="t-voce measure-voice" role="status">
          {done}
        </p>
        <Link href="/accedi" className="btn btn-secondary">
          Accedi
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack-6">
      <h1 className="t-titolo">{token ? "Nuova password." : "Password dimenticata."}</h1>
      {error ? (
        <p className="form-alert t-corpo" role="alert">
          Errore: {error}
        </p>
      ) : null}
      {token ? (
        <Field id="password" label="Nuova password" help="Almeno 10 caratteri." type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      ) : (
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      )}
      <Button type="submit" variant="primary" block loading={busy} loadingText={token ? "Salvo…" : "Mando il link…"}>
        {token ? "Salva la password" : "Mandami il link"}
      </Button>
    </form>
  );
}
