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

/** Composer con la riga della quota (§2.4.4). Enter invia su desktop, Shift+Enter a capo. Mentre invia la textarea è
 * readOnly + aria-busy, non disabled: il focus resta lì e chi usa la tastiera continua da dove era (QA M4). */
export function Composer({ onSend, sending, quota, plan, error, keepText }: Props) {
  const [text, setText] = useState(keepText ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 5 * 24 + 16)}px`;
  }, [text]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
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
        <Button type="submit" variant="primary" className="btn-send" loading={sending} loadingText="Invio…">
          Invia
        </Button>
      </div>
      <p className="quota-line t-nota" aria-live="off">
        {q ? q.text : " "}
      </p>
      {error ? (
        <p className="t-nota" role="status">
          {error}
        </p>
      ) : null}
    </form>
  );
}
