"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Note, SessionExercise } from "@/lib/api/types";
import { Prescription, RirTarget } from "./Prescription";
import { SetRow, type RowState } from "./SetRow";
import { StudyCard } from "@/components/note/StudyCard";
import { NoteMarkStatic } from "@/components/note/NoteMark";
import { Glyph } from "@/components/ui/Glyph";
import { Button } from "@/components/ui/Button";
import { isApiError } from "@/lib/api/client";
import { useIsDesktop } from "@/lib/hooks/useMedia";
import { useEscape, useFocusTrap, useReturnFocus } from "@/lib/hooks/useFocusTrap";

type Props = {
  exercise: SessionExercise;
  notes: Note[];
  firstRir: boolean;
  rowErrors: Record<string, string>;
  /** Seduta chiusa (QA G2): righe e note in sola lettura, nessuna azione. */
  readOnly?: boolean;
  onCheck: (setId: string, weight: number | null, reps: number | null) => void;
  onUncheck: (setId: string) => void;
  onRestoreSet: (setId: string) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
  onSkip: () => void;
  onRestore: () => void;
  onSubstitute: (slug: string) => Promise<void>;
  onRetryRow: () => void;
};

/** Blocco esercizio (§2.2.1–2.2.5): intestazione + sticky, righe, azioni a parole, riga "Note". */
export function ExerciseBlock(p: Props) {
  const ex = p.exercise;
  const notes = p.notes;
  const [howOpen, setHowOpen] = useState(false);
  const [substOpen, setSubstOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [substError, setSubstError] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const substOpener = useRef<HTMLButtonElement>(null);
  const hid = `ex-${ex.id}`;
  const done = ex.sets.filter((s) => s.logged?.status === "done").length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(Boolean(e && !e.isIntersecting && e.boundingClientRect.top < 0)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rows = computeRows(ex);

  if (ex.removed_today) {
    return (
      <section className="exercise exercise-removed" aria-labelledby={hid}>
        <p>
          <span id={hid} className="t-corpo-strong">
            {ex.name_it}
          </span>{" "}
          <span className="t-etichetta muted">— tolto oggi</span>
          {ex.removed_reason_it ? <span className="t-nota muted" style={{ display: "block" }}>{ex.removed_reason_it}</span> : null}
        </p>
        {p.readOnly ? null : (
          <Button variant="tertiary" onClick={p.onRestore}>
            Rimettilo
          </Button>
        )}
      </section>
    );
  }

  const noteNs = new Set<number>();
  for (const n of ex.notes) noteNs.add(n.n);
  const nList = [...noteNs].sort((a, b) => a - b);
  const notesLabel = nList.length === 0 ? null : nList.length === 1 ? `Nota ${nList[0]}` : `Note ${nList[0]}–${nList[nList.length - 1]}`;

  return (
    <section className="exercise" aria-labelledby={hid}>
      <div ref={sentinel} aria-hidden="true" />
      {stuck ? (
        <div className="exercise-sticky" aria-hidden="true">
          <span className="t-corpo-strong">{ex.name_it}</span>
          <span className="t-corpo muted">
            serie {Math.min(done + 1, ex.sets.length)} di {ex.sets.length}
          </span>
        </div>
      ) : null}
      <div className="exercise-head">
        <h2 id={hid} className="t-titolo">
          {ex.name_it}
        </h2>
        {ex.instructions_it.length > 0 ? (
          <button type="button" className="btn btn-tertiary" aria-expanded={howOpen} aria-controls={`how-${ex.id}`} onClick={() => setHowOpen((v) => !v)}>
            Come si fa <Glyph name="chevron" size={16} />
          </button>
        ) : null}
      </div>
      <div className="prescription">
        <Prescription p={ex.prescription} notes={notes} scope="session" />
        <RirTarget p={ex.prescription} notes={notes} scope="session" first={p.firstRir} />
      </div>
      {ex.substituted_from ? <p className="t-etichetta muted" style={{ marginTop: "var(--space-2)" }}>Sostituito: era {ex.substituted_from.name_it}</p> : null}
      {ex.changed_today ? <p className="tag-changed t-etichetta">Oggi: {ex.changed_today.label_it}</p> : null}
      {howOpen ? (
        <div id={`how-${ex.id}`} className="stack-2" style={{ margin: "var(--space-3) 0" }}>
          <p className="t-etichetta muted">Come si fa</p>
          <ol className="t-corpo" style={{ paddingLeft: "var(--space-5)" }}>
            {ex.instructions_it.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {ex.media.attribution ? <p className="t-nota muted">{ex.media.attribution}</p> : null}
        </div>
      ) : null}

      <div role="group" aria-label={`Serie di ${ex.name_it}`} style={{ marginTop: "var(--space-3)" }}>
        <div>
          {rows.map(({ set, state }, i) => (
            <SetRow
              key={set.id}
              set={set}
              state={p.readOnly && state === "active" ? "todo" : state}
              changed={Boolean(ex.changed_today)}
              sweepIndex={i}
              error={p.rowErrors[set.id] || undefined}
              readOnly={p.readOnly}
              onCheck={(w, r) => p.onCheck(set.id, w, r)}
              onUncheck={() => p.onUncheck(set.id)}
              onRestoreSkipped={() => p.onRestoreSet(set.id)}
              onRetry={p.onRetryRow}
            />
          ))}
        </div>
      </div>

      {p.readOnly ? null : (
        <div className="exercise-actions">
          <Button variant="tertiary" onClick={p.onAddSet}>
            Aggiungi serie
          </Button>
          {ex.sets.length > 1 ? (
            <Button variant="tertiary" onClick={p.onRemoveLastSet}>
              Togli l&apos;ultima
            </Button>
          ) : null}
        </div>
      )}
      <div className="exercise-actions">
        {!p.readOnly && ex.substitutes.length > 0 ? (
          <Button variant="tertiary" ref={substOpener} onClick={() => setSubstOpen(true)} aria-expanded={substOpen}>
            Sostituisci
          </Button>
        ) : null}
        {p.readOnly ? (
          ex.skipped ? <p className="t-etichetta muted">Saltato</p> : null
        ) : (
          <Button variant="tertiary" onClick={ex.skipped ? p.onRestore : p.onSkip}>
            {ex.skipped ? "Ripristina" : "Salta esercizio"}
          </Button>
        )}
        {notesLabel ? (
          <Button variant="tertiary" aria-expanded={notesOpen} aria-controls={`notes-${ex.id}`} onClick={() => setNotesOpen((v) => !v)}>
            {notesLabel}
          </Button>
        ) : null}
      </div>
      {notesOpen ? (
        <div id={`notes-${ex.id}`} className="notes-row">
          <ol className="apparato">
            {ex.notes.map((n) => (
              <li key={n.n}>
                <NoteMarkStatic n={n.n} />
                <StudyCard note={n} compact />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {substError ? (
        <p className="t-corpo" role="alert">
          Errore: {substError}
        </p>
      ) : null}
      {substOpen ? (
        <SubstituteSheet
          exercise={ex}
          returnTo={substOpener}
          onClose={() => setSubstOpen(false)}
          onPick={async (slug) => {
            setSubstError(null);
            try {
              await p.onSubstitute(slug);
              setSubstOpen(false);
            } catch (e) {
              setSubstError(isApiError(e) ? (e.status === 0 ? "senza rete non posso sostituire: riprova quando torna." : e.detail) : "Riprova.");
            }
          }}
        />
      ) : null}
    </section>
  );
}

/** Stato di ogni riga: done/skipped dal log; "active" è la prima da fare se la precedente è fatta (o è la prima). */
function computeRows(ex: SessionExercise): { set: SessionExercise["sets"][number]; state: RowState }[] {
  const out: { set: SessionExercise["sets"][number]; state: RowState }[] = [];
  let activeAssigned = false;
  for (let i = 0; i < ex.sets.length; i += 1) {
    const s = ex.sets[i]!;
    const st = s.logged?.status;
    let state: RowState = "todo";
    if (st === "done") state = "done";
    else if (st === "skipped") state = "skipped";
    else if (!activeAssigned && !ex.skipped) {
      const prev = out[i - 1];
      if (!prev || prev.state === "done") state = "active";
      activeAssigned = true;
    }
    out.push({ set: s, state });
  }
  return out;
}

/** Sostituisci in due tocchi (§2.2.3): foglio con ≤ 5 alternative dal backend. Sul mobile è modale: focus intrappolato e
 * restituito a "Sostituisci" alla chiusura (QA G8, §5.3). */
function SubstituteSheet({ exercise, returnTo, onClose, onPick }: { exercise: SessionExercise; returnTo: RefObject<HTMLElement | null>; onClose: () => void; onPick: (slug: string) => Promise<void> }) {
  const desktop = useIsDesktop();
  const [busy, setBusy] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEscape(onClose);
  useFocusTrap(boxRef, !desktop);
  useReturnFocus(returnTo);
  const body = (
    <>
      <div className="sheet-head">
        <h2 ref={titleRef} tabIndex={-1} className="t-corpo-strong">
          Sostituisci {exercise.name_it}
        </h2>
        <button type="button" className="btn btn-tertiary btn-close" onClick={onClose}>
          <Glyph name="close" size={16} /> Chiudi
        </button>
      </div>
      <ul className="subst-list">
        {exercise.substitutes.slice(0, 5).map((s) => (
          <li key={s.exercise_id}>
            <button
              type="button"
              aria-busy={busy === s.exercise_id || undefined}
              onClick={async () => {
                if (busy) return;
                setBusy(s.exercise_id);
                try {
                  await onPick(s.exercise_id);
                } finally {
                  setBusy(null);
                }
              }}
            >
              <span className="t-corpo-strong">{busy === s.exercise_id ? "Sostituisco…" : s.name_it}</span>
              <span className="t-nota muted">{s.why_it}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
  if (desktop) {
    return (
      <aside className="panel panel-overlay" role="complementary" aria-label={`Sostituisci ${exercise.name_it}`}>
        {body}
      </aside>
    );
  }
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={boxRef} className="sheet" role="dialog" aria-modal="true" aria-label={`Sostituisci ${exercise.name_it}`}>
        {body}
      </div>
    </>
  );
}
