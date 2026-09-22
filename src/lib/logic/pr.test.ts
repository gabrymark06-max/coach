import { describe, expect, it } from "vitest";
import type { Session, SessionExercise, SetEntry } from "@/lib/db/schema";
import {
  detectSessionPRs,
  prKey,
  replayPersonalRecords,
  sessionCandidates,
} from "./pr";

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    index: 1,
    type: "normal",
    weightKg: null,
    reps: null,
    completed: true,
    ...partial,
  };
}

function exercise(exerciseId: string, sets: SetEntry[]): SessionExercise {
  return {
    id: `se-${exerciseId}`,
    exerciseId,
    exerciseName: exerciseId,
    equipment: "barbell",
    order: 0,
    restSec: 90,
    sets,
  };
}

function session(
  id: string,
  startedAt: string,
  exercises: SessionExercise[],
  status: Session["status"] = "completed",
): Session {
  return {
    id,
    startedAt,
    endedAt: startedAt,
    status,
    pausedMs: 0,
    exercises,
    totalVolumeKg: 0,
    totalSets: 0,
    durationSec: 0,
    exerciseIds: exercises.map((item) => item.exerciseId),
  };
}

describe("sessionCandidates", () => {
  it("prende il 1RM stimato piu' alto, il volume dell'esercizio e le reps massime", () => {
    // Epley: 100x5 → 116,67 ; 90x8 → 114 . Il 1RM migliore e' la prima serie,
    // le reps migliori la seconda, il volume e' la somma (500 + 720).
    const candidates = sessionCandidates(
      session("s1", "2026-01-05T10:00:00.000Z", [
        exercise("panca", [
          set({ id: "a", weightKg: 100, reps: 5 }),
          set({ id: "b", weightKg: 90, reps: 8 }),
        ]),
      ]),
      "epley",
    );

    expect(candidates).toEqual([
      { exerciseId: "panca", kind: "e1rm", value: 116.67, weightKg: 100, reps: 5, setId: "a" },
      { exerciseId: "panca", kind: "volume", value: 1220, setId: "a" },
      { exerciseId: "panca", kind: "reps", value: 8, weightKg: 90, reps: 8, setId: "b" },
    ]);
  });

  it("ignora le serie non completate e quelle di riscaldamento", () => {
    const candidates = sessionCandidates(
      session("s1", "2026-01-05T10:00:00.000Z", [
        exercise("panca", [
          set({ id: "w", type: "warmup", weightKg: 20, reps: 30 }),
          set({ id: "a", weightKg: 100, reps: 5 }),
          set({ id: "b", weightKg: 200, reps: 20, completed: false }),
        ]),
      ]),
      "epley",
    );

    expect(candidates.find((c) => c.kind === "reps")?.value).toBe(5);
    expect(candidates.find((c) => c.kind === "volume")?.value).toBe(500);
  });

  it("non produce niente per un esercizio senza serie valide", () => {
    const candidates = sessionCandidates(
      session("s1", "2026-01-05T10:00:00.000Z", [
        exercise("addominali", [set({ id: "a", weightKg: null, reps: null })]),
      ]),
      "epley",
    );
    expect(candidates).toEqual([]);
  });
});

describe("detectSessionPRs", () => {
  const primaSessione = session("s1", "2026-01-05T10:00:00.000Z", [
    exercise("panca", [set({ id: "a", weightKg: 100, reps: 5 })]),
  ]);

  it("al primo allenamento ogni misura e' un record, senza valore precedente", () => {
    const records = detectSessionPRs(primaSessione, new Map(), "epley");
    expect(records.map((r) => r.kind)).toEqual(["e1rm", "volume", "reps"]);
    expect(records[0].previousValue).toBeUndefined();
    expect(records[0].previousAchievedAt).toBeUndefined();
  });

  it("registra il record precedente e la sua data, cosi' si puo' dire +4 sul record", () => {
    const baselines = new Map([
      [prKey("panca", "e1rm"), { value: 108, achievedAt: "2025-12-01T10:00:00.000Z" }],
    ]);
    const records = detectSessionPRs(primaSessione, baselines, "epley");
    const e1rm = records.find((r) => r.kind === "e1rm");
    expect(e1rm?.value).toBe(116.67);
    expect(e1rm?.previousValue).toBe(108);
    expect(e1rm?.previousAchievedAt).toBe("2025-12-01T10:00:00.000Z");
  });

  it("il pari merito non e' un record: si deve battere, non eguagliare", () => {
    const baselines = new Map([
      [prKey("panca", "e1rm"), { value: 116.67, achievedAt: "2025-12-01T10:00:00.000Z" }],
      [prKey("panca", "volume"), { value: 500, achievedAt: "2025-12-01T10:00:00.000Z" }],
      [prKey("panca", "reps"), { value: 5, achievedAt: "2025-12-01T10:00:00.000Z" }],
    ]);
    expect(detectSessionPRs(primaSessione, baselines, "epley")).toEqual([]);
  });

  it("una sessione scartata o ancora attiva non genera record", () => {
    const attiva = session(
      "s2",
      "2026-01-05T10:00:00.000Z",
      [exercise("panca", [set({ id: "a", weightKg: 300, reps: 5 })])],
      "active",
    );
    expect(detectSessionPRs(attiva, new Map(), "epley")).toEqual([]);

    const scartata = { ...attiva, status: "discarded" as const };
    expect(detectSessionPRs(scartata, new Map(), "epley")).toEqual([]);
  });
});

describe("replayPersonalRecords", () => {
  const sessioni = [
    session("s2", "2026-02-01T10:00:00.000Z", [
      exercise("panca", [set({ id: "b", weightKg: 105, reps: 5 })]),
    ]),
    session("s1", "2026-01-05T10:00:00.000Z", [
      exercise("panca", [set({ id: "a", weightKg: 100, reps: 5 })]),
    ]),
    session(
      "s3",
      "2026-03-01T10:00:00.000Z",
      [exercise("panca", [set({ id: "c", weightKg: 200, reps: 5 })])],
      "discarded",
    ),
  ];

  it("ricostruisce la catena in ordine cronologico, qualunque sia l'ordine in ingresso", () => {
    let n = 0;
    const records = replayPersonalRecords(sessioni, "epley", () => `pr-${(n += 1)}`);
    const e1rm = records.filter((r) => r.kind === "e1rm");

    expect(e1rm.map((r) => r.value)).toEqual([116.67, 122.5]);
    expect(e1rm[1].previousValue).toBe(116.67);
    expect(e1rm[1].previousAchievedAt).toBe("2026-01-05T10:00:00.000Z");
    expect(e1rm[1].sessionId).toBe("s2");
  });

  it("togliendo la sessione migliore il record torna a quello che c'era davvero", () => {
    let n = 0;
    const records = replayPersonalRecords(
      sessioni.filter((item) => item.id !== "s2"),
      "epley",
      () => `pr-${(n += 1)}`,
    );
    expect(records.filter((r) => r.kind === "e1rm").map((r) => r.value)).toEqual([116.67]);
  });

  it("la sessione scartata resta fuori anche dal replay", () => {
    const records = replayPersonalRecords(sessioni, "epley", () => "pr");
    expect(records.every((r) => r.sessionId !== "s3")).toBe(true);
  });
});
