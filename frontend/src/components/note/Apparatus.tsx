"use client";

import type { Note } from "@/lib/api/types";
import { NoteMarkStatic } from "./NoteMark";
import { StudyCard } from "./StudyCard";
import { useNotes } from "./NotesProvider";

/** Apparato (§2.1.4): lista numerata in coda a ogni schermata con ≥ 1 nota. "Apri" è il target 44×44 pieno (D1). */
export function Apparatus({ notes, scope, inline }: { notes: Note[]; scope?: string; inline?: boolean }) {
  const { openNote } = useNotes();
  if (notes.length === 0) return null;
  const hid = `apparato-${scope ?? "page"}`;
  return (
    <section aria-labelledby={hid} role={inline ? "group" : undefined} className={inline ? "apparato-inline" : undefined}>
      <h2 id={hid} className="t-etichetta muted" style={{ marginTop: inline ? "var(--space-4)" : "var(--space-8)" }}>
        Note
      </h2>
      <ol className="apparato">
        {notes.map((n) => (
          <li key={`${n.rule_id}-${n.n}`} id={`nota-${scope ?? "page"}-${n.n}`}>
            <NoteMarkStatic n={n.n} />
            <div>
              <StudyCard note={n} compact />
              <button
                type="button"
                className="btn btn-tertiary"
                aria-label={`Apri la nota ${n.n}: ${n.title_it}`}
                onClick={(e) => openNote(n, `${scope ?? "page"}:app:${n.rule_id}:${n.n}`, e.currentTarget)}
              >
                Apri
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
