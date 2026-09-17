import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announce, resetAnnouncements } from "./announce";

// Un documento finto con la sola regione #annunci: basta per osservare cosa legge lo screen reader e quando.
const region = { textContent: "" };

describe("annunci in coda (QA M3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    region.textContent = "";
    vi.stubGlobal("document", { getElementById: (id: string) => (id === "annunci" ? region : null) });
    vi.stubGlobal("window", { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      cb(0);
      return 0;
    });
    resetAnnouncements();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("due annunci nello stesso giro si leggono entrambi, in ordine", () => {
    announce("Il coach ha risposto");
    announce("Ti restano 3 messaggi questo mese.");
    expect(region.textContent).toBe("Il coach ha risposto");
    vi.advanceTimersByTime(1500);
    expect(region.textContent).toBe("Ti restano 3 messaggi questo mese.");
  });

  it("un annuncio isolato parte subito, anche dopo un altro già letto", () => {
    announce("Serie 1 fatta. Riposo: 90 secondi.");
    expect(region.textContent).toBe("Serie 1 fatta. Riposo: 90 secondi.");
    vi.advanceTimersByTime(2000);
    announce("Riposo finito");
    expect(region.textContent).toBe("Riposo finito");
  });
});
