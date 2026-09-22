export type E1rmFormula = "epley" | "brzycki";

/**
 * 1RM stimato (spec §3.5).
 *
 *   Epley    → w x (1 + r/30)
 *   Brzycki  → w x 36 / (37 - r), non definita da 37 ripetizioni in su
 *
 * A una ripetizione entrambe restituiscono il peso stesso: Epley formalmente darebbe
 * w x 1,033, ma un massimale sollevato una volta *e'* il massimale. Il caso e' esplicito
 * qui e non sparso nei chiamanti.
 *
 * Restituisce `null` quando una stima non esiste, invece di un numero inventato.
 */
export function estimate1RM(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  formula: E1rmFormula,
): number | null {
  if (weightKg == null || reps == null) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round2(weightKg);

  if (formula === "brzycki") {
    if (reps >= 37) return null;
    return round2((weightKg * 36) / (37 - reps));
  }
  return round2(weightKg * (1 + reps / 30));
}

export interface E1rmCandidate {
  weightKg: number | null;
  reps: number | null;
}

export interface BestE1rm {
  value: number;
  weightKg: number;
  reps: number;
}

/** La serie che produce la stima piu' alta. `null` se nessuna serie e' stimabile. */
export function bestE1rm(
  candidates: E1rmCandidate[],
  formula: E1rmFormula,
): BestE1rm | null {
  let best: BestE1rm | null = null;
  for (const candidate of candidates) {
    const value = estimate1RM(candidate.weightKg, candidate.reps, formula);
    if (value === null) continue;
    if (best === null || value > best.value) {
      best = {
        value,
        weightKg: candidate.weightKg as number,
        reps: candidate.reps as number,
      };
    }
  }
  return best;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
