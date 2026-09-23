import { describe, expect, it } from "vitest";
import {
  formatDurationLong,
  formatExerciseCount,
  formatSessionCount,
  formatSetCount,
  formatWeekCount,
} from "./format";

/**
 * QA MINORE 2 — gli accordi italiani non erano mai gestiti al singolare, e chi apre
 * l'app la prima settimana leggeva «1 allenamenti», «1 serie completate», «su 1
 * settimane». Sono le tre frasi che un utente nuovo vede *per prime*.
 */
describe("accordi al singolare", () => {
  it("un allenamento e' un allenamento", () => {
    expect(formatSessionCount(0)).toBe("0 allenamenti");
    expect(formatSessionCount(1)).toBe("1 allenamento");
    expect(formatSessionCount(2)).toBe("2 allenamenti");
    expect(formatSessionCount(214)).toBe("214 allenamenti");
  });

  it("una serie completata non e' «1 serie completate»", () => {
    expect(formatSetCount(1, "completata")).toBe("1 serie completata");
    expect(formatSetCount(3, "completata")).toBe("3 serie completate");
    expect(formatSetCount(0, "completata")).toBe("0 serie completate");
  });

  it("una settimana e' una settimana", () => {
    expect(formatWeekCount(1)).toBe("1 settimana");
    expect(formatWeekCount(8)).toBe("8 settimane");
  });

  it("un esercizio resta un esercizio", () => {
    expect(formatExerciseCount(1)).toBe("1 esercizio");
    expect(formatExerciseCount(4)).toBe("4 esercizi");
  });
});

/**
 * QA MINORE 3 — «TEMPO IN PALESTRA 12000 min». `formatMinutes` va bene sulla durata di
 * una sessione, non sul totale di una vita.
 */
describe("formatDurationLong — la scala che rolla", () => {
  const MIN = 60_000;
  /** §11.3: fra numero e unita' ci va lo spazio stretto, che non manda a capo. */
  const S = " ";

  it("sotto l'ora resta ai minuti", () => {
    expect(formatDurationLong(48 * MIN)).toBe(`48${S}min`);
    expect(formatDurationLong(0)).toBe(`0${S}min`);
  });

  it("dall'ora in su passa alle ore, con i minuti finche' servono", () => {
    expect(formatDurationLong(90 * MIN)).toBe(`1${S}h 30${S}min`);
    expect(formatDurationLong(120 * MIN)).toBe(`2${S}h`);
  });

  it("non dice mai 12000 min", () => {
    expect(formatDurationLong(12_000 * MIN)).toBe(`8${S}g 8${S}h`);
  });

  it("oltre il giorno mostra giorni e ore, non tre unita'", () => {
    expect(formatDurationLong(25 * 60 * MIN)).toBe(`1${S}g 1${S}h`);
    expect(formatDurationLong(48 * 60 * MIN)).toBe(`2${S}g`);
  });

  it("una durata negativa non produce un segno meno a schermo", () => {
    expect(formatDurationLong(-5000)).toBe(`0${S}min`);
  });
});
