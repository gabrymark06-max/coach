"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `Sheet` — design system §4.16.
 *
 * Regola di piattaforma: **sotto 768px tutto e' bottom sheet**, da 768px in su dialog
 * centrato. Non esistono modali centrati su telefono. Lo stesso componente cambia forma
 * con le media query, cosi' il contenuto non si duplica.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title: string;
    description?: string;
    /** Nasconde il titolo visivamente ma lo lascia allo screen reader. */
    hideTitle?: boolean;
    /**
     * Toglie la `X`. Si usa **solo** dove il foglio deve essere letto e chiuso da un
     * pulsante che dice cosa fa (l'avviso del primo avvio, §5.1). `Esc` continua a
     * funzionare: chiudere deve restare sempre possibile.
     */
    hideClose?: boolean;
  }
>(function SheetContent(
  { className, children, title, description, hideTitle, hideClose, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-overlay=""
        className="fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)]"
      />
      <DialogPrimitive.Content
        ref={ref}
        data-sheet=""
        /**
         * QA MINORE 7. Senza `description` veniva renderizzata una `Description`
         * `sr-only` con **lo stesso testo del titolo**, e all'apertura lo screen reader
         * leggeva «I tuoi dati restano su questo telefono — I tuoi dati restano su
         * questo telefono». Qui si dice a Radix che la descrizione non c'e', invece di
         * inventarne una fantasma per zittire il suo avviso. Con una `description`
         * vera, invece, si lascia fare a Radix: e' lui che conosce l'id.
         */
        {...(description ? null : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-[var(--z-dialog)] flex flex-col",
          "bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--elev-2)]",
          // telefono: foglio dal basso
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-lg)]",
          "border-t border-[var(--border-strong)]",
          "px-5 pt-4 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]",
          // tablet e oltre: dialog centrato
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[480px]",
          "md:max-h-[80dvh] md:-translate-x-1/2 md:-translate-y-1/2",
          "md:rounded-[var(--radius-lg)] md:border md:shadow-[var(--elev-3)] md:p-6",
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--border-strong)] md:hidden"
        />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogPrimitive.Title
              className={cn("text-h3 text-[var(--text-primary)]", hideTitle && "sr-only")}
            >
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Chiudi"
            className="-mr-2 -mt-2 inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </DialogPrimitive.Close>
          )}
        </div>
        <div data-scroll-area="" className="mt-5 min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-col gap-3 md:flex-row md:justify-end", className)}
      {...props}
    />
  );
}
