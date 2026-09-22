import { describe, expect, it } from "vitest";
import { solvePlates, type PlateInventory } from "./plates";

/** Palestra ben fornita. */
const FULL: PlateInventory = {
  20: 8,
  15: 2,
  10: 4,
  5: 4,
  2.5: 4,
  1.25: 4,
};

describe("solvePlates — combinazioni esatte", () => {
  it("100 kg su bilanciere da 20 sono due dischi da 20 per lato", () => {
    const result = solvePlates(100, 20, FULL);
    expect(result.status).toBe("exact");
    expect(result.best?.perSide).toEqual([{ kg: 20, count: 2 }]);
    expect(result.best?.perSideKg).toBe(40);
    expect(result.best?.totalKg).toBe(100);
    expect(result.best?.deltaKg).toBe(0);
  });

  it("102,5 kg chiudono con un disco da 1,25 per lato", () => {
    const result = solvePlates(102.5, 20, FULL);
    expect(result.status).toBe("exact");
    expect(result.best?.perSide).toEqual([
      { kg: 20, count: 2 },
      { kg: 1.25, count: 1 },
    ]);
    expect(result.best?.totalKg).toBe(102.5);
  });

  it("usa il minor numero di dischi possibile", () => {
    // 60 kg → 20 per lato: un disco da 20, non due da 10
    const result = solvePlates(60, 20, FULL);
    expect(result.best?.perSide).toEqual([{ kg: 20, count: 1 }]);
  });

  it("rispetta un bilanciere non standard", () => {
    // EZ bar da 7,5 kg + 10 per lato
    const result = solvePlates(27.5, 7.5, FULL);
    expect(result.status).toBe("exact");
    expect(result.best?.perSide).toEqual([{ kg: 10, count: 1 }]);
    expect(result.best?.totalKg).toBe(27.5);
  });
});

describe("solvePlates — inventario limitato", () => {
  it("trova la combinazione esatta anche quando il disco piu' pesante non ci sta", () => {
    // 20 kg per lato con un solo 15 e due 10: la risposta e' 10+10, non "15 e mi arrendo"
    const inventory: PlateInventory = { 20: 0, 15: 1, 10: 2, 5: 0, 2.5: 0, 1.25: 0 };
    const result = solvePlates(60, 20, inventory);
    expect(result.status).toBe("exact");
    expect(result.best?.perSide).toEqual([{ kg: 10, count: 2 }]);
  });

  it("senza dischi si carica solo il bilanciere e lo dice", () => {
    const empty: PlateInventory = { 20: 0, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0 };
    const result = solvePlates(100, 20, empty);
    expect(result.status).toBe("inexact");
    expect(result.best?.perSide).toEqual([]);
    expect(result.best?.totalKg).toBe(20);
    expect(result.best?.deltaKg).toBe(-80);
  });
});

describe("solvePlates — quando non si compone esattamente lo dice", () => {
  it("101 kg non si compongono: offre il piu' vicino e l'alternativa", () => {
    const result = solvePlates(101, 20, FULL);
    expect(result.status).toBe("inexact");
    // per lato servirebbero 40,5 kg: sotto 40 (100 kg), sopra 41,25 (102,5 kg)
    expect(result.below?.totalKg).toBe(100);
    expect(result.below?.deltaKg).toBe(-1);
    expect(result.above?.totalKg).toBe(102.5);
    expect(result.above?.deltaKg).toBe(1.5);
    // il piu' vicino e' quello per difetto
    expect(result.best?.totalKg).toBe(100);
  });

  it("a parita' di distanza propone quello per eccesso", () => {
    // 116,25 per lato 48,125 → sotto 47,5 (115), sopra 48,75 (117,5): entrambi a 1,25
    const result = solvePlates(116.25, 20, FULL);
    expect(result.status).toBe("inexact");
    expect(result.best?.totalKg).toBe(117.5);
    expect(result.best?.deltaKg).toBe(1.25);
  });

  it("con inventario esaurito il piu' vicino resta sotto il target", () => {
    const inventory: PlateInventory = { 20: 1, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0 };
    const result = solvePlates(100, 20, inventory);
    expect(result.status).toBe("inexact");
    expect(result.best?.totalKg).toBe(60);
    expect(result.best?.deltaKg).toBe(-40);
  });
});

describe("solvePlates — casi limite", () => {
  it("il target uguale al bilanciere non chiede dischi", () => {
    const result = solvePlates(20, 20, FULL);
    expect(result.status).toBe("bar-only");
    expect(result.best?.perSide).toEqual([]);
    expect(result.best?.totalKg).toBe(20);
  });

  it("un target sotto il bilanciere non e' un errore di calcolo, e' un limite fisico", () => {
    const result = solvePlates(15, 20, FULL);
    expect(result.status).toBe("below-bar");
    expect(result.best).toBeNull();
  });
});

describe("solvePlates — rimozione manuale di un disco", () => {
  it("ricalcolare senza un disco da 20 cambia la combinazione", () => {
    const result = solvePlates(100, 20, { ...FULL, 20: 1 });
    expect(result.status).toBe("exact");
    expect(result.best?.perSide).toEqual([
      { kg: 20, count: 1 },
      { kg: 15, count: 1 },
      { kg: 5, count: 1 },
    ]);
  });
});
