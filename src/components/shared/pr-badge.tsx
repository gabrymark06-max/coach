"use client";

import { Trophy } from "lucide-react";
import * as React from "react";
import type { PersonalRecord, PRKind } from "@/lib/db/schema";
import { formatKgValue, formatVolume } from "@/lib/format";
import { PR_KIND_LABEL, PR_KIND_SPOKEN } from "@/lib/logic/pr";
import { cn } from "@/lib/utils";

/**
 * `PRBadge` — §4.5.
 *
 * **Mai solo l'icona e mai solo il colore**: il chip porta sempre la parola
 * (`PR 1RM`, `PR VOLUME`, `PR REPS`) accanto alla coppa. Togliendo tutti i colori resta
 * leggibile, che e' la prova richiesta da §8.2.
 *
 * La variante `fresh` e' l'unica animata (ingresso `scale` + `opacity`, `--dur-2`), una
 * volta sola e solo nel riepilogo appena salvato; con `prefers-reduced-motion` non si
 * anima ma **l'annuncio `aria-live` resta** — e' l'informazione, l'animazione no.
 */

export function prValueLabel(record: Pick<PersonalRecord, "kind" | "value">): string {
  switch (record.kind) {
    case "e1rm":
      return `${formatKgValue(record.value)} kg`;
    case "volume":
      return `${formatVolume(record.value)} kg`;
    case "reps":
      return `${record.value} reps`;
  }
}

/** Frase per l'annuncio `aria-live` e per i nomi accessibili (§8.5). */
export function prSpokenLabel(
  record: Pick<PersonalRecord, "kind" | "value" | "previousValue">,
  exerciseName: string,
): string {
  const delta =
    record.previousValue != null
      ? `, ${formatKgValue(Math.round((record.value - record.previousValue) * 100) / 100)} in più del record precedente`
      : "";
  return `Record personale: ${exerciseName}, ${PR_KIND_SPOKEN[record.kind]} ${prValueLabel(record)}${delta}.`;
}

const KIND_ORDER: Record<PRKind, number> = { e1rm: 0, volume: 1, reps: 2 };

/**
 * L'ordine in cui si raccontano i record: prima il 1RM, che e' quello che si va a
 * cercare, poi il volume, poi le ripetizioni. Vale sia per l'elenco sia per l'annuncio
 * `aria-live`, cosi' quello che si legge e quello che si sente coincidono.
 */
export function sortByKind<T extends { kind: PRKind }>(records: readonly T[]): T[] {
  return records.toSorted((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export function PRBadge({
  kind,
  value,
  variant = "default",
  fresh = false,
  className,
}: {
  kind: PRKind;
  /** quando c'e', il chip mostra anche il numero: «PR 1RM · 112 kg» */
  value?: string;
  variant?: "default" | "filled";
  fresh?: boolean;
  className?: string;
}) {
  return (
    <span
      data-fresh={fresh ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] text-label",
        variant === "filled"
          ? "h-7 bg-[var(--pr)] px-3 text-[var(--pr-on-fill)]"
          : "h-6 border border-[var(--pr-border)] bg-[var(--pr-surface)] px-3 text-[var(--pr)]",
        fresh && "origin-center animate-[lifted-pr-in_var(--dur-2)_var(--ease-tap)]",
        "motion-reduce:animate-none",
        className,
      )}
    >
      <Trophy
        aria-hidden="true"
        className="size-4"
        strokeWidth={1.75}
        fill={variant === "filled" ? "currentColor" : "none"}
      />
      <span translate="no">{PR_KIND_LABEL[kind]}</span>
      {value ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="tnum font-sans">{value}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * L'elenco dei record di una sessione, con la frase «+4 sul record» quando c'e' un
 * precedente da battere. Senza il valore precedente il confronto non si inventa.
 */
export function PRList({
  records,
  nameById,
  fresh = false,
}: {
  records: readonly PersonalRecord[];
  nameById: ReadonlyMap<string, string>;
  fresh?: boolean;
}) {
  if (records.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {sortByKind(records).map((record) => {
        const delta =
          record.previousValue != null
            ? Math.round((record.value - record.previousValue) * 100) / 100
            : null;
        return (
          <li
            key={record.id}
            className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--pr-border)] bg-[var(--card)] p-4 shadow-[var(--glow-pr)]"
          >
            {/*
              Due righe e non una: a 375px il nome «Rematore con bilanciere presa
              inversa» non ha spazio accanto a chip, valore e delta, e un `flex-1` su
              quattro figli lo riduce a una colonna di lettere (§11.9).
            */}
            <div className="flex items-center gap-3">
              <PRBadge kind={record.kind} variant="filled" fresh={fresh} />
              <span className="min-w-0 flex-1 break-words text-base text-[var(--text-primary)]">
                {nameById.get(record.exerciseId) ?? "Esercizio rimosso"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="tnum text-h2 text-[var(--text-primary)]">
                {prValueLabel(record)}
              </span>
              {delta != null && delta > 0 ? (
                <span className="tnum text-sm text-[var(--pr)]">
                  +{formatKgValue(delta)} sul record precedente
                </span>
              ) : (
                <span className="text-sm text-[var(--text-muted)]">primo record</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Le tre misure di riferimento di un esercizio, per il suo dettaglio. */
export function PRSummary({ records }: { records: readonly PersonalRecord[] }) {
  const best = React.useMemo(() => {
    const map = new Map<PRKind, PersonalRecord>();
    for (const record of records) {
      const current = map.get(record.kind);
      if (!current || record.value > current.value) map.set(record.kind, record);
    }
    return map;
  }, [records]);

  const kinds: PRKind[] = ["e1rm", "volume", "reps"];
  const found = kinds.filter((kind) => best.has(kind));
  if (found.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-3">
      {found.map((kind) => (
        <li key={kind}>
          <PRBadge kind={kind} value={prValueLabel(best.get(kind)!)} />
        </li>
      ))}
    </ul>
  );
}
