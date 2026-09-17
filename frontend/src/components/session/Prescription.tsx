"use client";

import type { Note, SessionExercise } from "@/lib/api/types";
import { formatRange, formatRest } from "@/lib/format";
import { NoteMark } from "@/components/note/NoteMark";

function Mark({ n, notes, scope }: { n: number | null | undefined; notes: Note[]; scope?: string }) {
  if (n === null || n === undefined) return null;
  const note = notes.find((x) => x.n === n);
  return note ? <NoteMark note={note} scope={scope} /> : null;
}

/** "3 × 8–12¹ · 2′²" con apici veri (§2.2.1 riga 2). Le note vengono dalla stessa risposta, mai da una seconda chiamata. */
export function Prescription({ p, notes, scope, className = "t-numero-riga" }: { p: SessionExercise["prescription"]; notes: Note[]; scope?: string; className?: string }) {
  return (
    <span className={className}>
      {p.sets.value} × {formatRange(p.reps)}
      <Mark n={p.reps.note_n ?? p.sets.note_n} notes={notes} scope={scope} />
      {" · "}
      {formatRest(p.rest_s.value)}
      <Mark n={p.rest_s.note_n} notes={notes} scope={scope} />
    </span>
  );
}

export function RirTarget({ p, notes, scope, first }: { p: SessionExercise["prescription"]; notes: Note[]; scope?: string; first?: boolean }) {
  const v = p.rir_target.value;
  return (
    <span className="t-corpo muted">
      {first ? `${v} ripetizioni in canna (RIR)` : `${v} in canna`}
      <Mark n={p.rir_target.note_n} notes={notes} scope={scope} />
    </span>
  );
}
