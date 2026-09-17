"use client";

import { Fragment, type ReactNode } from "react";
import type { Note } from "@/lib/api/types";
import { parseNoted } from "@/lib/notes/parse";
import { NoteMark } from "./NoteMark";

/** Rende un testo con marcatori [[n]] come apici veri. Se la nota n non è nella risposta, l'apice non si disegna (regola 3). */
export function NotedText({ text, notes, scope, numbers }: { text: string; notes: Note[]; scope?: string; numbers?: boolean }) {
  const segs = parseNoted(text);
  const out: ReactNode[] = [];
  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i]!;
    if (s.kind === "note") {
      const note = notes.find((n) => n.n === s.n);
      if (note) out.push(<NoteMark key={i} note={note} scope={scope} />);
      continue;
    }
    const next = segs[i + 1];
    const nextNote = next && next.kind === "note" ? notes.find((n) => n.n === next.n) : undefined;
    if (nextNote) {
      // l'ultima parola prima dell'apice viaggia con l'apice (mai un apice orfano a capo)
      const m = /^(.*?)(\S+)$/s.exec(s.text);
      if (m) {
        out.push(<Fragment key={i}>{numbers ? withNumbers(m[1]!) : m[1]}</Fragment>);
        out.push(
          <span key={`${i}-nw`} style={{ whiteSpace: "nowrap" }}>
            {numbers ? withNumbers(m[2]!) : m[2]}
            <NoteMark note={nextNote} scope={scope} />
          </span>,
        );
        i += 1;
        continue;
      }
    }
    out.push(<Fragment key={i}>{numbers ? withNumbers(s.text) : s.text}</Fragment>);
  }
  return <>{out}</>;
}

const NUM = /(\d+(?:[,.]\d+)?(?:\s?(?:kg|minuti|min|%|″|′|ripetizioni|rip\.?|serie|secondi|ore))?)/g;

/** I numeri citati dal coach in Archivo 600 tnum (§1.2 .t-voce .num): un fatto, non un'opinione. */
function withNumbers(text: string) {
  const parts = text.split(NUM);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="num">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}
