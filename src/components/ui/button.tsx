"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `Button` — design system §4.13.
 *
 * Tre varianti + due dimensioni, raggio `--radius-btn` su tutte. Gli stati hover/active
 * del primario **scuriscono**: qualunque schiarimento farebbe scendere il bianco sotto
 * 4,5:1 (§0).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-[var(--radius-btn)]",
    "font-sans font-semibold select-none",
    "transition-[transform,background-color,color,border-color] duration-[var(--dur-1)] ease-[var(--ease-tap)]",
    "origin-center active:scale-[0.97] motion-reduce:active:scale-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] disabled:bg-[var(--secondary)] disabled:text-[var(--text-disabled)]",
        secondary:
          "bg-[var(--secondary)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]",
        ghost:
          "bg-transparent text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]",
        destructive:
          "bg-[var(--danger-fill)] text-[var(--danger-on-fill)] hover:bg-[var(--danger-hover)] disabled:bg-[var(--secondary)] disabled:text-[var(--text-disabled)]",
      },
      size: {
        md: "h-12 px-6 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "h-12 w-12 px-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mai uno spinner senza parole (§4.13). */
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      loadingLabel,
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-disabled={disabled || loading ? true : undefined}
        aria-busy={loading ? true : undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              aria-hidden="true"
              className="size-5 animate-spin motion-reduce:animate-none"
              strokeWidth={1.75}
            />
            {loadingLabel ?? "Attendi…"}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);

export { buttonVariants };
