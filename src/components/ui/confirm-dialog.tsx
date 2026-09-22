"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * Conferma distruttiva — §5.2.
 *
 * Esiste **solo** quando l'azione non e' annullabile con un toast. Il pulsante sicuro e'
 * a sinistra ed e' quello che riceve il focus all'apertura; quello distruttivo dice cosa
 * fa (`Elimina`, `Scarta`, `Sostituisci`), mai `OK`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  cancelLabel = "Annulla",
  confirmLabel,
  onConfirm,
  variant = "destructive",
  extraAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "destructive" | "primary";
  extraAction?: React.ReactNode;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          data-overlay=""
          className="fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)]"
        />
        <AlertDialog.Content
          data-dialog=""
          className={cn(
            "fixed z-[var(--z-dialog)] flex flex-col",
            "bg-[var(--popover)] text-[var(--popover-foreground)]",
            "inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] border-t border-[var(--border-strong)]",
            "px-5 pt-6 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] shadow-[var(--elev-2)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[480px]",
            "md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-lg)]",
            "md:border md:p-6 md:shadow-[var(--elev-3)]",
          )}
        >
          <AlertDialog.Title className="text-h3 text-[var(--text-primary)]">
            {title}
          </AlertDialog.Title>
          {body ? (
            <AlertDialog.Description className="mt-3 text-base text-[var(--text-secondary)]">
              {body}
            </AlertDialog.Description>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" block className="md:w-auto">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {extraAction}
            <AlertDialog.Action asChild>
              <Button variant={variant} block className="md:w-auto" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
