import { describe, expect, it } from "vitest";
import { formatKg, formatRest, quotaLine, formatDayLabel, formatClock, formatRange, formatEuro } from "./format";

describe("formatKg", () => {
  it("usa la virgola per i decimali e nessun decimale inutile", () => {
    expect(formatKg(62.5)).toBe("62,5");
    expect(formatKg(60)).toBe("60");
    expect(formatKg(null)).toBe("—");
  });
});

describe("formatRest", () => {
  it("minuti interi con il primo, secondi con il doppio primo", () => {
    expect(formatRest(120)).toBe("2′");
    expect(formatRest(90)).toBe("90″");
    expect(formatRest(60)).toBe("1′");
    expect(formatRest(45)).toBe("45″");
  });
});

describe("formatRange", () => {
  it("rende un intervallo con il trattino en e un valore singolo così com'è", () => {
    expect(formatRange({ range: [8, 12] })).toBe("8–12");
    expect(formatRange({ value: 10 })).toBe("10");
  });
});

describe("formatClock", () => {
  it("m:ss con zero davanti ai secondi", () => {
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("quotaLine (design-system §2.4.4)", () => {
  const resets = "2026-09-30T22:00:00Z"; // 1° ottobre a Roma
  it("free con margine: messaggi rimasti", () => {
    expect(quotaLine({ used: 3, limit: 15, resets_at: resets, daily_used: null, daily_limit: null }, "free")).toEqual({
      text: "12 messaggi rimasti questo mese",
      band: "ok",
    });
  });
  it("free a 12-14 usati: avviso con la data di azzeramento", () => {
    expect(quotaLine({ used: 12, limit: 15, resets_at: resets, daily_used: null, daily_limit: null }, "free")).toEqual({
      text: "Ti restano 3 messaggi questo mese. Si azzerano il 1° ottobre.",
      band: "low",
    });
  });
  it("free a 15/15: esaurita", () => {
    expect(quotaLine({ used: 15, limit: 15, resets_at: resets, daily_used: null, daily_limit: null }, "free").band).toBe("exhausted");
  });
  it("pro: illimitati con uso ragionevole, contatore solo sotto i 5 giornalieri", () => {
    expect(quotaLine({ used: 10, limit: 300, resets_at: resets, daily_used: 2, daily_limit: 40 }, "pro").text).toBe(
      "Messaggi illimitati · uso ragionevole 300 al mese",
    );
    expect(quotaLine({ used: 10, limit: 300, resets_at: resets, daily_used: 35, daily_limit: 40 }, "pro").text).toBe(
      "Ti restano 5 messaggi oggi",
    );
  });
});

describe("formatDayLabel", () => {
  it("giorno e mese in italiano, maiuscolo lo fa il CSS", () => {
    expect(formatDayLabel("2026-09-16")).toBe("mercoledì 16 settembre");
  });
});

describe("formatEuro", () => {
  it("virgola e simbolo dopo", () => {
    expect(formatEuro(9.99)).toBe("9,99 €");
  });
});
