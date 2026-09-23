import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/db/library";
import { PATTERNS, patternOf, PATTERN_LABEL } from "./patterns";

describe("patternOf", () => {
  it("riconosce le due direzioni della spinta, che il gruppo muscolare da solo confonde", () => {
    // Panca e lento avanti sono due pattern diversi anche quando allenano lo stesso
    // muscolo secondario: un giorno di spinta che li tratta come intercambiabili
    // propone due panche e nessuna spinta sopra la testa.
    expect(patternOf(byId("lib-panca-piana-barbell"))).toBe("spinta-orizzontale");
    expect(patternOf(byId("lib-overhead-press-barbell"))).toBe("spinta-verticale");
  });

  it("riconosce le due direzioni della trazione", () => {
    expect(patternOf(byId("lib-pull-up-bodyweight"))).toBe("trazione-verticale");
    expect(patternOf(byId("lib-rematore-bilanciere-barbell"))).toBe("trazione-orizzontale");
  });

  it("mette lo stacco fra i femorali, non fra le trazioni", () => {
    // E' classificato `back` in libreria perche' li' si sente, ma nel programma occupa
    // lo slot della cerniera d'anca: metterlo con i rematori produrrebbe un giorno di
    // dorso con due stacchi e nessun femorale.
    expect(patternOf(byId("lib-stacco-barbell"))).toBe("femorali");
    expect(patternOf(byId("lib-stacco-rumeno-barbell"))).toBe("femorali");
  });

  it("separa bicipiti e tricipiti dentro «braccia»", () => {
    expect(patternOf(byId("lib-bicep-curl-barbell"))).toBe("bicipiti");
    expect(patternOf(byId("lib-tricep-pushdown-con-barra-dritta-cable"))).toBe("tricipiti");
  });

  it("assegna un pattern a ogni voce della libreria", () => {
    // La garanzia che serve al generatore: nessun esercizio resta fuori dalla
    // classificazione e quindi invisibile a tutti gli slot.
    const senzaPattern = LIBRARY.filter((row) => !PATTERNS.includes(patternOf(row)));
    expect(senzaPattern.map((row) => row.name)).toEqual([]);
  });

  it("ha un'etichetta italiana per ogni pattern", () => {
    for (const pattern of PATTERNS) {
      expect(PATTERN_LABEL[pattern].length).toBeGreaterThan(0);
    }
  });
});

function byId(id: string) {
  const row = LIBRARY.find((item) => item.id === id);
  if (!row) throw new Error(`manca ${id} in libreria`);
  return row;
}
