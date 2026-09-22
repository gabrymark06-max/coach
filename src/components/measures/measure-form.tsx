"use client";

import { AlertCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import {
  METRIC_LABEL,
  METRIC_RANGE,
  METRIC_UNIT,
  type MeasurementEntry,
  type MetricKey,
} from "@/lib/db/schema";
import { formatKgValue, parseDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `MeasureForm` — §4.9.
 *
 * Tre regole del contratto di accessibilita' applicate alla lettera:
 *  - **label sempre visibile**, mai un placeholder al posto suo (§8.8);
 *  - **validazione on blur**, non a ogni tasto; l'errore sta accanto al campo con
 *    `aria-invalid` + `aria-describedby`, e porta un'icona oltre al rosso (§8.2);
 *  - il `Salva` **resta abilitato** anche con il form non valido (§11.8): si preme, si
 *    valida tutto, e il focus va sul riepilogo degli errori. Un pulsante spento non
 *    dice perche' lo e'.
 *
 * Il placeholder del campo mostra l'**ultimo valore registrato**: un esempio vero, non
 * un'istruzione travestita da label.
 */

function toDateInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string, original?: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  // Si tiene l'ora della voce originale, se c'e': modificare la data non deve spostare
  // una misura delle 7 del mattino a mezzanotte.
  const base = original ? new Date(original) : new Date();
  return new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
  ).toISOString();
}

export function MeasureForm({
  open,
  onOpenChange,
  metric,
  entry,
  lastValue,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricKey;
  /** presente in modifica, assente in inserimento */
  entry?: MeasurementEntry | null;
  lastValue?: number | null;
  onSubmit: (input: { value: number; date: string; note: string }) => Promise<void>;
  onDelete?: () => void;
}) {
  const unit = METRIC_UNIT[metric];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={entry ? `Modifica ${METRIC_LABEL[metric]}` : METRIC_LABEL[metric]}
        description={
          entry
            ? "Cambia valore, data o nota di questa misurazione."
            : `Registra una nuova misurazione in ${unit}.`
        }
      >
        {/*
          Il corpo del form monta e smonta insieme al foglio: i campi ripartono dai valori
          giusti a ogni apertura senza un effetto che li reimposti.
        */}
        <MeasureFields
          metric={metric}
          entry={entry ?? null}
          lastValue={lastValue ?? null}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function MeasureFields({
  metric,
  entry,
  lastValue,
  onSubmit,
  onDelete,
  onDone,
}: {
  metric: MetricKey;
  entry: MeasurementEntry | null;
  lastValue: number | null;
  onSubmit: (input: { value: number; date: string; note: string }) => Promise<void>;
  onDelete?: () => void;
  onDone: () => void;
}) {
  const unit = METRIC_UNIT[metric];
  const range = METRIC_RANGE[metric];

  const [value, setValue] = React.useState(() =>
    entry ? formatKgValue(entry.value) : "",
  );
  const [date, setDate] = React.useState(() =>
    toDateInput(entry?.date ?? new Date().toISOString()),
  );
  const [note, setNote] = React.useState(() => entry?.note ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const summaryRef = React.useRef<HTMLDivElement | null>(null);

  const validate = React.useCallback(
    (fields: { value: string; date: string }) => {
      const next: Record<string, string> = {};
      const parsed = parseDecimal(fields.value);
      if (parsed === null) {
        next.value = `Inserisci un valore in ${unit}.`;
      } else if (parsed < range.min || parsed > range.max) {
        next.value = `Inserisci un valore tra ${range.min} e ${range.max} ${unit}.`;
      }
      const iso = fromDateInput(fields.date, entry?.date);
      const stamp = iso === "" ? Number.NaN : Date.parse(iso);
      if (Number.isNaN(stamp)) next.date = "Scegli una data valida.";
      else if (stamp > Date.now() + 60_000) {
        next.date = "Non puoi registrare una misura nel futuro.";
      }
      return next;
    },
    [entry?.date, range.max, range.min, unit],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const found = validate({ value, date });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Il focus va sul riepilogo, non sul primo campo: cosi' si sente **quanti** errori
      // ci sono, non solo il primo (§4.9).
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        value: parseDecimal(value) as number,
        date: fromDateInput(date, entry?.date),
        note,
      });
      onDone();
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Non riesco a salvare la misura.",
      });
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };

  const errorList = Object.entries(errors);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {errorList.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--danger)] p-4"
        >
          <p className="flex items-center gap-2 text-base text-[var(--text-primary)]">
            <AlertCircle
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--danger)]"
              strokeWidth={1.75}
            />
            {errorList.length === 1
              ? "C'è un errore da correggere."
              : `Ci sono ${errorList.length} errori da correggere.`}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {errorList.map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#misura-${field}`}
                  className="text-sm text-[var(--accent-blue)] underline"
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field
        id="misura-value"
        label={`${METRIC_LABEL[metric]} (${unit})`}
        error={errors.value}
      >
        <input
          id="misura-value"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() =>
            setErrors((current) => revalidate(current, validate({ value, date }), "value"))
          }
          placeholder={
            lastValue != null ? `ultima: ${formatKgValue(lastValue)} ${unit}` : `0 ${unit}`
          }
          aria-invalid={errors.value ? true : undefined}
          aria-describedby={errors.value ? "misura-value-errore" : undefined}
          className={inputClass(Boolean(errors.value))}
        />
      </Field>

      <Field id="misura-date" label="Data" error={errors.date}>
        <input
          id="misura-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          onBlur={() =>
            setErrors((current) => revalidate(current, validate({ value, date }), "date"))
          }
          aria-invalid={errors.date ? true : undefined}
          aria-describedby={errors.date ? "misura-date-errore" : undefined}
          className={inputClass(Boolean(errors.date))}
        />
      </Field>

      <Field id="misura-note" label="Nota (facoltativa)">
        <input
          id="misura-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="a digiuno, dopo la colazione…"
          className={inputClass(false)}
        />
      </Field>

      <SheetFooter>
        {onDelete ? (
          <Button
            type="button"
            variant="destructive"
            block
            className="md:w-auto"
            onClick={onDelete}
          >
            Elimina
          </Button>
        ) : null}
        <Button
          type="submit"
          block
          className="md:w-auto"
          loading={saving}
          loadingLabel="Salvo…"
        >
          Salva
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Aggiorna l'errore di **un solo** campo: gli altri restano come sono (validazione on blur). */
function revalidate(
  current: Record<string, string>,
  found: Record<string, string>,
  field: string,
): Record<string, string> {
  const next = { ...current };
  if (found[field]) next[field] = found[field];
  else delete next[field];
  return next;
}

function inputClass(invalid: boolean): string {
  return cn(
    "tnum h-14 w-full rounded-[var(--radius-sm)] bg-[var(--input)] px-4 text-num-md text-[var(--text-primary)]",
    "placeholder:font-sans placeholder:text-sm placeholder:text-[var(--text-muted)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
    invalid
      ? "border-2 border-[var(--danger)]"
      : "border border-[var(--border-strong)] focus-visible:border-[var(--accent-blue)]",
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-errore`}
          className="flex items-center gap-2 text-sm text-[var(--danger)]"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
