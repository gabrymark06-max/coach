"use client";

import * as Popover from "@radix-ui/react-popover";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { formatKgValue, parseDecimal, parseInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `NumberField` — §4.18. Il componente da cui dipende la velocita' di tutta l'app.
 *
 * Decisioni vincolanti implementate qui:
 *  - `type="text"` + `inputMode`, mai `type="number"`: niente spinner da 16px, niente
 *    rotellina che cambia il valore per sbaglio;
 *  - **non controllato** (`defaultValue` + `onBlur`): in sessione ci sono decine di
 *    campi montati, e un re-render a ogni tasto renderebbe l'app inusabile (§11.6);
 *  - selezione totale al focus: si sovrascrive, non si corregge carattere per carattere;
 *  - la virgola vale il punto;
 *  - `Invio` porta al campo successivo **senza chiudere il tastierino**, perche' il
 *    focus si sposta dentro lo stesso gesto dell'utente.
 */

export interface NumberFieldProps {
  value: number | null;
  onCommit: (value: number | null) => void;
  /** placeholder = il valore della serie precedente, leggibile (§4.18) */
  placeholder?: string;
  label: string;
  kind: "decimal" | "integer";
  step: number;
  stepFine?: number;
  className?: string;
  error?: string | null;
  disabled?: boolean;
  /** azione extra nel popover di incremento (es. "Dischi") */
  extraAction?: { label: string; onSelect: () => void };
}

const LONG_PRESS_MS = 450;

export function NumberField({
  value,
  onCommit,
  placeholder,
  label,
  kind,
  step,
  stepFine,
  className,
  error,
  disabled,
  extraAction,
}: NumberFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const errorId = React.useId();

  const display = value == null ? "" : formatKgValue(value);

  // Il campo e' non controllato: quando il valore canonico cambia da fuori (copia dalla
  // serie precedente, incremento dal popover) si riallinea il DOM, non lo stato React.
  React.useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = display;
    }
  }, [display]);

  const commit = (raw: string) => {
    const parsed = kind === "decimal" ? parseDecimal(raw) : parseInteger(raw);
    onCommit(parsed);
  };

  const bump = (delta: number) => {
    const current = value ?? 0;
    const next = Math.round((current + delta) * 100) / 100;
    const clamped = Math.max(0, next);
    if (inputRef.current) inputRef.current.value = formatKgValue(clamped);
    onCommit(clamped);
  };

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <span className="relative block w-full">
          {error ? (
            <AlertCircle
              aria-hidden="true"
              className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-[var(--danger)]"
              strokeWidth={1.75}
            />
          ) : null}
          <input
            ref={inputRef}
            type="text"
            inputMode={kind === "decimal" ? "decimal" : "numeric"}
            pattern={kind === "decimal" ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
            enterKeyHint="next"
            autoComplete="off"
            spellCheck={false}
            defaultValue={display}
            disabled={disabled}
            readOnly={disabled}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder={placeholder}
            data-set-focus=""
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(event.currentTarget.value);
                focusNextField(event.currentTarget);
                return;
              }
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                const unit = event.shiftKey ? step * 4 : step;
                bump(event.key === "ArrowUp" ? unit : -unit);
              }
            }}
            onPointerDown={() => {
              clearTimer();
              timer.current = window.setTimeout(() => setOpen(true), LONG_PRESS_MS);
            }}
            onPointerUp={clearTimer}
            onPointerLeave={clearTimer}
            onContextMenu={(event) => {
              // il tocco lungo su mobile apre il menu contestuale: qui vince il popover
              if (open) event.preventDefault();
            }}
            className={cn(
              "tnum h-12 w-full rounded-[var(--radius-sm)] border bg-[var(--input)]",
              "px-2 text-right text-num-set text-[var(--text-primary)]",
              "placeholder:font-normal placeholder:text-[var(--text-muted)]",
              "focus-visible:border-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
              "disabled:text-[var(--text-disabled)]",
              error ? "border-2 border-[var(--danger)] pl-6" : "border-[var(--border-strong)]",
              className,
            )}
          />
        </span>
      </Popover.Anchor>

      {error ? (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      ) : null}

      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-[var(--z-dialog)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--popover)] p-1 shadow-[var(--elev-2)]"
        >
          <div className="flex items-center gap-1">
            {(stepFine ? [-step, -stepFine, stepFine, step] : [-step, step]).map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => bump(delta)}
                className="inline-flex size-12 items-center justify-center rounded-[var(--radius-sm)] text-num-md text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {delta > 0 ? `+${formatKgValue(delta)}` : formatKgValue(delta)}
              </button>
            ))}
          </div>
          {extraAction ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                extraAction.onSelect();
              }}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] text-base text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              {extraAction.label}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Ordine di focus della riga serie (§8.4): KG → REPS → RPE (solo se attivo) → check →
 * KG della serie successiva. Si naviga il DOM invece di tenere una lista di ref, cosi'
 * l'ordine di tabulazione e quello di `Invio` non possono divergere.
 *
 * **QA GRAVE 4.** Il filtro era su `disabled`, ma a 375px la cella RPE e'
 * `display: none` con dentro un `<select>` abilitato: la catena ci finiva sopra e
 * `.focus()` su un nodo invisibile non fa niente, in silenzio. Il fuoco si fermava su
 * REPS e l'unico shortcut del sistema moriva li'. Adesso si filtra per **visibilita'
 * reale**, che e' la proprieta' che conta: un campo che non si vede non e' un campo.
 */
export function focusNextField(current: HTMLElement): void {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-set-focus]"),
  ).filter(isReachable);
  const index = nodes.indexOf(current);
  if (index === -1) return;
  const next = nodes[index + 1];
  next?.focus();
  if (next instanceof HTMLInputElement) next.select();
}

function isReachable(node: HTMLElement): boolean {
  if (node.hasAttribute("disabled")) return false;
  // `checkVisibility` risponde anche per un antenato con `display:none`, che e'
  // esattamente il caso della cella RPE nascosta dalla media query.
  if (typeof node.checkVisibility === "function") return node.checkVisibility();
  return node.getClientRects().length > 0;
}
