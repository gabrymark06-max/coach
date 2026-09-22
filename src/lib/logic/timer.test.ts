import { describe, expect, it } from "vitest";
import {
  elapsedSessionMs,
  formatCountdown,
  formatMinutes,
  formatStopwatch,
  restPhase,
  restRemainingMs,
} from "./timer";

const T0 = "2026-09-22T18:00:00.000Z";
const at = (seconds: number) => Date.parse(T0) + seconds * 1000;

describe("restRemainingMs — si ricalcola dall'orologio, non dal tick", () => {
  const timer = { startedAt: T0, durationSec: 90, pausedAt: null, pausedMs: 0 };

  it("dopo 2 secondi mancano 88 secondi", () => {
    expect(restRemainingMs(timer, at(2))).toBe(88_000);
  });

  it("dopo un'assenza di 60 secondi in background il conto e' comunque giusto", () => {
    expect(restRemainingMs(timer, at(62))).toBe(28_000);
  });

  it("non scende sotto zero", () => {
    expect(restRemainingMs(timer, at(3600))).toBe(0);
  });

  it("senza timer avviato non c'e' un residuo", () => {
    expect(
      restRemainingMs({ startedAt: null, durationSec: null, pausedAt: null, pausedMs: 0 }, at(10)),
    ).toBeNull();
  });

  it("in pausa il residuo si congela all'istante della pausa", () => {
    const paused = {
      startedAt: T0,
      durationSec: 90,
      pausedAt: new Date(at(30)).toISOString(),
      pausedMs: 0,
    };
    expect(restRemainingMs(paused, at(300))).toBe(60_000);
  });

  it("la pausa gia' consumata si somma al tempo disponibile", () => {
    const resumed = { startedAt: T0, durationSec: 90, pausedAt: null, pausedMs: 20_000 };
    expect(restRemainingMs(resumed, at(50))).toBe(60_000);
  });
});

describe("restPhase", () => {
  const timer = { startedAt: T0, durationSec: 90, pausedAt: null, pausedMs: 0 };

  it("e' inattivo senza timer", () => {
    expect(
      restPhase({ startedAt: null, durationSec: null, pausedAt: null, pausedMs: 0 }, at(0)),
    ).toBe("idle");
  });

  it("e' in corso all'inizio", () => {
    expect(restPhase(timer, at(5))).toBe("running");
  });

  it("entra in allarme negli ultimi 10 secondi", () => {
    expect(restPhase(timer, at(80))).toBe("warning");
    expect(restPhase(timer, at(79.5))).toBe("running");
  });

  it("e' scaduto quando il residuo e' zero", () => {
    expect(restPhase(timer, at(90))).toBe("expired");
  });

  it("e' in pausa quando e' in pausa, anche negli ultimi 10 secondi", () => {
    const paused = {
      startedAt: T0,
      durationSec: 90,
      pausedAt: new Date(at(85)).toISOString(),
      pausedMs: 0,
    };
    expect(restPhase(paused, at(200))).toBe("paused");
  });
});

describe("elapsedSessionMs", () => {
  it("conta dal via", () => {
    expect(elapsedSessionMs({ startedAt: T0, pausedMs: 0, pausedAt: null }, at(125))).toBe(
      125_000,
    );
  });

  it("toglie le pause accumulate", () => {
    expect(elapsedSessionMs({ startedAt: T0, pausedMs: 25_000, pausedAt: null }, at(125))).toBe(
      100_000,
    );
  });

  it("si ferma mentre la sessione e' in pausa", () => {
    const paused = { startedAt: T0, pausedMs: 0, pausedAt: new Date(at(60)).toISOString() };
    expect(elapsedSessionMs(paused, at(600))).toBe(60_000);
  });

  it("su una sessione conclusa usa la fine, non l'ora attuale", () => {
    const ended = {
      startedAt: T0,
      pausedMs: 0,
      pausedAt: null,
      endedAt: new Date(at(2880)).toISOString(),
    };
    expect(elapsedSessionMs(ended, at(99_999))).toBe(2_880_000);
  });
});

describe("formattazione del tempo (§5.5)", () => {
  it("il cronometro e' 0:48:12", () => {
    expect(formatStopwatch(2_892_000)).toBe("0:48:12");
  });

  it("il cronometro regge le ore", () => {
    expect(formatStopwatch(3_723_000)).toBe("1:02:03");
  });

  it("il conto alla rovescia e' 1:28", () => {
    expect(formatCountdown(88_000)).toBe("1:28");
  });

  it("il conto alla rovescia arrotonda per eccesso: a 87,4 secondi mostra ancora 1:28", () => {
    expect(formatCountdown(87_400)).toBe("1:28");
  });

  it("il conto alla rovescia finisce a 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("la sintesi e' in minuti, con lo spazio che non spezza il numero dall'unita'", () => {
    expect(formatMinutes(2_892_000)).toBe("48 min");
  });
});
