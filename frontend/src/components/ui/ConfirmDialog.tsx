"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  loadingText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Dialogo di conferma (§2.12): <dialog> nativo, focus iniziale su Annulla, Esc = Annulla. Solo per azioni distruttive o perdita di dati. */
export function ConfirmDialog({ open, title, children, confirmLabel, destructive, loading, loadingText, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  const titleId = `dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className="t-titolo">
        {title}
      </h2>
      <div className="t-corpo">{children}</div>
      <div className="pair" data-inline="true">
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
          Annulla
        </button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading} loadingText={loadingText}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
