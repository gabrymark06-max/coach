import { describe, expect, it } from "vitest";
import { describeDiff } from "./describeDiff";
import type { ReadinessOut } from "@/lib/api/types";

function out(diff: Partial<ReadinessOut["diff"]>, exercises: { exercise_id: string; name_it: string }[] = []): ReadinessOut {
  return {
    session: { exercises } as unknown as ReadinessOut["session"],
    diff: { removed_exercises: [], changed_sets: [], short_version: false, est_minutes: 40, ...diff },
    coach_line: "",
    notes: [],
    safety: null,
  } as ReadinessOut;
}

describe("describeDiff", () => {
  it("con nessuna modifica dice solo la durata", () => {
    expect(describeDiff(out({ est_minutes: 40 }))).toEqual(["Durata: 40 minuti"]);
  });

  it("versione corta: esercizi tolti prima, poi serie e recupero per esercizio, poi la durata", () => {
    const o = out(
      {
        removed_exercises: [{ exercise_id: "curl", name: "Curl con manubri", reason_it: "oltre il terzo", note_n: 1 }],
        changed_sets: [
          { set_id: null, exercise_id: "squat", field: "sets", from: 5, to: 2 },
          { set_id: null, exercise_id: "squat", field: "rest", from: 120, to: 90 },
          { set_id: null, exercise_id: "panca", field: "sets", from: 4, to: 2 },
        ],
        short_version: true,
        est_minutes: 25,
      },
      [
        { exercise_id: "squat", name_it: "Squat con bilanciere" },
        { exercise_id: "panca", name_it: "Panca piana" },
      ],
    );
    expect(describeDiff(o)).toEqual([
      "Tolgo Curl con manubri",
      "Squat con bilanciere: 2 serie invece di 5, recupero 90″ invece di 2′",
      "Panca piana: 2 serie invece di 4",
      "Durata: 25 minuti",
    ]);
  });

  it("un esercizio sconosciuto nella seduta viene nominato con il suo id", () => {
    const o = out({ changed_sets: [{ set_id: null, exercise_id: "rematore", field: "reps", from: 12, to: 10 }] });
    expect(describeDiff(o)).toEqual(["rematore: 10 ripetizioni invece di 12", "Durata: 40 minuti"]);
  });

  it("con duration:false non ripete la durata (la riga del coach della versione corta la dice già, contratto §6)", () => {
    const o = out({ changed_sets: [{ set_id: null, exercise_id: "squat", field: "sets", from: 3, to: 2 }], short_version: true, est_minutes: 25 }, [{ exercise_id: "squat", name_it: "Squat" }]);
    expect(describeDiff(o, { duration: false })).toEqual(["Squat: 2 serie invece di 3"]);
  });
});
