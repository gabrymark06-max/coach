import type { TrainerGoal, TrainerLevel } from "@/lib/db/trainer-schema";

/**
 * Quante serie, quante ripetizioni, a che RPE e con quanto recupero.
 *
 * Tre ingressi, e nient'altro: **obiettivo**, **ruolo dell'esercizio nel giorno** e
 * **livello**. Sono numeri, quindi stanno in una tabella e non sparsi in `if` dentro
 * il generatore: la domanda «perche' mi fa fare 4 serie da 6?» deve avere una riga da
 * indicare.
 */

/** Il posto che un esercizio occupa nel giorno. Decide carico, volume e recupero. */
export type Role = "primario" | "secondario" | "complementare";

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  rpeTarget: number;
  restSec: number;
}

/**
 * La base per obiettivo e ruolo. Il livello la corregge dopo (`applyLevel`), cosi' la
 * tabella resta leggibile e la correzione resta una regola sola.
 */
const BASE: Record<TrainerGoal, Record<Role, Prescription>> = {
  strength: {
    primario: { sets: 4, repsMin: 3, repsMax: 5, rpeTarget: 8, restSec: 180 },
    secondario: { sets: 3, repsMin: 5, repsMax: 8, rpeTarget: 8, restSec: 150 },
    complementare: { sets: 3, repsMin: 8, repsMax: 12, rpeTarget: 8, restSec: 90 },
  },
  hypertrophy: {
    primario: { sets: 4, repsMin: 6, repsMax: 8, rpeTarget: 8, restSec: 150 },
    secondario: { sets: 3, repsMin: 8, repsMax: 12, rpeTarget: 8, restSec: 120 },
    complementare: { sets: 3, repsMin: 12, repsMax: 15, rpeTarget: 9, restSec: 75 },
  },
  recomp: {
    primario: { sets: 4, repsMin: 6, repsMax: 10, rpeTarget: 8, restSec: 120 },
    secondario: { sets: 3, repsMin: 10, repsMax: 12, rpeTarget: 8, restSec: 90 },
    complementare: { sets: 3, repsMin: 12, repsMax: 15, rpeTarget: 9, restSec: 60 },
  },
  maintenance: {
    primario: { sets: 3, repsMin: 6, repsMax: 10, rpeTarget: 7, restSec: 120 },
    secondario: { sets: 2, repsMin: 8, repsMax: 12, rpeTarget: 7, restSec: 90 },
    complementare: { sets: 2, repsMin: 12, repsMax: 15, rpeTarget: 8, restSec: 60 },
  },
};

/**
 * Il livello corregge **il volume, non l'intensita'**.
 *
 * Un principiante non ha bisogno di meno carico: ha bisogno di meno serie, perche' il
 * recupero fra una seduta e l'altra e' il suo collo di bottiglia e perche' con meno
 * serie ogni ripetizione la fa con attenzione. Un avanzato ha bisogno di piu' serie
 * perche' con poche non stimola piu' niente. L'RPE obiettivo scende di mezzo punto per
 * il principiante: sa ancora male dove sta il suo cedimento.
 */
const LEVEL_SETS: Record<TrainerLevel, Record<Role, number>> = {
  beginner: { primario: -1, secondario: -1, complementare: -1 },
  intermediate: { primario: 0, secondario: 0, complementare: 0 },
  advanced: { primario: 1, secondario: 1, complementare: 0 },
};

const LEVEL_RPE: Record<TrainerLevel, number> = {
  beginner: -0.5,
  intermediate: 0,
  advanced: 0.5,
};

export function prescribe(
  goal: TrainerGoal,
  role: Role,
  level: TrainerLevel,
): Prescription {
  const base = BASE[goal][role];
  return {
    ...base,
    sets: Math.max(2, base.sets + LEVEL_SETS[level][role]),
    rpeTarget: clampRpe(base.rpeTarget + LEVEL_RPE[level]),
  };
}

/**
 * La settimana di scarico (§4.25 `planned-deload`): **volume −40%, carico −10%**.
 * Qui si taglia il volume; il carico lo taglia la regola, perche' il carico e' una
 * decisione e come tale va scritta nel registro.
 */
export function deloadPrescription(source: Prescription): Prescription {
  return {
    ...source,
    sets: Math.max(2, Math.round(source.sets * 0.6)),
    rpeTarget: clampRpe(source.rpeTarget - 1),
  };
}

export const DELOAD_VOLUME_FACTOR = 0.6;
export const DELOAD_WEIGHT_FACTOR = 0.9;

function clampRpe(value: number): number {
  return Math.min(10, Math.max(5, Math.round(value * 2) / 2));
}
