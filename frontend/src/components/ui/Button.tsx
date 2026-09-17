"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger";

type Common = {
  variant?: Variant;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
    /** Testo mostrato mentre l'azione è in volo ("Salvo…"). Il pulsante mantiene la larghezza e diventa aria-busy. */
    loading?: boolean;
    loadingText?: string;
    /** aria-disabled: resta leggibile e spiega perché (design-system §2). */
    softDisabled?: boolean;
  };

type LinkProps = Common & { href: string; prefetch?: boolean; target?: string; rel?: string };

function classes(variant: Variant, block: boolean | undefined, className: string | undefined): string {
  return ["btn", `btn-${variant}`, block ? "btn-block" : "", className ?? ""].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps | LinkProps) {
  if ("href" in props && props.href !== undefined) {
    const { href, variant = "primary", block, className, children, prefetch, target, rel } = props;
    return (
      <Link href={href} className={classes(variant, block, className)} prefetch={prefetch} target={target} rel={rel}>
        {children}
      </Link>
    );
  }
  const { variant = "primary", block, className, children, loading, loadingText, softDisabled, onClick, type = "button", ref, ...rest } = props as ButtonProps;
  const busy = Boolean(loading);
  return (
    <button
      ref={ref}
      type={type}
      className={classes(variant, block, className)}
      aria-busy={busy || undefined}
      aria-disabled={busy || softDisabled ? true : undefined}
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {busy && loadingText ? loadingText : children}
    </button>
  );
}
