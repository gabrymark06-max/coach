"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";

export function VerifyEmail({ token }: { token: string | null }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.auth
      .verify(token)
      .then(() => alive && setState("ok"))
      .catch((e: unknown) => {
        if (!alive) return;
        setState("error");
        setDetail(isApiError(e) ? e.detail : "Errore. Riprova.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="stack" role="alert">
        <h1 className="t-titolo">Il link non è completo.</h1>
        <p className="t-voce measure-voice">Apri quello nella email. Da Account puoi farti rimandare il link.</p>
        <Link href="/account" className="btn btn-secondary">
          Vai ad Account
        </Link>
      </div>
    );
  }
  if (state === "loading") return <p className="t-corpo" aria-busy="true">Verifico…</p>;
  if (state === "ok") {
    return (
      <div className="stack">
        <h1 className="t-titolo">Email verificata.</h1>
        <Link href="/oggi" className="btn btn-primary">
          Vai a Oggi
        </Link>
      </div>
    );
  }
  return (
    <div className="stack" role="alert">
      <h1 className="t-titolo">Il link non funziona.</h1>
      <p className="t-voce measure-voice">{detail} Da Account puoi farti rimandare il link.</p>
      <Link href="/account" className="btn btn-secondary">
        Vai ad Account
      </Link>
    </div>
  );
}
