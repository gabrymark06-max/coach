import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/db/library";
import { DEFAULT_SETTINGS, type Exercise } from "@/lib/db/schema";
import type { TrainerProfile, TrainerProgram } from "@/lib/db/trainer-schema";
import { generateProgram } from "./generator";
import { programClock, programProgress, todayFocus } from "./clock";

const CATALOGO: Exercise[] = LIBRARY.map((row) => ({
  id: row.id,
  name: row.name,
  nameKey: row.id,
  muscleGroup: row.muscleGroup,
  secondaryMuscles: row.secondaryMuscles,
  equipment: row.equipment,
  isCustom: false,
  isBodyweight: row.isBodyweight,
  createdAt: "2026-01-01T00:00:00.000Z",
  family: row.family,
  variant: row.variant,
  mechanics: row.mechanics,
  unilateral: row.unilateral,
  loadMode: row.loadMode,
  stepKgOverride: row.stepKgOverride,
  popularity: row.popularity,
}));

const PROFILO: TrainerProfile = {
  id: "singleton",
  goal: "hypertrophy",
  gender: "man",
  environment: "gym",
  priorityMuscles: [],
  equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  level: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 60,
};

/** Lunedì 21 settembre 2026, mezzogiorno locale. */
const LUNEDI = new Date(2026, 8, 21, 12, 0, 0).toISOString();

function programma(): TrainerProgram {
  const result = generateProgram({
    profile: PROFILO,
    library: CATALOGO,
    settings: DEFAULT_SETTINGS,
    now: LUNEDI,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.program;
}

function il(giorno: number, mese = 8): string {
  return new Date(2026, mese, giorno, 12, 0, 0).toISOString();
}

describe("todayFocus — che cosa si vede nella card «Oggi»", () => {
  it("il giorno di oggi, quando oggi è previsto", () => {
    const focus = todayFocus(programma(), LUNEDI);
    expect(focus.kind).toBe("allenamento");
    if (focus.kind !== "allenamento") return;
    expect(focus.day.name).toContain("Giorno A");
    expect(focus.week.index).toBe(1);
  });

  it("riposo, con il prossimo allenamento nominato, quando oggi non è previsto", () => {
    // 4 giorni: lun, mar, gio, ven. Mercoledì 23 è riposo.
    const focus = todayFocus(programma(), il(23));
    expect(focus.kind).toBe("riposo");
    if (focus.kind !== "riposo") return;
    expect(focus.next?.day.name).toContain("Giorno C");
  });

  it("«già fatto» quando il giorno di oggi è chiuso", () => {
    const program = programma();
    program.weeks[0].days[0].status = "completata";
    program.weeks[0].days[0].sessionId = "s1";
    const focus = todayFocus(program, LUNEDI);
    expect(focus.kind).toBe("fatto");
  });

  it("non propone niente quando il programma è in pausa", () => {
    const program = { ...programma(), status: "paused" as const };
    expect(todayFocus(program, LUNEDI).kind).toBe("pausa");
  });
});

describe("programClock — il programma non avanza da solo sopra una settimana vuota", () => {
  it("resta nella settimana 1 finché la settimana 1 non è finita", () => {
    const clock = programClock(programma(), il(24));
    expect(clock.derivedWeek).toBe(1);
    expect(clock.awaitingChoice).toBe(false);
  });

  it("avanza alla settimana 2 se nella 1 si è allenato almeno una volta", () => {
    const program = programma();
    program.weeks[0].days[0].status = "completata";
    const clock = programClock(program, il(29));
    expect(clock.derivedWeek).toBe(2);
    expect(clock.skippedWeeks).toEqual([]);
  });

  it("si ferma e aspetta una scelta quando una settimana è passata a vuoto", () => {
    // nessun giorno completato e la settimana 1 è finita: §4.24 «Non tocco niente
    // finché non decidi».
    const clock = programClock(programma(), il(29));
    expect(clock.derivedWeek).toBe(1);
    expect(clock.awaitingChoice).toBe(true);
    expect(clock.skippedWeeks).toEqual([1]);
  });

  it("conta due settimane saltate di fila", () => {
    const program = programma();
    program.weeks[0].status = "saltata";
    program.currentWeek = 2;
    const clock = programClock(program, il(6, 9));
    expect(clock.skippedWeeks).toEqual([1, 2]);
    expect(clock.awaitingChoice).toBe(true);
  });

  it("dichiara finito il programma quando le settimane sono esaurite", () => {
    const program = programma();
    for (const week of program.weeks) {
      week.days[0].status = "completata";
    }
    program.currentWeek = 8;
    const clock = programClock(program, il(20, 10));
    expect(clock.finished).toBe(true);
  });
});

describe("programProgress — i numeri del riepilogo", () => {
  it("conta i giorni fatti sui previsti e l'aderenza", () => {
    const program = programma();
    program.weeks[0].days[0].status = "completata";
    program.weeks[0].days[1].status = "completata";
    const progress = programProgress(program, il(24));
    expect(progress.daysDone).toBe(2);
    // a metà settimana 1 i giorni «previsti finora» sono quelli già passati
    expect(progress.daysDue).toBeGreaterThanOrEqual(2);
    expect(progress.adherence).toBeGreaterThan(0);
    expect(progress.setsPlannedTotal).toBeGreaterThan(0);
  });

  it("non divide per zero il primo giorno", () => {
    const progress = programProgress(programma(), LUNEDI);
    expect(Number.isFinite(progress.adherence)).toBe(true);
  });
});
