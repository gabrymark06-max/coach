"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { Proposal, ProposalPatch, SessionExercise } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { useIsDesktop } from "@/lib/hooks/useMedia";
import { useEscape, useFocusTrap, useReturnFocus } from "@/lib/hooks/useFocusTrap";
import { Prescription, RirTarget } from "@/components/session/Prescription";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Glyph";
import { Pill } from "@/components/ui/Pill";
import { NoteMark } from "@/components/note/NoteMark";

/** Pannello dettaglio della cella (§2.16): elenco esercizi con apici; in Pro le modifiche passano per le proposte. */
export function SessionPanel({ sessionId, editable, onClose, onChanged }: { sessionId: string; editable: boolean; onClose: () => void; onChanged: () => void }) {
  const desktop = useIsDesktop();
  const { data: s, error, isLoading, mutate } = useSession(sessionId);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [propError, setPropError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveFor, setMoveFor] = useState(false);
  const [substFor, setSubstFor] = useState<SessionExercise | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);

  // QA G8: alla chiusura il focus torna alla cella che ha aperto il pannello. Va dichiarato PRIMA dell'effetto che
  // sposta il focus sul titolo: gli effetti girano in ordine e deve fotografare la cella, non il titolo.
  useReturnFocus();
  useEffect(() => {
    titleRef.current?.focus();
  }, [sessionId]);
  // Esc chiude; sul mobile il foglio è modale (focus dentro).
  useEscape(onClose);
  useFocusTrap(boxRef, !desktop);

  async function propose(patch: ProposalPatch) {
    if (busy) return;
    setBusy(true);
    setPropError(null);
    try {
      const p = await api.plans.propose(patch);
      setProposal(p);
    } catch (e) {
      setPropError(isApiError(e) ? e.detail : "Errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: "apply" | "reject") {
    if (!proposal || busy) return;
    setBusy(true);
    try {
      if (action === "apply") {
        await api.plans.apply(proposal.proposal_id);
        await mutate();
        onChanged();
      } else {
        await api.plans.reject(proposal.proposal_id);
      }
      setProposal(null);
    } catch (e) {
      setPropError(isApiError(e) ? e.detail : "Errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const titleId = "panel-h";
  const body = (
    <>
      <div className="sheet-head">
        <h2 ref={titleRef} tabIndex={-1} id={titleId} className="t-corpo-strong">
          {s ? `${s.name} · ${formatDate(s.date)}` : "Seduta"}
        </h2>
        <button type="button" className="btn btn-tertiary btn-close" onClick={onClose}>
          <Glyph name="close" size={16} /> Chiudi
        </button>
      </div>
      {isLoading ? <Skeleton lines={3} label="Carico la seduta…" /> : null}
      {error ? <ErrorBox error={error} onRetry={() => mutate()} /> : null}
      {s && !editable ? <p className="t-nota muted">Sola lettura. {s.status === "planned" ? "" : `Stato: ${s.status === "done" ? "fatta" : s.status === "short" ? "corta" : "saltata"}.`}</p> : null}
      {s ? (
        <ul style={{ listStyle: "none" }} className="stack-6">
          {s.exercises.map((ex) => (
            <li key={ex.id} className="stack-2">
              <p className="t-corpo-strong">{ex.name_it}</p>
              <p>
                <Prescription p={ex.prescription} notes={s.notes} scope="panel" className="t-numero-riga" />
                <span style={{ display: "block" }}>
                  <RirTarget p={ex.prescription} notes={s.notes} scope="panel" />
                </span>
              </p>
              {editable ? (
                <div className="row">
                  <Button variant="tertiary" onClick={() => setSubstFor(ex)} softDisabled={busy}>
                    Sostituisci
                  </Button>
                  <Button variant="tertiary" onClick={() => propose({ op: "adjust_sets", session_id: s.id, exercise_id: ex.id, delta: -1, scope: "rest_of_block" })} softDisabled={busy}>
                    Serie −
                  </Button>
                  <Button variant="tertiary" onClick={() => propose({ op: "adjust_sets", session_id: s.id, exercise_id: ex.id, delta: 1, scope: "rest_of_block" })} softDisabled={busy}>
                    Serie +
                  </Button>
                </div>
              ) : null}
              {substFor?.id === ex.id ? (
                <div className="pills pills-col">
                  {ex.substitutes.map((alt) => (
                    <Button key={alt.exercise_id} variant="secondary" onClick={() => { setSubstFor(null); void propose({ op: "substitute", session_id: s.id, exercise_id: ex.id, new_exercise_id: alt.exercise_id, scope: "rest_of_block" }); }}>
                      {alt.name_it} <span className="t-nota muted">{alt.why_it}</span>
                    </Button>
                  ))}
                  <Button variant="tertiary" onClick={() => setSubstFor(null)}>
                    Annulla
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {s && editable ? (
        <div style={{ marginTop: "var(--space-6)" }}>
          <Button variant="tertiary" onClick={() => setMoveFor((v) => !v)} aria-expanded={moveFor}>
            Sposta al giorno…
          </Button>
          {moveFor ? (
            <fieldset className="stack-2" style={{ marginTop: "var(--space-2)" }}>
              <legend className="t-nota muted">Di quanti giorni</legend>
              <div className="pills">
                {[-2, -1, 1, 2, 3].map((d) => (
                  <Pill key={d} name="move" value={String(d)} checked={false} onChange={() => { setMoveFor(false); void propose({ op: "move_session", session_id: s.id, new_day_offset: d, scope: "session" }); }}>
                    {d > 0 ? `+${d}` : d}
                  </Pill>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}
      {propError ? (
        <p className="t-corpo" role="alert" style={{ marginTop: "var(--space-4)" }}>
          Errore: {propError}{" "}
          {propError.includes("Pro") ? <Link href="/prezzi?da=maintenance_request">Vedi Pro</Link> : null}
        </p>
      ) : null}
      {proposal ? (
        <section className="pro-card" aria-labelledby="prop-h" style={{ marginTop: "var(--space-6)" }}>
          <h3 id="prop-h" className="t-corpo-strong">
            {proposal.valid ? "Modifica proposta" : "Modifica non valida"}
          </h3>
          {!proposal.valid ? <p className="t-corpo">{proposal.invalid_reason_it}</p> : null}
          {proposal.diff.length > 0 ? (
            <table className="plan-change t-corpo">
              <thead>
                <tr className="t-etichetta muted">
                  <th scope="col">Esercizio</th>
                  <th scope="col">Da</th>
                  <th scope="col">A</th>
                </tr>
              </thead>
              <tbody>
                {proposal.diff.map((d, i) => {
                  const note = d.note_n != null ? proposal.notes.find((n) => n.n === d.note_n) : null;
                  return (
                    <tr key={i}>
                      <th scope="row">
                        {d.exercise} <span className="muted">({d.field})</span>
                      </th>
                      <td className="tnum">{String(d.from ?? "—")}</td>
                      <td className="tnum">
                        {String(d.to ?? "—")}
                        {note ? <NoteMark note={note} scope="proposal" /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
          {proposal.valid ? (
            <div className="pair">
              <Button variant="secondary" onClick={() => decide("apply")} loading={busy} loadingText="Applico…">
                Applica
              </Button>
              <Button variant="secondary" onClick={() => decide("reject")} softDisabled={busy}>
                Lascia com&apos;è
              </Button>
            </div>
          ) : (
            <Button variant="tertiary" onClick={() => setProposal(null)}>
              Chiudi
            </Button>
          )}
        </section>
      ) : null}
    </>
  );

  if (desktop) {
    return (
      <aside className="panel panel-overlay" role="complementary" aria-labelledby={titleId}>
        {body}
      </aside>
    );
  }
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={boxRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {body}
      </div>
    </>
  );
}
