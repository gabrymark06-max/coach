import {
  METRIC_LABEL,
  SET_TYPE_LABEL,
  type MeasurementEntry,
  type PersonalRecord,
  type Session,
} from "@/lib/db/schema";
import { PR_KIND_LABEL } from "@/lib/logic/pr";

/**
 * CSV che si apre in **Excel italiano** senza doverlo aggiustare a mano.
 *
 * Tre scelte, e il perche':
 *
 *  1. **Separatore `;`.** Excel non legge il CSV con un separatore fisso: usa il
 *     *separatore di elenco* del sistema, che in Italia (e in tutte le locale con la
 *     virgola decimale) e' il punto e virgola. Con `,` il file finisce tutto in una
 *     colonna sola.
 *  2. **Decimali con la virgola.** `82.5` in una locale italiana diventa testo, o peggio
 *     una data. `82,5` entra come numero e si puo' sommare.
 *  3. **BOM UTF-8 in testa.** Senza, Excel su Windows legge il file come ANSI e
 *     «Esercizio» diventa «Esercizioâ€¦». Il BOM e' l'unico modo affidabile per dirgli
 *     che e' UTF-8.
 *
 * Fine riga `\r\n` (RFC 4180), campi con `;`, `"` o a capo racchiusi fra virgolette e
 * virgolette interne raddoppiate.
 */

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

function escapeCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(CSV_SEPARATOR)).join("\r\n");
}

/** Numero per un foglio italiano: virgola decimale, mai separatore di migliaia. */
export function csvNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

export function csvDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

export function csvTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFormat.format(date);
}

const SET_TYPE_CSV: Record<string, string> = {
  normal: "Normale",
  warmup: "Riscaldamento",
  drop: "Drop set",
  failure: "Cedimento",
};

/** Storico: **una riga per serie**, cosi' una tabella pivot funziona senza lavoro. */
export function setsCsv(sessions: readonly Session[]): string {
  const rows: string[][] = [
    [
      "Data",
      "Ora",
      "Allenamento",
      "Esercizio",
      "Serie",
      "Tipo",
      "Peso (kg)",
      "Ripetizioni",
      "RPE",
      "Volume (kg)",
      "Durata sessione (min)",
      "ID sessione",
    ],
  ];

  const ordered = sessions
    .filter((session) => session.status === "completed")
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const session of ordered) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        const volume =
          set.weightKg != null && set.reps != null ? set.weightKg * set.reps : null;
        rows.push([
          csvDate(session.startedAt),
          csvTime(session.startedAt),
          session.routineName ?? "Sessione libera",
          exercise.exerciseName,
          String(set.index),
          SET_TYPE_CSV[set.type] ?? SET_TYPE_LABEL[set.type],
          csvNumber(set.weightKg),
          set.reps == null ? "" : String(set.reps),
          csvNumber(set.rpe),
          csvNumber(volume),
          csvNumber(Math.round(session.durationSec / 60)),
          session.id,
        ]);
      }
    }
  }

  return CSV_BOM + toCsv(rows);
}

export function measurementsCsv(entries: readonly MeasurementEntry[]): string {
  const rows: string[][] = [["Data", "Metrica", "Valore", "Unità", "Nota"]];
  const ordered = entries.toSorted((a, b) => a.date.localeCompare(b.date));
  for (const entry of ordered) {
    rows.push([
      csvDate(entry.date),
      METRIC_LABEL[entry.metric] ?? entry.metric,
      csvNumber(entry.value),
      entry.unit,
      entry.note ?? "",
    ]);
  }
  return CSV_BOM + toCsv(rows);
}

export function personalRecordsCsv(
  records: readonly PersonalRecord[],
  nameById: ReadonlyMap<string, string>,
): string {
  const rows: string[][] = [
    ["Data", "Esercizio", "Tipo", "Valore", "Peso (kg)", "Ripetizioni", "Record precedente"],
  ];
  const ordered = records.toSorted((a, b) => a.achievedAt.localeCompare(b.achievedAt));
  for (const record of ordered) {
    rows.push([
      csvDate(record.achievedAt),
      nameById.get(record.exerciseId) ?? record.exerciseId,
      PR_KIND_LABEL[record.kind],
      csvNumber(record.value),
      csvNumber(record.weightKg),
      record.reps == null ? "" : String(record.reps),
      csvNumber(record.previousValue),
    ]);
  }
  return CSV_BOM + toCsv(rows);
}
