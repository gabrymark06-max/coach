import type { SessionExercise, SetEntry } from "@/lib/db/schema";

/**
 * Volume di una serie = peso x ripetizioni, solo se la serie e' completata.
 *
 * Decisione: le serie di riscaldamento *contano*. La spec (§3.1) definisce il volume
 * come "kg x reps" senza esclusioni, e il riscaldamento e' peso davvero sollevato.
 * Se un domani si vorra' escluderlo, si cambia qui e in un solo posto.
 *
 * L'aritmetica passa dai centesimi perche' 82,5 x 3 in virgola mobile da' 247.49999…
 */
export function setVolume(entry: SetEntry): number {
  if (!entry.completed) return 0;
  const weight = entry.weightKg ?? 0;
  const reps = entry.reps ?? 0;
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * reps * 100) / 100;
}

export function exerciseVolume(exercise: SessionExercise): number {
  let total = 0;
  for (const entry of exercise.sets) total += setVolume(entry);
  return Math.round(total * 100) / 100;
}

export interface SessionTotals {
  totalVolumeKg: number;
  totalSets: number;
}

/** Volume e serie completate di tutta la sessione, in una sola passata. */
export function sessionTotals(exercises: SessionExercise[]): SessionTotals {
  let totalVolumeKg = 0;
  let totalSets = 0;
  for (const exercise of exercises) {
    for (const entry of exercise.sets) {
      if (!entry.completed) continue;
      totalSets += 1;
      totalVolumeKg += setVolume(entry);
    }
  }
  return {
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
    totalSets,
  };
}
