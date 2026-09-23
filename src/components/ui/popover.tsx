"use client";

import * as Primitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `Popover` — §4.16.
 *
 * Non e' modale: serve a mostrare due o tre righe accanto a un controllo, non a
 * interrompere. Come il `DropdownMenu`, resta `modal={false}` cosi' non mette
 * `aria-hidden` sul resto della pagina lasciandolo tabulabile (QA MINORE 1).
 */
export const Popover = Primitive.Root;
export const PopoverAnchor = Primitive.Anchor;

export const PopoverTrigger = Primitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(function PopoverContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-[var(--z-dialog)] min-w-56 rounded-[var(--radius-md)] border border-[var(--border-strong)]",
          "bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-[var(--elev-2)]",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
});
