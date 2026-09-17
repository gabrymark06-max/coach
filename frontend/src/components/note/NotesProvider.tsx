"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Note } from "@/lib/api/types";
import { NoteSheet } from "./NoteSheet";

type OpenNote = { note: Note; key: string; origin: HTMLElement | null };

type Ctx = {
  open: OpenNote | null;
  openNote: (note: Note, key: string, origin: HTMLElement | null) => void;
  close: () => void;
};

const NotesCtx = createContext<Ctx>({ open: null, openNote: () => {}, close: () => {} });

/** Un solo stato "nota aperta" per pagina (§11.4). Il foglio/pannello vive qui, una volta sola. */
export function NotesProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenNote | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const openNote = useCallback((note: Note, key: string, origin: HTMLElement | null) => {
    originRef.current = origin;
    setOpen((cur) => (cur && cur.key === key ? null : { note, key, origin }));
  }, []);

  const close = useCallback(() => {
    setOpen(null);
    const o = originRef.current;
    if (o) requestAnimationFrame(() => o.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const value = useMemo(() => ({ open, openNote, close }), [open, openNote, close]);
  return (
    <NotesCtx.Provider value={value}>
      {children}
      {open ? <NoteSheet note={open.note} onClose={close} /> : null}
    </NotesCtx.Provider>
  );
}

export function useNotes() {
  return useContext(NotesCtx);
}
