import { newId, type LiftedDB } from "./db";
import {
  METRIC_RANGE,
  METRIC_UNIT,
  type ID,
  type MeasurementEntry,
  type MetricKey,
} from "./schema";

/**
 * Misure corporee (spec §3.6).
 *
 * Una voce per metrica e per momento: peso e circonferenze non si registrano insieme
 * per forza, e chi misura solo il peso non deve compilare sette campi vuoti.
 * L'unita' non si chiede mai all'utente: discende dalla metrica (§9.1).
 */

export class MeasurementRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementRangeError";
  }
}

export interface MeasurementInput {
  metric: MetricKey;
  value: number;
  date: string;
  note?: string;
}

export function validateMeasurement(input: MeasurementInput, now = Date.now()): void {
  const range = METRIC_RANGE[input.metric];
  if (!Number.isFinite(input.value) || input.value < range.min || input.value > range.max) {
    throw new MeasurementRangeError(
      `Inserisci un valore tra ${range.min} e ${range.max} ${METRIC_UNIT[input.metric]}.`,
    );
  }
  const timestamp = Date.parse(input.date);
  if (Number.isNaN(timestamp)) throw new MeasurementRangeError("Scegli una data valida.");
  // Un minuto di tolleranza: "adesso" non deve diventare "nel futuro" per colpa
  // dell'orologio che avanza mentre si compila il campo.
  if (timestamp > now + 60_000) {
    throw new MeasurementRangeError("Non puoi registrare una misura nel futuro.");
  }
}

export async function createMeasurement(
  db: LiftedDB,
  input: MeasurementInput,
): Promise<MeasurementEntry> {
  validateMeasurement(input);
  const entry: MeasurementEntry = {
    id: newId(),
    metric: input.metric,
    value: Math.round(input.value * 100) / 100,
    unit: METRIC_UNIT[input.metric],
    date: input.date,
    note: input.note?.trim() || undefined,
  };
  await db.measurements.add(entry);
  return entry;
}

export async function updateMeasurement(
  db: LiftedDB,
  id: ID,
  input: MeasurementInput,
): Promise<void> {
  validateMeasurement(input);
  await db.measurements.update(id, {
    metric: input.metric,
    value: Math.round(input.value * 100) / 100,
    unit: METRIC_UNIT[input.metric],
    date: input.date,
    note: input.note?.trim() || undefined,
  });
}

export async function deleteMeasurement(db: LiftedDB, id: ID): Promise<void> {
  await db.measurements.delete(id);
}

/** Tutte le voci di una metrica, dalla piu' vecchia alla piu' recente (asse del tempo). */
export async function listMeasurements(
  db: LiftedDB,
  metric: MetricKey,
): Promise<MeasurementEntry[]> {
  return db.measurements
    .where("[metric+date]")
    .between([metric, ""], [metric, "￿"])
    .toArray();
}

export interface MetricSummary {
  metric: MetricKey;
  latest: MeasurementEntry | null;
  previous: MeasurementEntry | null;
  /** differenza fra le ultime due letture; `null` se non ci sono due letture */
  delta: number | null;
  /** gli ultimi 12 punti, per la sparkline (§9.2) */
  spark: { date: string; value: number }[];
  count: number;
}

/** Una riga per metrica: ultimo valore, delta e sparkline. E' quello che legge `/misure`. */
export async function measurementSummaries(
  db: LiftedDB,
  metrics: readonly MetricKey[],
): Promise<MetricSummary[]> {
  const all = await db.measurements.toArray();
  const byMetric = new Map<MetricKey, MeasurementEntry[]>();
  for (const entry of all) {
    const rows = byMetric.get(entry.metric);
    if (rows) rows.push(entry);
    else byMetric.set(entry.metric, [entry]);
  }

  return metrics.map((metric) => {
    const rows = (byMetric.get(metric) ?? []).toSorted((a, b) =>
      a.date.localeCompare(b.date),
    );
    const latest = rows.at(-1) ?? null;
    const previous = rows.at(-2) ?? null;
    return {
      metric,
      latest,
      previous,
      delta:
        latest && previous
          ? Math.round((latest.value - previous.value) * 100) / 100
          : null,
      spark: rows.slice(-12).map((entry) => ({ date: entry.date, value: entry.value })),
      count: rows.length,
    };
  });
}
