"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { ReadinessOut, Safety } from "@/lib/api/types";
import { describeDiff } from "@/lib/session/describeDiff";
import { NotedText } from "@/components/note/NotedText";
import { Apparatus } from "@/components/note/Apparatus";
import { Button } from "@/components/ui/Button";

/** La seduta adattata a parole (§2.3): riga del coach, elenco modifiche, note. Vale per la readiness e per la versione corta. */
export function AdaptedSummary({ result, scope, duration = true, children }: { result: ReadinessOut; scope: string; duration?: boolean; children?: ReactNode }) {
  return (
    <section aria-labelledby={`${scope}-coach-h`} className="stack-6">
      <h2 id={`${scope}-coach-h`} className="visually-hidden">
        Il coach
      </h2>
      <p className="t-voce">
        <NotedText text={result.coach_line} notes={result.notes} scope={scope} numbers />
      </p>
      <p className="t-corpo">{describeDiff(result, { duration }).join(" · ")}</p>
      {children}
      <Apparatus notes={result.notes} scope={scope} />
    </section>
  );
}

/**
 * Blocco di sicurezza della readiness `severe` (§2.4.5, contratto v1.1 §6): le opzioni arrivano dal backend e si eseguono con
 * POST /chat/options/{id} { message_id }. Una sola scelta per messaggio: la seconda è 409 `option_already_chosen`.
 */
export function SafetyChoice({ safety }: { safety: Safety }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyChosen, setAlreadyChosen] = useState(false);
  const inFlight = useRef(false);

  async function choose(optionId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(optionId);
    setError(null);
    try {
      const reply = await api.chat.option(optionId, safety.message_id);
      await Promise.all([mutate("/today"), mutate("/plans/current"), mutate("/chat/messages")]);
      if (optionId === "continue_anyway") router.push("/oggi/seduta");
      else router.push(`/chat?msg=${reply.id}`);
    } catch (e) {
      if (isApiError(e) && e.code === "option_already_chosen") setAlreadyChosen(true);
      else setError(isApiError(e) ? e.detail : "Errore. Riprova.");
      setBusy(null);
      inFlight.current = false;
    }
  }

  const secondary = safety.options.filter((o) => o.id !== "continue_anyway");
  const tertiary = safety.options.find((o) => o.id === "continue_anyway");

  return (
    <div className="safety-block stack" role="region" aria-label="Avviso di sicurezza">
      <p className="t-voce">{safety.text}</p>
      {alreadyChosen ? (
        <div className="stack-2">
          <p className="t-corpo" role="status">
            Per questo avviso hai già scelto: la risposta del coach è in chat.
          </p>
          <div className="pair">
            <Link href={`/chat?msg=${safety.message_id}`} className="btn btn-secondary">
              Vai alla chat
            </Link>
            <Link href="/oggi" className="btn btn-secondary">
              Torna a Oggi
            </Link>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <p className="t-corpo" role="alert">
              Errore: {error}
            </p>
          ) : null}
          <div className="pair">
            {secondary.map((o) => (
              <Button key={o.id} variant="secondary" loading={busy === o.id} loadingText="Un attimo…" softDisabled={busy !== null && busy !== o.id} onClick={() => choose(o.id)}>
                {o.label}
              </Button>
            ))}
          </div>
          {tertiary ? (
            <Button variant="tertiary" loading={busy === tertiary.id} loadingText="Apro la seduta…" softDisabled={busy !== null && busy !== tertiary.id} onClick={() => choose(tertiary.id)}>
              {tertiary.label}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
