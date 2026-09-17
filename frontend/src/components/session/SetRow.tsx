"use client";

import { useEffect, useRef, useState } from "react";
import type { SetOut } from "@/lib/api/types";
import { formatKg } from "@/lib/format";
import { Glyph } from "@/components/ui/Glyph";

export type RowState = "todo" | "active" | "done" | "skipped";

type Props = {
  set: SetOut;
  state: RowState;
  changed: boolean;
  sweepIndex: number;
  error?: string;
  /** Seduta chiusa (QA G2): niente input, niente check, solo il log. */
  readOnly?: boolean;
  onCheck: (weight: number | null, reps: number | null) => void;
  onUncheck: () => void;
  onRestoreSkipped: () => void;
  onRetry?: () => void;
};

/** Un secondo tap sul check entro questa finestra non annulla la serie (QA G3): in palestra il doppio tap è la norma. */
export const UNCHECK_GUARD_MS = 700;

function parseDecimal(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function weightText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : formatKg(v);
}

function repsText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Riga del set (§2.2.2): precedente · peso · rip · check. Stati: todo/active/done/skipped/changed/error. */
export function SetRow({ set, state, changed, sweepIndex, error, readOnly, onCheck, onUncheck, onRestoreSkipped, onRetry }: Props) {
  const logged = set.logged;
  const doneOrSkipped = state === "done" || state === "skipped";
  const loggedWeight = logged?.weight_kg ?? null;
  const loggedReps = logged?.reps ?? null;
  const [weight, setWeight] = useState(() => weightText(loggedWeight ?? set.target.weight_kg));
  const [reps, setReps] = useState(() => repsText(loggedReps ?? set.target.reps));
  const [stamp, setStamp] = useState(false);
  const [sweep, setSweep] = useState<"pending" | "running" | "done">(changed ? "pending" : "done");
  const rowRef = useRef<HTMLDivElement>(null);
  const checkedAt = useRef(0);

  // QA G4: quando il log cambia da fuori (bozza sostituita dal server, sync, altro dispositivo) gli input seguono il log.
  // Confronto con il render precedente (pattern "adjusting state when a prop changes"): mentre l'utente scrive in una
  // riga da fare il log non cambia e il testo resta suo.
  const logKey = logged ? `${loggedWeight ?? ""}|${loggedReps ?? ""}|${logged.done_at ?? ""}` : null;
  const [prevLogKey, setPrevLogKey] = useState(logKey);
  if (logKey !== prevLogKey) {
    setPrevLogKey(logKey);
    if (logKey !== null) {
      setWeight(weightText(loggedWeight ?? set.target.weight_kg));
      setReps(repsText(loggedReps ?? set.target.reps));
    }
  }

  // La passata (§7.3): una volta sola, quando la riga entra nel viewport.
  useEffect(() => {
    if (!changed || sweep !== "pending") return;
    const el = rowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSweep("done");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSweep("running");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [changed, sweep]);

  useEffect(() => {
    if (sweep !== "running") return;
    const t = window.setTimeout(() => setSweep("done"), 700);
    return () => window.clearTimeout(t);
  }, [sweep]);

  const prevLabel = set.previous
    ? `Precedente: ${formatKg(set.previous.weight_kg)} chili per ${set.previous.reps ?? "—"} ripetizioni${set.previous.rir != null ? `, RIR ${set.previous.rir}` : ""}`
    : "Nessun precedente";

  return (
    <div
      ref={rowRef}
      className="set-row"
      role="group"
      aria-label={`Serie ${set.n}`}
      data-state={error ? "error" : state}
      data-changed={changed || undefined}
      data-swept={changed ? (sweep === "done" ? "true" : "false") : undefined}
      data-stamp={stamp || undefined}
      aria-current={state === "active" ? "step" : undefined}
      style={changed ? ({ "--sweep-n": Math.min(sweepIndex, 4) } as React.CSSProperties) : undefined}
      onAnimationEnd={(e) => {
        if (e.animationName === "sweep") setSweep("done");
        if (e.animationName === "stamp") setStamp(false);
      }}
    >
      <span className="set-n t-etichetta" aria-hidden="true">
        {set.n}
      </span>
      <div className="set-prev" aria-label={state === "done" && logged?.rir != null ? `Serie ${set.n} fatta, RIR ${logged.rir}` : prevLabel}>
        {state === "done" && logged?.rir != null ? (
          <span className="t-etichetta">RIR {logged.rir}</span>
        ) : set.previous ? (
          <>
            <span className="t-corpo tnum">
              {formatKg(set.previous.weight_kg)} × {set.previous.reps ?? "—"}
            </span>
            {set.previous.rir != null ? <span className="t-etichetta">RIR {set.previous.rir}</span> : null}
          </>
        ) : (
          <span className="t-corpo">—</span>
        )}
        {changed ? (
          <span className="t-etichetta" style={{ color: "var(--ink)" }}>
            oggi
          </span>
        ) : null}
      </div>
      <div>
        <label className="visually-hidden" htmlFor={`w-${set.id}`}>
          Serie {set.n}, peso in chili
        </label>
        <input
          id={`w-${set.id}`}
          className="set-input"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[,.]?[0-9]*"
          value={weight}
          placeholder={set.target.weight_kg === null ? "kg" : undefined}
          readOnly={doneOrSkipped || readOnly}
          data-muted={state === "skipped" || undefined}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>
      <div>
        <label className="visually-hidden" htmlFor={`r-${set.id}`}>
          Serie {set.n}, ripetizioni
        </label>
        <input
          id={`r-${set.id}`}
          className="set-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={reps}
          readOnly={doneOrSkipped || readOnly}
          data-muted={state === "skipped" || undefined}
          onChange={(e) => setReps(e.target.value)}
        />
      </div>
      {readOnly ? (
        state === "skipped" ? (
          <span className="set-skipped t-etichetta" role="img" aria-label={`Serie ${set.n} saltata`}>
            Saltata
          </span>
        ) : (
          <span className="set-check" role="img" aria-label={state === "done" ? `Serie ${set.n} fatta` : `Serie ${set.n} non fatta`} data-done={state === "done" || undefined}>
            {state === "done" ? <Glyph name="check" /> : null}
          </span>
        )
      ) : state === "skipped" ? (
        <button type="button" className="set-skipped t-etichetta" aria-label={`Serie ${set.n} saltata, ripristina`} onClick={onRestoreSkipped}>
          Saltata
        </button>
      ) : (
        <button
          type="button"
          className="set-check"
          aria-label={`Serie ${set.n} fatta`}
          aria-pressed={state === "done"}
          onClick={() => {
            if (state === "done") {
              // QA G3: il secondo tap di un doppio tap non annulla la serie appena fatta
              if (Date.now() - checkedAt.current < UNCHECK_GUARD_MS) return;
              onUncheck();
            } else {
              checkedAt.current = Date.now();
              setStamp(true);
              onCheck(parseDecimal(weight), parseDecimal(reps) === null ? null : Math.round(parseDecimal(reps)!));
            }
          }}
        >
          <Glyph name="check" />
        </button>
      )}
      {error ? (
        <div className="set-error t-corpo" role="alert">
          {error}{" "}
          {onRetry ? (
            <button type="button" className="btn btn-tertiary" onClick={onRetry}>
              Riprova
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
