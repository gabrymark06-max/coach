import { describe, expect, it } from "vitest";
import { startTimer, remainingSeconds, extendTimer } from "./timer";

describe("timer a timestamp (verifica #26: mai contare tick)", () => {
  it("il residuo dipende solo da adesso e da end_at", () => {
    const t = startTimer(90, 1_000_000);
    expect(t.end_at).toBe(1_090_000);
    expect(remainingSeconds(t, 1_000_000)).toBe(90);
    expect(remainingSeconds(t, 1_045_500)).toBe(45);
    expect(remainingSeconds(t, 1_200_000)).toBe(0);
  });
  it("+30 sposta la fine, non il conteggio", () => {
    const t = extendTimer(startTimer(90, 0), 30);
    expect(t.end_at).toBe(120_000);
    expect(t.total_s).toBe(120);
  });
  it("arrotonda per eccesso: a 0,4 s dalla fine mostra 1", () => {
    const t = startTimer(10, 0);
    expect(remainingSeconds(t, 9_600)).toBe(1);
  });
});
