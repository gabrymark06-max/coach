// Le modifiche di readiness / versione corta a parole (design §2.3): esercizi tolti, poi per esercizio, poi la durata.
import type { ReadinessOut } from "@/lib/api/types";
import { formatRest } from "@/lib/format";

export function describeDiff(out: ReadinessOut, opts: { duration?: boolean } = {}): string[] {
  const changes: string[] = [];
  for (const r of out.diff.removed_exercises) changes.push(`Tolgo ${r.name}`);
  const names = new Map(out.session.exercises.map((e) => [e.exercise_id, e.name_it]));
  const byEx = new Map<string, string[]>();
  for (const c of out.diff.changed_sets) {
    const name = names.get(c.exercise_id) ?? c.exercise_id;
    const list = byEx.get(name) ?? [];
    if (c.field === "sets") list.push(`${c.to} serie invece di ${c.from}`);
    else if (c.field === "rest") list.push(`recupero ${formatRest(Number(c.to))} invece di ${formatRest(Number(c.from))}`);
    else if (c.field === "reps") list.push(`${c.to} ripetizioni invece di ${c.from}`);
    else if (c.field === "rir") list.push(`RIR ${c.to} invece di ${c.from}`);
    else if (c.field === "weight") list.push(`${c.to} kg invece di ${c.from}`);
    byEx.set(name, list);
  }
  for (const [name, list] of byEx) changes.push(`${name}: ${list.join(", ")}`);
  if (opts.duration !== false) changes.push(`Durata: ${out.diff.est_minutes} minuti`);
  return changes;
}
