import { describe, expect, it } from "vitest";
import { levelDomain, zeroDomain } from "./chart-domain";

describe("levelDomain — il caso che ha aperto QA GRAVE 2", () => {
  it("due pesate a 82,4 e 81,2 non diventano una riga orizzontale", () => {
    const domain = levelDomain([82.4, 81.2], 0.5);
    expect(domain).not.toBeNull();
    // l'asse sta intorno al dato, non a zero
    expect(domain!.min).toBeGreaterThan(79);
    expect(domain!.max).toBeLessThan(85);
    // e i due punti ci stanno dentro con un margine
    expect(domain!.min).toBeLessThan(81.2);
    expect(domain!.max).toBeGreaterThan(82.4);
    expect(domain!.flat).toBe(false);
  });

  it("l'1RM fra 66 e 138 non lascia mezzo grafico vuoto", () => {
    // Prima: asse 0-140, i dati occupavano dal 47% al 99% dell'altezza.
    const domain = levelDomain([66, 92, 104, 138], 0.5)!;
    expect(domain.min).toBeGreaterThan(0);
    const occupato = (138 - 66) / (domain.max - domain.min);
    expect(occupato).toBeGreaterThan(0.6);
  });

  it("tiene 4-6 tick, che e' il numero che si legge a colpo d'occhio", () => {
    const serie: number[][] = [
      [82.4, 81.2],
      [66, 92, 104, 138],
      [17.2, 17.4, 17.1],
      [100, 102.5, 105, 107.5],
      [40, 41],
    ];
    for (const valori of serie) {
      const domain = levelDomain(valori, 0.5)!;
      expect(domain.tickCount, JSON.stringify(valori)).toBeGreaterThanOrEqual(4);
      expect(domain.tickCount, JSON.stringify(valori)).toBeLessThanOrEqual(6);
    }
  });

  it("gli estremi cadono su multipli esatti del passo", () => {
    const domain = levelDomain([82.4, 81.2], 0.5)!;
    expect(Math.abs(domain.min / domain.step - Math.round(domain.min / domain.step))).toBeLessThan(
      1e-9,
    );
    expect(Math.abs(domain.max / domain.step - Math.round(domain.max / domain.step))).toBeLessThan(
      1e-9,
    );
  });

  it("niente code decimali dalla somma dei float", () => {
    const domain = levelDomain([80.1, 80.7], 0.5)!;
    expect(String(domain.min)).not.toMatch(/\d{6,}/);
    expect(String(domain.max)).not.toMatch(/\d{6,}/);
  });
});

describe("levelDomain — escursione zero", () => {
  it("tutti i punti uguali aprono l'asse di quattro unita' per parte", () => {
    const domain = levelDomain([80, 80, 80], 0.5)!;
    expect(domain.flat).toBe(true);
    expect(domain.min).toBe(78);
    expect(domain.max).toBe(82);
  });

  it("la linea resta al centro esatto", () => {
    const domain = levelDomain([17.5], 0.5)!;
    expect((domain.min + domain.max) / 2).toBeCloseTo(17.5, 10);
  });

  it("una circonferenza sola non si stringe a un centimetro", () => {
    const domain = levelDomain([38], 0.5)!;
    expect(domain.max - domain.min).toBe(4);
  });
});

describe("levelDomain — niente dati", () => {
  it("senza valori non c'e' dominio, e lo dice", () => {
    expect(levelDomain([], 0.5)).toBeNull();
  });

  it("i valori non finiti si ignorano invece di avvelenare l'asse", () => {
    const domain = levelDomain([Number.NaN, 81.2, 82.4, Number.POSITIVE_INFINITY], 0.5)!;
    expect(Number.isFinite(domain.min)).toBe(true);
    expect(Number.isFinite(domain.max)).toBe(true);
  });
});

describe("zeroDomain — le grandezze cumulative", () => {
  it("parte da zero e non ci pensa due volte", () => {
    expect(zeroDomain([3685, 4120, 2900])[0]).toBe(0);
  });

  it("lascia respirare il massimo invece di farlo toccare il bordo", () => {
    const [, max] = zeroDomain([100]);
    expect(max).toBeGreaterThan(100);
  });

  it("una lista vuota non produce un asse rovesciato", () => {
    const [min, max] = zeroDomain([]);
    expect(min).toBe(0);
    expect(max).toBe(0);
  });
});
