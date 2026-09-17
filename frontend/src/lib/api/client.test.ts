import { describe, expect, it } from "vitest";
import { ApiError, formatRetryAfter, parseRetryAfter } from "./client";

describe("Retry-After (contratto v1.1.2 §17.5)", () => {
  it("legge i secondi interi e ignora la forma data HTTP", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter(" 7 ")).toBe(7);
    expect(parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
  });

  it("scrive i secondi sotto il minuto e i minuti sopra", () => {
    expect(formatRetryAfter(1)).toBe("1 secondo");
    expect(formatRetryAfter(30)).toBe("30 secondi");
    expect(formatRetryAfter(60)).toBe("1 minuto");
    expect(formatRetryAfter(150)).toBe("3 minuti");
  });

  it("un 429 con Retry-After dice quando riprovare, senza ripetere 'riprova'", () => {
    const e = new ApiError(429, { code: "rate_limited", detail: "Troppe richieste in poco tempo. Aspetta un attimo e riprova." }, { retryAfter: 42 });
    expect(e.detail).toBe("Troppe richieste in poco tempo. Riprova tra 42 secondi.");
    expect(e.retryAfter).toBe(42);
  });

  it("un 429 senza Retry-After tiene il detail del server", () => {
    const e = new ApiError(429, { code: "rate_limited", detail: "Troppe richieste in poco tempo. Aspetta un attimo e riprova." });
    expect(e.detail).toBe("Troppe richieste in poco tempo. Aspetta un attimo e riprova.");
    expect(e.retryAfter).toBeNull();
  });
});

describe("500 del server (contratto v1.1.2 §17.2)", () => {
  it("è un errore del server con detail e request id, non 'senza rete'", () => {
    const e = new ApiError(500, { code: "internal_error", detail: "Errore dalla nostra parte, non tua. Riprova tra un minuto." }, { requestId: "req-abc" });
    expect(e.code).toBe("internal_error");
    expect(e.isOffline).toBe(false);
    expect(e.requestId).toBe("req-abc");
    expect(e.detail).not.toMatch(/senza rete/i);
  });

  it("solo lo status 0 è 'senza rete'", () => {
    const e = new ApiError(0, null);
    expect(e.isOffline).toBe(true);
    expect(e.code).toBe("network");
  });
});
