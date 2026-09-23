import { describe, expect, it } from "vitest";
import {
  addMonths,
  formatMonthKey,
  initialFocusDay,
  monthGrid,
  moveFocus,
  parseMonthKey,
} from "./calendar";

const SETTEMBRE_2026 = { year: 2026, month: 9 };

describe("monthGrid", () => {
  it("la settimana comincia di lunedì e la griglia e' sempre di sei righe", () => {
    const grid = monthGrid(SETTEMBRE_2026);
    expect(grid).toHaveLength(42);
    // 1 settembre 2026 e' un martedì: la griglia si apre con il 31 agosto
    expect(grid[0]).toMatchObject({ day: "2026-08-31", inMonth: false });
    expect(grid[1]).toMatchObject({ day: "2026-09-01", inMonth: true });
  });

  it("sei righe anche quando cinque basterebbero: il calendario non cambia altezza", () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(monthGrid({ year: 2026, month })).toHaveLength(42);
    }
  });

  it("i giorni fuori dal mese sono marcati, non nascosti", () => {
    const grid = monthGrid({ year: 2026, month: 2 });
    const dentro = grid.filter((cell) => cell.inMonth);
    expect(dentro).toHaveLength(28);
    expect(grid.some((cell) => !cell.inMonth)).toBe(true);
  });

  it("regge l'anno bisestile", () => {
    const dentro = monthGrid({ year: 2028, month: 2 }).filter((cell) => cell.inMonth);
    expect(dentro).toHaveLength(29);
  });
});

describe("il mese nella query string", () => {
  it("si scrive come 2026-09", () => {
    expect(formatMonthKey(SETTEMBRE_2026)).toBe("2026-09");
  });

  it("una query string rotta ricade sul mese di partenza invece di esplodere", () => {
    expect(parseMonthKey("settembre", SETTEMBRE_2026)).toEqual(SETTEMBRE_2026);
    expect(parseMonthKey("2026-13", SETTEMBRE_2026)).toEqual(SETTEMBRE_2026);
    expect(parseMonthKey(null, SETTEMBRE_2026)).toEqual(SETTEMBRE_2026);
  });

  it("una query string valida vince sul mese di partenza", () => {
    expect(parseMonthKey("2025-01", SETTEMBRE_2026)).toEqual({ year: 2025, month: 1 });
  });
});

describe("addMonths", () => {
  it("scavalca l'anno nei due versi", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("moveFocus — la tastiera del calendario (§4.27)", () => {
  it("le frecce orizzontali muovono di un giorno", () => {
    expect(moveFocus("2026-09-12", "next-day")).toBe("2026-09-13");
    expect(moveFocus("2026-09-12", "prev-day")).toBe("2026-09-11");
  });

  it("le frecce verticali muovono di una settimana", () => {
    expect(moveFocus("2026-09-12", "next-week")).toBe("2026-09-19");
    expect(moveFocus("2026-09-12", "prev-week")).toBe("2026-09-05");
  });

  it("Home e End vanno all'inizio e alla fine della settimana, lunedì-domenica", () => {
    // 2026-09-12 e' un sabato
    expect(moveFocus("2026-09-12", "week-start")).toBe("2026-09-07");
    expect(moveFocus("2026-09-12", "week-end")).toBe("2026-09-13");
  });

  it("uscire dal mese con le frecce porta nel mese accanto", () => {
    expect(moveFocus("2026-09-01", "prev-day")).toBe("2026-08-31");
    expect(moveFocus("2026-09-30", "next-day")).toBe("2026-10-01");
  });

  it("PagSu e PagGiù cambiano mese tenendo il giorno", () => {
    expect(moveFocus("2026-09-12", "prev-month")).toBe("2026-08-12");
    expect(moveFocus("2026-09-12", "next-month")).toBe("2026-10-12");
  });

  it("il 31 gennaio più un mese non diventa il 3 marzo", () => {
    expect(moveFocus("2026-01-31", "next-month")).toBe("2026-02-28");
  });
});

describe("initialFocusDay — una sola cella nel tab order", () => {
  const oggi = new Date(2026, 8, 21); // 21 settembre 2026

  it("se oggi e' nel mese in vista, e' oggi", () => {
    expect(initialFocusDay(SETTEMBRE_2026, ["2026-09-08"], oggi)).toBe("2026-09-21");
  });

  it("altrimenti il primo giorno allenato", () => {
    expect(
      initialFocusDay({ year: 2026, month: 7 }, ["2026-07-19", "2026-07-03"], oggi),
    ).toBe("2026-07-03");
  });

  it("e se il mese e' vuoto, il giorno 1", () => {
    expect(initialFocusDay({ year: 2026, month: 7 }, [], oggi)).toBe("2026-07-01");
  });
});
