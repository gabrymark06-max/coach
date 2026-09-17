"use client";

import Link from "next/link";
import { useOnboardingAnswers } from "../store";
import { useChatMessages, useMe, useSession } from "@/lib/hooks/useApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Prescription, RirTarget } from "@/components/session/Prescription";
import { CoachMessage } from "@/components/chat/CoachMessage";
import { Apparatus } from "@/components/note/Apparatus";
import { AiBadge } from "@/components/chat/AiBadge";
import { Button } from "@/components/ui/Button";

/** "La tua scheda è pronta" (§3.1): tabella compatta con apici + il commento del coach → [Vai a Oggi]. */
export function Ready() {
  const { answers, clear } = useOnboardingAnswers();
  const { data: me } = useMe();
  const sessionId = answers.result?.first_session_id ?? null;
  const { data: session, error, isLoading, mutate } = useSession(sessionId);
  const { data: messages } = useChatMessages();
  const comment = messages?.find((m) => m.id === answers.result?.coach_comment_message_id) ?? messages?.find((m) => m.protocol === "plan_comment") ?? null;

  if (!sessionId) {
    // Arrivo diretto senza risultato in sessione: se il piano c'è già, la scheda sta in Oggi.
    return (
      <div className="stack">
        <h1 className="t-titolo">La tua scheda è in Oggi.</h1>
        <p className="t-voce">{me?.onboarding_completed ? "Il piano c'è già: parti da lì." : "Prima rispondi alle domande."}</p>
        <Link href={me?.onboarding_completed ? "/oggi" : "/onboarding/1"} className="btn btn-primary">
          {me?.onboarding_completed ? "Vai a Oggi" : "Inizia"}
        </Link>
      </div>
    );
  }

  return (
    <div className="stack-8">
      <div className="stack">
        <p className="t-etichetta muted">Fatto</p>
        <h1 className="t-titolo">La tua scheda è pronta.</h1>
        {answers.result?.safety_notice_it ? (
          <p className="t-voce safety-block" role="region" aria-label="Avviso di sicurezza">
            {answers.result.safety_notice_it}
          </p>
        ) : null}
      </div>
      {isLoading ? <Skeleton lines={3} label="Carico la scheda…" /> : null}
      {error ? <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare la scheda." /> : null}
      {session ? (
        <section aria-labelledby="scheda-h">
          <h2 id="scheda-h" className="t-corpo-strong" style={{ marginBottom: "var(--space-3)" }}>
            {session.name} · settimana {session.week} · circa {session.est_minutes} minuti
          </h2>
          <div className="scroll-x" tabIndex={0}>
            <table className="sheet-table t-corpo">
              <caption className="visually-hidden">La prima seduta della scheda</caption>
              <thead>
                <tr className="t-etichetta">
                  <th scope="col">Esercizio</th>
                  <th scope="col">Serie × rip · recupero</th>
                  <th scope="col">Quanto vicino al limite</th>
                </tr>
              </thead>
              <tbody>
                {session.exercises.map((ex) => (
                  <tr key={ex.id}>
                    <th scope="row">{ex.name_it}</th>
                    <td>
                      <Prescription p={ex.prescription} notes={session.notes} scope="ready" className="t-numero-riga" />
                    </td>
                    <td>
                      <RirTarget p={ex.prescription} notes={session.notes} scope="ready" first />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section aria-labelledby="coach-h" className="stack">
        <h2 id="coach-h" className="t-corpo-strong">
          Il coach la commenta
        </h2>
        <AiBadge />
        {comment ? (
          <CoachMessage message={comment} />
        ) : messages ? (
          <p className="t-voce">Il coach non ha ancora commentato. Lo trovi nella chat.</p>
        ) : (
          <Skeleton lines={2} title={false} label="Carico il commento…" />
        )}
      </section>
      <div className="pair">
        <Button href="/oggi" variant="primary">
          Vai a Oggi
        </Button>
        <Link href="/chat" className="btn btn-secondary" onClick={() => clear()}>
          Parla col coach
        </Link>
      </div>
      {session ? <Apparatus notes={session.notes} scope="ready" /> : null}
    </div>
  );
}
