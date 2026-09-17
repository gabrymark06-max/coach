"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Note } from "@/lib/api/types";
import { CLOSE_KEY } from "@/lib/draft/closeKey";
import { NotedText } from "@/components/note/NotedText";
import { Apparatus } from "@/components/note/Apparatus";
import { parseNoted } from "@/lib/notes/parse";

type Payload = { close_line: string | null; notes: Note[]; offline: boolean };

/** Chiusura seduta (§2.2.6): la riga del coach con nota + due scelte pari. Offline: riga generica locale. */
export default function ChiusaPage() {
  const raw = useSyncExternalStore(
    () => () => {},
    () => window.sessionStorage.getItem(CLOSE_KEY),
    () => undefined,
  );
  if (raw === undefined) return null;
  let p: Payload | null = null;
  try {
    p = raw ? (JSON.parse(raw) as Payload) : null;
  } catch {
    p = null;
  }
  // QA M9: l'apparato elenca solo le note che la riga cita davvero, non tutte quelle della seduta.
  const cited = new Set(p?.close_line ? parseNoted(p.close_line).flatMap((seg) => (seg.kind === "note" ? [seg.n] : [])) : []);
  const notes = (p?.notes ?? []).filter((n) => cited.has(n.n));
  return (
    <div className="empty" data-scale="scrivania">
      <p className="t-etichetta muted">Seduta chiusa</p>
      <h1 className="t-titolo">{p?.offline ? "Seduta chiusa." : "Fatta."}</h1>
      <p className="t-voce">
        {p?.close_line ? (
          <NotedText text={p.close_line} notes={p.notes} scope="close" numbers />
        ) : p?.offline ? (
          "Seduta chiusa. Appena torna la rete la mando al coach."
        ) : (
          "La seduta è registrata. Il coach la commenta in chat."
        )}
      </p>
      <div className="pair">
        <Link href="/oggi" className="btn btn-secondary">
          Vai a Oggi
        </Link>
        <Link href="/chat" className="btn btn-secondary">
          Parla col coach
        </Link>
      </div>
      {notes.length > 0 ? <Apparatus notes={notes} scope="close" /> : null}
    </div>
  );
}
