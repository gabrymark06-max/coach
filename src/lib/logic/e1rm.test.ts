import { describe, expect, it } from "vitest";
import { bestE1rm, estimate1RM } from "./e1rm";

describe("estimate1RM — Epley", () => {
  it("100 kg per 5 danno 116,67 kg", () => {
    expect(estimate1RM(100, 5, "epley")).toBe(116.67);
  });

  it("80 kg per 8 danno 101,33 kg", () => {
    expect(estimate1RM(80, 8, "epley")).toBe(101.33);
  });

  it("a una ripetizione il massimale e' il peso stesso", () => {
    expect(estimate1RM(120, 1, "epley")).toBe(120);
  });
});

describe("estimate1RM — Brzycki", () => {
  it("100 kg per 5 danno 112,5 kg", () => {
    expect(estimate1RM(100, 5, "brzycki")).toBe(112.5);
  });

  it("80 kg per 8 danno 99,31 kg", () => {
    expect(estimate1RM(80, 8, "brzycki")).toBe(99.31);
  });

  it("a una ripetizione il massimale e' il peso stesso", () => {
    expect(estimate1RM(120, 1, "brzycki")).toBe(120);
  });

  it("oltre le 36 ripetizioni la formula non e' definita e non si inventa un numero", () => {
    expect(estimate1RM(40, 37, "brzycki")).toBeNull();
    expect(estimate1RM(40, 50, "brzycki")).toBeNull();
  });
});

describe("estimate1RM — ingressi che non producono una stima", () => {
  it("senza peso non c'e' stima", () => {
    expect(estimate1RM(null, 8, "epley")).toBeNull();
    expect(estimate1RM(0, 8, "epley")).toBeNull();
  });

  it("senza ripetizioni non c'e' stima", () => {
    expect(estimate1RM(80, null, "epley")).toBeNull();
    expect(estimate1RM(80, 0, "epley")).toBeNull();
  });
});

describe("bestE1rm", () => {
  it("prende la serie migliore, non l'ultima", () => {
    const best = bestE1rm(
      [
        { weightKg: 100, reps: 5 },
        { weightKg: 120, reps: 1 },
        { weightKg: 90, reps: 8 },
      ],
      "epley",
    );
    expect(best).toEqual({ value: 120, weightKg: 120, reps: 1 });
  });

  it("su una lista senza serie valide non restituisce niente", () => {
    expect(bestE1rm([{ weightKg: null, reps: 10 }], "epley")).toBeNull();
    expect(bestE1rm([], "epley")).toBeNull();
  });
});
