import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, logError } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeError — l'errore arriva all'utente con qualcosa da fare", () => {
  it("lo spazio esaurito si chiama spazio esaurito, e dice come uscirne", () => {
    const quota = new DOMException("quota", "QuotaExceededError");
    const testo = describeError(quota);
    expect(testo).toMatch(/spazio/i);
    expect(testo).toMatch(/esporta/i);
  });

  it("il database che non risponde propone di ricaricare, non di cambiare telefono", () => {
    const chiuso = Object.assign(new Error("db closed"), { name: "DatabaseClosedError" });
    const testo = describeError(chiuso);
    expect(testo).toMatch(/database/i);
    expect(testo).toMatch(/ricarica/i);
    expect(testo).not.toMatch(/dispositivo/i);
  });

  it("un difetto dell'app si dichiara difetto dell'app e porta il nome tecnico", () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'sets')");
    const testo = describeError(bug);
    expect(testo).toMatch(/TypeError/);
    // non incolpa il dispositivo dell'utente per un difetto nostro (QA, secondo audit)
    expect(testo).not.toMatch(/questo dispositivo/i);
  });

  it("non lascia mai la frase vuota, nemmeno se l'errore non e' un errore", () => {
    expect(describeError(undefined).trim().length).toBeGreaterThan(0);
    expect(describeError("boom").trim().length).toBeGreaterThan(0);
  });
});

describe("logError — quello che l'utente non vede resta nei log", () => {
  it("scrive l'errore con il punto dell'app da cui viene", () => {
    const spia = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bug = new TypeError("boom");
    logError("trainer/azione", bug);
    expect(spia).toHaveBeenCalledTimes(1);
    expect(String(spia.mock.calls[0][0])).toContain("trainer/azione");
    expect(spia.mock.calls[0][1]).toBe(bug);
  });
});
