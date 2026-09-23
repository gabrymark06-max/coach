import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/db/schema";
import { solvePlates, toPlateInventory, type PlateInventory } from "./plates";

/**
 * Palestra ben fornita, **per lato**: `PlateInventory` e' il budget di un lato solo,
 * ed e' cio' che la DP consuma. Quello che l'utente dichiara in Impostazioni e' invece
 * il totale — la conversione sta in `toPlateInventory` ed e' verificata piu' sotto.
 */
const FULL: PlateInventory = {
  20: 4,
  15: 1,
  10: 2,
  5: 2,
  2.5: 2,
  1.25: 2,
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
    // Dichiarati in tutto: due dischi da 15 e quattro da 10 → per lato 15×1 e 10×2.
    // Per fare 20 kg per lato la risposta e' 10+10, non "15 e mi arrendo".
    const inventory = toPlateInventory({
      "20": 0,
      "15": 2,
      "10": 4,
      "5": 0,
      "2.5": 0,
      "1.25": 0,
    });
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

/**
 * QA GRAVE 1: l'inventario era **raccolto come totale** e **consumato come per lato**,
 * cioe' con un fattore 2 di troppo su ogni disco. Il verso giusto e' quello della copy
 * di Impostazioni — «Quanti ne hai in tutto, non per lato» — perche' nessuno conta i
 * dischi a mezze coppie: si guarda il rastrelliere e si dice un numero.
 */
describe("toPlateInventory — si dichiara il totale, si carica per lato", () => {
  const zero = { "20": 0, "15": 0, "10": 0, "5": 0, "2.5": 0, "1.25": 0 };

  it("due dischi da 20 in tutto sono uno solo per lato", () => {
    const inventory = toPlateInventory({ ...zero, "20": 2 });
    expect(inventory[20]).toBe(1);

    // 100 kg vorrebbero 2 dischi da 20 per lato, cioe' 4 in tutto: non ci sono.
    const result = solvePlates(100, 20, inventory);
    expect(result.status).toBe("inexact");
    expect(result.best?.perSide).toEqual([{ kg: 20, count: 1 }]);
    expect(result.best?.totalKg).toBe(60);
  });

  it("un disco spaiato non si carica: tre da 10 in tutto valgono una coppia", () => {
    const inventory = toPlateInventory({ ...zero, "10": 3 });
    expect(inventory[10]).toBe(1);
  });

  it("l'inventario di fabbrica regge 100 kg e non promette l'impossibile", () => {
    const inventory = toPlateInventory(DEFAULT_SETTINGS.plateInventory);
    expect(inventory[20]).toBe(4);
    expect(solvePlates(100, 20, inventory).status).toBe("exact");
    // 4 da 20 per lato = 80 per lato = 180 kg: oltre, non ci sono piu' dischi grandi
    expect(solvePlates(300, 20, inventory).status).toBe("inexact");
  });

  it("una voce assente o assurda vale zero, non NaN", () => {
    const inventory = toPlateInventory({ "20": -4, "15": Number.NaN });
    expect(inventory[20]).toBe(0);
    expect(inventory[15]).toBe(0);
    expect(inventory[10]).toBe(0);
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
