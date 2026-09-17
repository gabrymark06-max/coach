"use client";

import type { ReactNode } from "react";

type Props = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  help?: string | null;
  variant?: "default" | "wide" | "full" | "rir";
  required?: boolean;
};

/** Pillola di scelta (§2.8): radio nativo nascosto + label visibile. Selezionata = fondo evidenziatore + bordo 2 px + peso 600. */
export function Pill({ name, value, checked, onChange, children, help, variant = "default", required }: Props) {
  const cls = ["pill", variant === "wide" ? "pill-wide" : "", variant === "full" ? "pill-full" : "", variant === "rir" ? "pill-rir" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <label className={cls}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} required={required} />
      <span>{children}</span>
      {help ? <span className="pill-help">{help}</span> : null}
    </label>
  );
}

export function ProPill() {
  return <span className="pill-pro">Pro</span>;
}
