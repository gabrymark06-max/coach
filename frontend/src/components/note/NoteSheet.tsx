"use client";

import { useEffect, useRef } from "react";
import type { Note } from "@/lib/api/types";
import { StudyCard } from "./StudyCard";
import { Glyph } from "@/components/ui/Glyph";
import { useIsDesktop } from "@/lib/hooks/useMedia";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

/** Foglio della nota (§2.1.2): mobile = dialog modale dal basso; desktop = aside non modale a destra. */
export function NoteSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const desktop = useIsDesktop();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [note]);

  // Focus intrappolato solo nella versione modale (mobile); il ritorno del focus all'apice lo fa NotesProvider.
  useFocusTrap(boxRef, !desktop);

  const titleId = "nota-aperta-titolo";
  const head = (
    <div className="sheet-head">
      <h2 ref={titleRef} tabIndex={-1} id={titleId} className="t-etichetta muted">
        Nota {note.n}
      </h2>
      <button type="button" className="btn btn-tertiary btn-close" onClick={onClose}>
        <Glyph name="close" size={16} /> Chiudi
      </button>
    </div>
  );

  if (desktop) {
    return (
      <aside className="panel panel-overlay" role="complementary" aria-labelledby={titleId}>
        {head}
        <StudyCard note={note} />
      </aside>
    );
  }
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={boxRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {head}
        <StudyCard note={note} />
      </div>
    </>
  );
}
