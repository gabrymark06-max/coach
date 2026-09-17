"use client";

import { useId } from "react";
import type { Note } from "@/lib/api/types";
import { useNotes } from "./NotesProvider";

/** Apice della nota (§2.1.1, D1): pulsante con nome "Nota N: titolo", hit-box 44×≥32, invertito quando aperto. */
export function NoteMark({ note, scope }: { note: Note; scope?: string }) {
  const { open, openNote } = useNotes();
  const uid = useId();
  const key = `${scope ?? "page"}:${note.rule_id}:${note.n}:${uid}`;
  const isOpen = open?.key === key;
  return (
    <button
      type="button"
      className="nota-apice"
      aria-label={`Nota ${note.n}: ${note.title_it}`}
      aria-expanded={isOpen}
      data-nota={note.n}
      onClick={(e) => openNote(note, key, e.currentTarget)}
    >
      <span className="nota-apice-glyph">{note.n}</span>
    </button>
  );
}

/** Versione non interattiva (apparato). */
export function NoteMarkStatic({ n }: { n: number }) {
  return (
    <span className="nota-apice" aria-hidden="true">
      <span className="nota-apice-glyph">{n}</span>
    </span>
  );
}
