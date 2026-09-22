import { describe, expect, it } from "vitest";
import type { SessionExercise, SetEntry } from "@/lib/db/schema";
import { exerciseVolume, sessionTotals, setVolume } from "./volume";

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: "s",
    index: 1,
    type: "normal",
    weightKg: null,
    reps: null,
    completed: false,
    ...partial,
  };
}

describe("setVolume", () => {
  it("vale peso per ripetizioni su una serie completata", () => {
    expect(setVolume(set({ weightKg: 80, reps: 8, completed: true }))).toBe(640);
  });

  it("vale zero se la serie non e' completata", () => {
    expect(setVolume(set({ weightKg: 80, reps: 8, completed: false }))).toBe(0);
  });

  it("vale zero a corpo libero, dove il peso e' assente", () => {
    expect(setVolume(set({ weightKg: null, reps: 12, completed: true }))).toBe(0);
  });

  it("tiene i decimali del bilanciere senza errore binario", () => {
    expect(setVolume(set({ weightKg: 82.5, reps: 3, completed: true }))).toBe(247.5);
  });
});

describe("exerciseVolume", () => {
  it("somma solo le serie completate dell'esercizio", () => {
    const ex: SessionExercise = {
      id: "e1",
      exerciseId: "x",
      exerciseName: "Panca piana con bilanciere",
      equipment: "barbell",
      order: 0,
      restSec: 90,
      sets: [
        set({ id: "a", weightKg: 60, reps: 10, completed: true }),
        set({ id: "b", weightKg: 80, reps: 8, completed: true }),
        set({ id: "c", weightKg: 80, reps: 8, completed: false }),
      ],
    };
    expect(exerciseVolume(ex)).toBe(1240);
  });
});

describe("sessionTotals", () => {
  const exercises: SessionExercise[] = [
    {
      id: "e1",
      exerciseId: "x",
      exerciseName: "Panca piana con bilanciere",
      equipment: "barbell",
      order: 0,
      restSec: 90,
      sets: [
        set({ id: "a", type: "warmup", weightKg: 20, reps: 10, completed: true }),
        set({ id: "b", weightKg: 80, reps: 8, completed: true }),
      ],
    },
    {
      id: "e2",
      exerciseId: "y",
      exerciseName: "Trazioni alla sbarra",
      equipment: "bodyweight",
      order: 1,
      restSec: 90,
      sets: [
        set({ id: "c", weightKg: null, reps: 8, completed: true }),
        set({ id: "d", weightKg: null, reps: 8, completed: false }),
      ],
    },
  ];

  it("conta volume e serie completate su tutta la sessione", () => {
    expect(sessionTotals(exercises)).toEqual({
      totalVolumeKg: 840,
      totalSets: 3,
    });
  });

  it("su una sessione vuota resta a zero, non a NaN", () => {
    expect(sessionTotals([])).toEqual({ totalVolumeKg: 0, totalSets: 0 });
  });
});
