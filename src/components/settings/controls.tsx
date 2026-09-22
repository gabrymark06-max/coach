"use client";

import { HardDrive } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * I controlli delle Impostazioni.
 *
 * Righe da 56px, label a sinistra sempre visibile, controllo a destra. Ogni controllo ha
 * il bordo `--border-strong` (3:1, WCAG 1.4.11) e un testo di aiuto quando la scelta ha
 * una conseguenza che non si vede dal nome.
 */

export function SettingsSection({
  title,
  id,
  description,
  children,
}: {
  title: string;
  id: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-h2 text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-5 shadow-[var(--elev-1)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  htmlFor,
  hint,
  control,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={htmlFor}
          className="block text-base font-semibold text-[var(--text-primary)]"
        >
          {label}
        </label>
        {hint ? <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export const selectClass =
  "h-12 min-w-28 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-base text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";

export const numberClass =
  "tnum h-12 w-24 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-right text-num-md text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";

/**
 * Interruttore. Non e' un `role="switch"` fatto a mano: e' una `checkbox` vera dentro la
 * sua `<label>`, cosi' il bersaglio e' unico e non c'e' zona morta (§11.8). Lo stato
 * acceso si vede dalla posizione **e** dal bordo, non solo dal colore.
 */
export function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  // Niente `htmlFor` su questa label: la casella e' **dentro**, quindi l'associazione e'
  // gia' implicita. Metterlo anche esplicito fa arrivare due click allo stesso input —
  // quello vero e quello inoltrato dalla label — e l'interruttore torna dov'era.
  //
  // Lo stato mostrato e' **ottimistico** (§9.3): l'interruttore si sposta nel momento in
  // cui lo tocchi, non quando Dexie ha finito di scrivere. Se la scrittura fallisce, il
  // valore vero torna dal contesto e l'interruttore lo segue.
  const [mostrato, setMostrato] = React.useState(checked);
  const [ultimo, setUltimo] = React.useState(checked);
  if (ultimo !== checked) {
    setUltimo(checked);
    setMostrato(checked);
  }

  return (
    <label className="relative inline-flex h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-1">
      <span className="sr-only">{label}</span>
      {/*
        La casella non e' `sr-only`: e' trasparente e **copre tutto il controllo**.
        Nascosta in un angolo da un pixel, il bersaglio vero diventerebbe la grafica
        accanto — che non e' cliccabile — e il tocco finirebbe nel vuoto.
      */}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={mostrato}
        onChange={(event) => {
          setMostrato(event.target.checked);
          onChange(event.target.checked);
        }}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative inline-flex h-7 w-12 items-center rounded-[var(--radius-full)] border-2 transition-colors duration-[var(--dur-1)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]",
          mostrato
            ? "border-[var(--accent-blue)] bg-[var(--set-done-surface)]"
            : "border-[var(--border-strong)] bg-[var(--input)]",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-[var(--radius-full)] transition-transform duration-[var(--dur-1)] ease-[var(--ease-out)] motion-reduce:transition-none",
            mostrato
              ? "translate-x-6 bg-[var(--accent-blue)]"
              : "translate-x-0.5 bg-[var(--text-secondary)]",
          )}
        />
      </span>
      <span className="pointer-events-none w-8 text-sm text-[var(--text-secondary)]">
        {mostrato ? "Sì" : "No"}
      </span>
    </label>
  );
}

/**
 * L'avviso di §5.1, secondo punto: banner permanente in Impostazioni → Backup.
 * L'icona e la parola portano il senso; l'ambra e' rinforzo.
 */
export function LocalDataBanner({
  lastExportAt,
  action,
}: {
  lastExportAt: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-[var(--radius-md)] border border-[var(--pr-border)] bg-[var(--pr-surface)] p-5">
      <HardDrive
        aria-hidden="true"
        className="size-6 shrink-0 text-[var(--pr)]"
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <p className="text-base text-[var(--text-primary)]">
          Ultimo backup: <strong className="text-[var(--pr)]">{lastExportAt ?? "mai"}</strong>.
          I dati sono solo su questo dispositivo.
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Se cancelli i dati del sito o cambi telefono, senza un backup perdi tutto.
        </p>
      </div>
      {action}
    </div>
  );
}
