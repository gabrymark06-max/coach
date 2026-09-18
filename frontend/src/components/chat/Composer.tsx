"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatQuota } from "@/lib/api/types";
import { quotaLine } from "@/lib/format";
import { Button } from "@/components/ui/Button";

type Props = {
  onSend: (text: string) => void;
  sending: boolean;
  quota?: ChatQuota;
  plan: "free" | "pro";
  error?: string | null;
  keepText?: string;
};

const VUOTO = "Scrivi qualcosa prima di inviare.";

/** Composer con la riga della quota (§2.4.4). Enter invia su desktop, Shift+Enter a capo. Mentre invia la textarea è
 * readOnly + aria-busy, non disabled: il focus resta lì e chi usa la tastiera continua da dove era (QA M4).
 *
 * QA produzione D2: a campo vuoto "Invia" sembrava attivo e non faceva niente. Ora è `aria-disabled` (come ogni altro
 * pulsante inattivo dell'app, §2.4.4 e Button.softDisabled: resta focalizzabile e leggibile, non sparisce dall'ordine
 * di tabulazione) e chi lo preme comunque riceve una risposta: il motivo, annunciato, e il focus nel campo. */
export function Composer({ onSend, sending, quota, plan, error, keepText }: Props) {
  const [text, setText] = useState(keepText ?? "");
  const [hint, setHint] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const empty = text.trim().length === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 5 * 24 + 16)}px`;
  }, [text]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (sending) return;
    const t = text.trim();
    if (!t) {
      setHint(true);
      ref.current?.focus();
      return;
    }
    setHint(false);
    onSend(t);
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 1024px)").matches) {
      e.preventDefault();
      submit();
    }
  }

  const q = quota ? quotaLine(quota, plan) : null;

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <label className="visually-hidden" htmlFor="composer">
          Scrivi al coach
        </label>
        <textarea id="composer" ref={ref} className="t-corpo" rows={1} placeholder="Scrivi al coach" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={2000} readOnly={sending} aria-busy={sending || undefined} />
        <Button type="submit" variant="primary" className="btn-send" loading={sending} loadingText="Invio…" softDisabled={empty}>
          Invia
        </Button>
      </div>
      <p className="quota-line t-nota" aria-live="off">
        {q ? q.text : " "}
      </p>
      {/* QA produzione D6: un invio fallito è un errore, non uno stato: `alert`, così l'annuncio non resta in coda
          dietro la riga della quota. Stesso paragrafo per il motivo del campo vuoto: una sola voce sotto il composer. */}
      {hint && empty ? (
        <p className="t-nota" role="alert">
          {VUOTO}
        </p>
      ) : error ? (
        <p className="t-nota" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
