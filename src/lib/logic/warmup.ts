/** Percentuali di default del riscaldamento (spec §3.2). */
export const DEFAULT_WARMUP_PERCENTS = [0.5, 0.7, 0.875];

export interface WarmupSet {
  /** "Bilanciere", "50%", "87,5%" */
  label: string;
  /** `null` sulla riga del bilanciere vuoto */
  percent: number | null;
  /** peso caricabile davvero, arrotondato al passo */
  weightKg: number;
  /** valore teorico, mostrato accanto in grigio */
  exactKg: number;
  reps: number;
  restSec: number;
}

export interface WarmupInput {
  targetKg: number | null;
  barWeightKg: number;
  percents: number[];
  /** passo caricabile: 2 x il disco piu' piccolo disponibile */
  stepKg: number;
  /** falso per manubri e macchine: la riga "bilanciere vuoto" non ha senso */
  includeBar: boolean;
}

export interface WarmupPlan {
  status: "ok" | "below-bar" | "no-target";
  sets: WarmupSet[];
}

/**
 * Calcolatore di riscaldamento (spec §3.2, design §6.3).
 *
 * Il peso e' arrotondato al passo caricabile, e il valore teorico resta accanto:
 * l'utente deve poter vedere che 71,75 kg sono diventati 72,5 e perche'.
 */
export function buildWarmupPlan(input: WarmupInput): WarmupPlan {
  const { targetKg, barWeightKg, percents, stepKg, includeBar } = input;

  if (targetKg == null || !Number.isFinite(targetKg) || targetKg <= 0) {
    return { status: "no-target", sets: [] };
  }
  if (includeBar && targetKg < barWeightKg) {
    return { status: "below-bar", sets: [] };
  }

  const sets: WarmupSet[] = [];
  let lastWeight = 0;

  if (includeBar) {
    sets.push({
      label: "Bilanciere",
      percent: null,
      weightKg: round2(barWeightKg),
      exactKg: round2(barWeightKg),
      reps: 10,
      restSec: 30,
    });
    lastWeight = round2(barWeightKg);
  }

  for (const percent of [...percents].sort((a, b) => a - b)) {
    const exactKg = round2(targetKg * percent);
    const weightKg = roundToStep(exactKg, stepKg);
    // Una riga che non aggiunge carico non e' un riscaldamento: si salta.
    if (weightKg <= lastWeight) continue;
    if (weightKg >= targetKg) continue;

    const { reps, restSec } = effortFor(percent);
    sets.push({ label: formatPercent(percent), percent, weightKg, exactKg, reps, restSec });
    lastWeight = weightKg;
  }

  return { status: "ok", sets };
}

/** Il passo caricabile e' il doppio del disco piu' piccolo che si possiede. */
export function loadableStepKg(
  inventory: Record<string, number>,
  fallbackKg: number,
): number {
  const owned = Object.entries(inventory)
    .filter(([, count]) => count > 0)
    .map(([kg]) => Number(kg))
    .filter((kg) => Number.isFinite(kg) && kg > 0);
  if (owned.length === 0) return fallbackKg;
  return round2(Math.min(...owned) * 2);
}

function effortFor(percent: number): { reps: number; restSec: number } {
  if (percent <= 0.55) return { reps: 8, restSec: 45 };
  if (percent <= 0.75) return { reps: 5, restSec: 60 };
  if (percent <= 0.85) return { reps: 3, restSec: 75 };
  return { reps: 2, restSec: 90 };
}

function formatPercent(percent: number): string {
  const value = round2(percent * 100);
  return `${String(value).replace(".", ",")}%`;
}

function roundToStep(value: number, stepKg: number): number {
  if (!Number.isFinite(stepKg) || stepKg <= 0) return round2(value);
  return round2(Math.round(value / stepKg) * stepKg);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
