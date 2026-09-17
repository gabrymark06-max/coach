import { describe, expect, it } from "vitest";
import type { Prices } from "@/lib/api/types";
import { priceLine, priceOf } from "./prices";

const listino: Prices = {
  currency: "EUR",
  vat_included: true,
  prices: [
    { key: "month", interval: "month", amount_cents: 999, amount_eur: 9.99, per_month_eur: 9.99, label_it: "Mensile", available: true },
    { key: "year", interval: "year", amount_cents: 5999, amount_eur: 59.99, per_month_eur: 5.0, label_it: "Annuale", available: true },
    { key: "year_founders", interval: "year", amount_cents: 4999, amount_eur: 49.99, per_month_eur: 4.17, label_it: "Annuale fondatori", available: false },
  ],
  founders: { available: false, remaining: 0 },
};

describe("listino (contratto §9, v1.1.3)", () => {
  it("trova il prezzo per chiave, anche quando non è disponibile", () => {
    expect(priceOf(listino, "month")?.amount_eur).toBe(9.99);
    expect(priceOf(listino, "year_founders")?.available).toBe(false);
    expect(priceOf(null, "month")).toBeNull();
  });

  it("la riga per la meta description usa i numeri dell'API, e senza API resta onesta", () => {
    expect(priceLine(listino)).toBe("poi 9,99 €/mese o 59,99 €/anno, IVA inclusa");
    expect(priceLine(null)).toBe("poi un piano Pro mensile o annuale, IVA inclusa");
    expect(priceLine(null)).not.toMatch(/\d/);
  });
});
