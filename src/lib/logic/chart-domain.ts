/**
 * Dominio degli assi — design system §4.10-bis, chiude QA GRAVE 2.
 *
 * La domanda che decide e' una sola: **lo zero e' un valore possibile e significativo
 * per questa grandezza?**
 *
 *  - **si'** (volume, serie, minuti, conteggi): l'altezza *e'* l'informazione, quindi
 *    l'asse parte da zero e non si discute. E' il caso delle barre, che restano come
 *    sono: una barra tagliata mente.
 *  - **no** (peso corporeo, % massa grassa, circonferenze, 1RM stimato, carico): conta
 *    la variazione, non la distanza dall'origine. L'asse parte dal minimo, e allora il
 *    grafico **deve dichiarare la scala**, perche' senza lo zero visibile il lettore
 *    non ha piu' un riferimento.
 *
 * Il difetto che chiude: due misurazioni a 82,4 e 81,2 kg su un asse 0-100 sono una
 * riga orizzontale. La funzionalita' esisteva e non serviva a niente.
 */

/** Passi ammessi per i tick, dal piu' fine al piu' grosso (§4.10-bis). */
const TICK_STEPS = [0.5, 1, 2.5, 5, 10, 25, 50, 100] as const;

const TICK_MIN = 4;
const TICK_MAX = 6;

export interface LevelDomain {
  /** estremo inferiore dell'asse, gia' allineato al tick */
  min: number;
  /** estremo superiore dell'asse, gia' allineato al tick */
  max: number;
  /** passo dei tick scelto */
  step: number;
  /** quanti tick disegna Recharts fra min e max, estremi compresi */
  tickCount: number;
  /** tutti i punti hanno lo stesso valore: l'asse e' simmetrico e la linea sta al centro */
  flat: boolean;
}

/**
 * Dominio di una grandezza **di livello**: `[dataMin − pad, dataMax + pad]`, allineato
 * a un passo che produca 4-6 tick.
 *
 * `unitaMinima` e' l'incremento sotto il quale la grandezza non si misura (0,5 kg,
 * 0,5 %, 0,5 cm): serve perche' con dieci misurazioni tutte a 82,4 il padding
 * proporzionale sarebbe zero e l'asse collasserebbe sul punto.
 *
 * Ritorna `null` senza dati: chi chiama ha gia' lo stato vuoto di §4.10.
 */
export function levelDomain(
  values: readonly number[],
  unitStep: number,
): LevelDomain | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;

  let dataMin = finite[0];
  let dataMax = finite[0];
  for (const value of finite) {
    if (value < dataMin) dataMin = value;
    if (value > dataMax) dataMax = value;
  }

  const spread = dataMax - dataMin;

  /**
   * Caso degenere. Con escursione zero il padding varrebbe `unitaMinima` e l'asse si
   * stringerebbe a 1 kg: il rumore diventerebbe un terremoto. Si apre a quattro unita'
   * per parte e la linea resta dove sta, al centro esatto.
   */
  if (spread === 0) {
    const half = unitStep * 4;
    return {
      min: round(dataMin - half),
      max: round(dataMax + half),
      step: unitStep,
      tickCount: 5,
      flat: true,
    };
  }

  const pad = Math.max(spread * 0.08, unitStep);
  const low = dataMin - pad;
  const high = dataMax + pad;

  let chosen = fit(low, high, TICK_STEPS[0]);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const step of TICK_STEPS) {
    const candidate = fit(low, high, step);
    if (candidate.tickCount >= TICK_MIN && candidate.tickCount <= TICK_MAX) {
      return { ...candidate, flat: false };
    }
    // Nessun passo centra la finestra: si tiene quello che ci va piu' vicino.
    const distance = Math.abs(candidate.tickCount - (TICK_MIN + TICK_MAX) / 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      chosen = candidate;
    }
  }

  return { ...chosen, flat: false };
}

function fit(low: number, high: number, step: number) {
  const min = round(Math.floor(low / step) * step);
  const max = round(Math.ceil(high / step) * step);
  return {
    min,
    max,
    step,
    tickCount: Math.round((max - min) / step) + 1,
  };
}

/**
 * Le grandezze cumulative partono da zero, sempre, e il tetto respira dell'8% cosi'
 * il punto piu' alto non tocca il bordo. Nessuna eccezione: e' il dominio di `VolumeBars`
 * ed e' il motivo per cui quel componente non cambia.
 */
export function zeroDomain(values: readonly number[]): [number, number] {
  let dataMax = 0;
  for (const value of values) {
    if (Number.isFinite(value) && value > dataMax) dataMax = value;
  }
  return [0, round(dataMax * 1.08)];
}

/** I float di IndexedDB sommati a mano producono 80.30000000000001: qui si fermano. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
