"use client";

import * as Primitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `DropdownMenu` — l'alternativa non gestuale obbligatoria (§4.1, WCAG 2.5.7).
 * Ogni swipe e ogni tocco lungo di questa app ha qui il suo gemello raggiungibile
 * da tastiera.
 */

/**
 * **QA MINORE 1** (`aria-hidden-focus`, axe *serious*). Radix, in modalita' modale,
 * mette `aria-hidden` su tutto il resto della pagina ma **non** lo toglie dall'ordine
 * di tabulazione: lo skip link e la nav restavano raggiungibili con `Tab` mentre uno
 * screen reader non li poteva piu' annunciare. Nove nodi, a 375 e a 1440.
 *
 * Qui il menu e' un'azione breve su una riga, non una modale: `modal={false}` toglie
 * l'`aria-hidden` alla radice del problema invece di rincorrerlo con `inert`. Frecce,
 * `Esc` e la restituzione del fuoco al trigger restano quelle di Radix; in piu' la
 * pagina dietro continua a scorrere, che su un telefono e' un guadagno.
 *
 * I `Sheet` e i `Dialog` restano modali: li' l'`aria-hidden` e' giusto, e infatti su
 * quelli axe non trovava niente.
 */
export function DropdownMenu({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Root>) {
  return <Primitive.Root modal={modal} {...props} />;
}
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-[var(--z-dialog)] min-w-56 overflow-hidden rounded-[var(--radius-md)]",
          "border border-[var(--border-strong)] bg-[var(--popover)] p-1",
          "shadow-[var(--elev-2)] text-[var(--popover-foreground)]",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item> & { destructive?: boolean }
>(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return (
    <Primitive.Item
      ref={ref}
      className={cn(
        "flex h-12 cursor-default select-none items-center gap-3 rounded-[var(--radius-sm)] px-3",
        "text-base outline-none",
        "data-[highlighted]:bg-[var(--surface-hover)]",
        "data-[disabled]:pointer-events-none data-[disabled]:text-[var(--text-disabled)]",
        destructive ? "text-[var(--danger)]" : "text-[var(--text-primary)]",
        "[&_svg]:size-5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof Primitive.Separator>,
  React.ComponentPropsWithoutRef<typeof Primitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <Primitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-[var(--border)]", className)}
      {...props}
    />
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof Primitive.Label>,
  React.ComponentPropsWithoutRef<typeof Primitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <Primitive.Label
      ref={ref}
      className={cn("px-3 py-2 text-label text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
});
