import { PLATE_KGS, type PlateKg } from "@/lib/db/schema";

/**
 * Dischi disponibili **per lato** — e' questo il budget che la DP consuma.
 *
 * Non e' quello che l'utente scrive in Impostazioni: li' si dichiara il totale
 * («Quanti ne hai in tutto, non per lato»). La conversione, e il diviso due che ci
 * vuole, stanno in `toPlateInventory` e in nessun altro posto.
 */
export type PlateInventory = Record<PlateKg, number>;

export interface PlateCount {
  kg: PlateKg;
  count: number;
}

export interface PlateStack {
  /** dischi da caricare su **un** lato, dal piu' pesante al piu' leggero */
  perSide: PlateCount[];
  perSideKg: number;
  totalKg: number;
  /** scarto rispetto al target: 0 se esatto, negativo se per difetto */
  deltaKg: number;
}

export type PlateStatus = "exact" | "inexact" | "bar-only" | "below-bar";

export interface PlateResult {
  status: PlateStatus;
  targetKg: number;
  barWeightKg: number;
  /** la combinazione da mostrare; `null` solo quando il target e' sotto il bilanciere */
  best: PlateStack | null;
  /** alternative, valorizzate solo quando il target non si compone esattamente */
  below: PlateStack | null;
  above: PlateStack | null;
}

/** Tutti i dischi sono multipli di 1,25 kg: l'unita' di conto e' quella. */
const UNIT_KG = 1.25;
/** 1,25 kg per lato = 250 mezzi-centesimi di peso totale. Aritmetica intera, niente float. */
const UNIT_HUNDREDTHS = 250;

const DENOMINATIONS: readonly { kg: PlateKg; units: number }[] = PLATE_KGS.map(
  (kg) => ({ kg, units: Math.round(kg / UNIT_KG) }),
);

interface Composition {
  /** conteggi allineati a DENOMINATIONS (dal disco piu' pesante) */
  counts: number[];
  total: number;
}

/**
 * Calcolatore di dischi (spec §3.3, design §6.4).
 *
 * Programmazione dinamica, non avidita': con un inventario limitato l'algoritmo avido
 * sbaglia (chiede 15 kg quando la risposta era 10+10). La DP trova la combinazione con
 * **meno dischi possibile**, e a parita' di numero quella che carica prima i dischi
 * piu' pesanti — che e' come si carica un bilanciere davvero.
 *
 * Quando il target non si compone esattamente **lo dice**: restituisce lo stato
 * `inexact` con la combinazione per difetto e quella per eccesso. Mai un arrotondamento
 * silenzioso.
 */
export function solvePlates(
  targetKg: number,
  barWeightKg: number,
  inventory: PlateInventory,
): PlateResult {
  const base: Omit<PlateResult, "status" | "best" | "below" | "above"> = {
    targetKg,
    barWeightKg,
  };

  if (targetKg < barWeightKg) {
    return { ...base, status: "below-bar", best: null, below: null, above: null };
  }

  const remainderHundredths =
    Math.round(targetKg * 100) - Math.round(barWeightKg * 100);

  if (remainderHundredths === 0) {
    return {
      ...base,
      status: "bar-only",
      best: emptyStack(barWeightKg, targetKg),
      below: null,
      above: null,
    };
  }

  const availableUnits = DENOMINATIONS.reduce(
    (sum, d) => sum + d.units * clampCount(inventory[d.kg]),
    0,
  );
  const table = buildTable(inventory, availableUnits);

  const exactUnits = remainderHundredths / UNIT_HUNDREDTHS;
  const isWholeUnits = Number.isInteger(exactUnits);

  if (isWholeUnits && exactUnits <= availableUnits && table[exactUnits]) {
    return {
      ...base,
      status: "exact",
      best: toStack(table[exactUnits]!, barWeightKg, targetKg),
      below: null,
      above: null,
    };
  }

  const floorUnits = Math.floor(exactUnits);
  const ceilUnits = Math.ceil(exactUnits);

  let belowUnits: number | null = null;
  for (let u = Math.min(floorUnits, availableUnits); u >= 0; u -= 1) {
    if (table[u]) {
      belowUnits = u;
      break;
    }
  }

  let aboveUnits: number | null = null;
  const firstAbove = isWholeUnits ? exactUnits + 1 : ceilUnits;
  for (let u = firstAbove; u <= availableUnits; u += 1) {
    if (table[u]) {
      aboveUnits = u;
      break;
    }
  }

  const below =
    belowUnits === null ? null : toStack(table[belowUnits]!, barWeightKg, targetKg);
  const above =
    aboveUnits === null ? null : toStack(table[aboveUnits]!, barWeightKg, targetKg);

  // Il piu' vicino; a parita' di distanza vince quello per eccesso (si toglie un disco
  // piu' facilmente di quanto si inventi il peso mancante).
  let best: PlateStack | null = null;
  if (below && above) {
    best = Math.abs(above.deltaKg) <= Math.abs(below.deltaKg) ? above : below;
  } else {
    best = above ?? below;
  }

  return { ...base, status: "inexact", best, below, above };
}

/**
 * Converte l'inventario salvato in `Settings` (totale, chiavi stringa) nel budget
 * **per lato** che il calcolo consuma.
 *
 * Il diviso due sta qui, una volta sola. Un bilanciere si carica simmetrico: un disco
 * spaiato non si usa, quindi si arrotonda per difetto. Dieci dischi da 20 dichiarati
 * valgono cinque coppie; nove ne valgono comunque quattro.
 */
export function toPlateInventory(raw: Record<string, number>): PlateInventory {
  const inventory = {} as PlateInventory;
  for (const kg of PLATE_KGS) {
    inventory[kg] = Math.floor(clampCount(raw[String(kg)]) / 2);
  }
  return inventory;
}

function clampCount(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value < 0) return 0;
  return Math.floor(value);
}

/**
 * dp[u] = composizione ottima che somma esattamente `u` unita'.
 * Criterio: meno dischi; a parita', il vettore lessicograficamente piu' alto letto
 * dal disco piu' pesante.
 */
function buildTable(
  inventory: PlateInventory,
  maxUnits: number,
): (Composition | null)[] {
  let dp: (Composition | null)[] = new Array(maxUnits + 1).fill(null);
  dp[0] = { counts: DENOMINATIONS.map(() => 0), total: 0 };

  for (let i = 0; i < DENOMINATIONS.length; i += 1) {
    const { kg, units } = DENOMINATIONS[i];
    const available = clampCount(inventory[kg]);
    if (available === 0) continue;

    const next: (Composition | null)[] = new Array(maxUnits + 1).fill(null);
    for (let u = 0; u <= maxUnits; u += 1) {
      for (let k = 0; k <= available; k += 1) {
        const from = u - k * units;
        if (from < 0) break;
        const previous = dp[from];
        if (!previous) continue;
        const counts = previous.counts.slice();
        counts[i] = k;
        const candidate: Composition = { counts, total: previous.total + k };
        if (isBetter(candidate, next[u], i)) next[u] = candidate;
      }
    }
    dp = next;
  }

  return dp;
}

function isBetter(
  candidate: Composition,
  incumbent: Composition | null,
  lastIndex: number,
): boolean {
  if (!incumbent) return true;
  if (candidate.total !== incumbent.total) return candidate.total < incumbent.total;
  for (let i = 0; i <= lastIndex; i += 1) {
    if (candidate.counts[i] !== incumbent.counts[i]) {
      return candidate.counts[i] > incumbent.counts[i];
    }
  }
  return false;
}

function toStack(
  composition: Composition,
  barWeightKg: number,
  targetKg: number,
): PlateStack {
  const perSide: PlateCount[] = [];
  let perSideHundredths = 0;
  for (let i = 0; i < DENOMINATIONS.length; i += 1) {
    const count = composition.counts[i];
    if (count > 0) {
      perSide.push({ kg: DENOMINATIONS[i].kg, count });
      perSideHundredths += Math.round(DENOMINATIONS[i].kg * 100) * count;
    }
  }
  const totalHundredths = Math.round(barWeightKg * 100) + perSideHundredths * 2;
  return {
    perSide,
    perSideKg: perSideHundredths / 100,
    totalKg: totalHundredths / 100,
    deltaKg: (totalHundredths - Math.round(targetKg * 100)) / 100,
  };
}

function emptyStack(barWeightKg: number, targetKg: number): PlateStack {
  return {
    perSide: [],
    perSideKg: 0,
    totalKg: barWeightKg,
    deltaKg: Math.round((barWeightKg - targetKg) * 100) / 100,
  };
}
