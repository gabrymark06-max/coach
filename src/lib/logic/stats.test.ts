import { describe, expect, it } from "vitest";
import type { MuscleGroup, Session, SessionExercise, SetEntry } from "@/lib/db/schema";
import {
  aggregateByPeriod,
  e1rmSeries,
  isoWeekKey,
  monthKey,
  personalTotals,
  volumeByMuscleGroup,
} from "./stats";

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
    id: `se-${exerciseId}-${Math.random().toString(36).slice(2, 6)}`,
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
  extra: Partial<Session> = {},
): Session {
  const volume = exercises.reduce(
    (total, item) =>
      total +
      item.sets.reduce(
        (sum, s) => sum + (s.completed ? (s.weightKg ?? 0) * (s.reps ?? 0) : 0),
        0,
      ),
    0,
  );
  return {
    id,
    startedAt,
    endedAt: startedAt,
    status: "completed",
    pausedMs: 0,
    exercises,
    totalVolumeKg: volume,
    totalSets: exercises.reduce(
      (n, item) => n + item.sets.filter((s) => s.completed).length,
      0,
    ),
    durationSec: 3600,
    exerciseIds: exercises.map((item) => item.exerciseId),
    ...extra,
  };
}

describe("isoWeekKey", () => {
  // Riferimento: ISO-8601. La settimana 1 e' quella che contiene il 4 gennaio,
  // e la settimana comincia di lunedi'.
  it.each([
    ["2026-01-01T12:00:00.000Z", "2026-W01"],
    ["2026-01-04T12:00:00.000Z", "2026-W01"],
    ["2026-01-05T12:00:00.000Z", "2026-W02"],
    ["2021-01-03T12:00:00.000Z", "2020-W53"],
    ["2019-12-30T12:00:00.000Z", "2020-W01"],
    ["2026-12-31T12:00:00.000Z", "2026-W53"],
  ])("%s sta nella %s", (iso, atteso) => {
    expect(isoWeekKey(iso)).toBe(atteso);
  });
});

describe("monthKey", () => {
  it("usa il mese civile locale", () => {
    expect(monthKey("2026-03-14T23:30:00.000Z")).toMatch(/^2026-0[23]$/);
    expect(monthKey("2026-03-14T12:00:00.000Z")).toBe("2026-03");
  });
});

describe("aggregateByPeriod", () => {
  const sessioni = [
    session("a", "2026-01-05T10:00:00.000Z", [
      exercise("panca", [set({ weightKg: 100, reps: 5 })]),
    ]),
    session("b", "2026-01-07T10:00:00.000Z", [
      exercise("squat", [set({ weightKg: 100, reps: 10 })]),
    ]),
    // salto di due settimane: la settimana vuota in mezzo deve comparire a zero
    session("c", "2026-01-26T10:00:00.000Z", [
      exercise("panca", [set({ weightKg: 110, reps: 5 })]),
    ]),
  ];

  it("somma volume, serie e allenamenti per settimana", () => {
    const buckets = aggregateByPeriod(sessioni, "week");
    expect(buckets.map((b) => b.key)).toEqual([
      "2026-W02",
      "2026-W03",
      "2026-W04",
      "2026-W05",
    ]);
    expect(buckets[0].volumeKg).toBe(1500);
    expect(buckets[0].sessions).toBe(2);
    expect(buckets[0].sets).toBe(2);
  });

  it("riempie di zero le settimane senza allenamenti, invece di saltarle", () => {
    const buckets = aggregateByPeriod(sessioni, "week");
    expect(buckets[1]).toMatchObject({ key: "2026-W03", volumeKg: 0, sessions: 0 });
    expect(buckets[2]).toMatchObject({ key: "2026-W04", volumeKg: 0, sessions: 0 });
  });

  it("raggruppa anche per mese", () => {
    const buckets = aggregateByPeriod(sessioni, "month");
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ key: "2026-01", volumeKg: 2050, sessions: 3 });
  });

  it("senza sessioni non inventa periodi", () => {
    expect(aggregateByPeriod([], "week")).toEqual([]);
  });

  it("lascia fuori le sessioni non completate", () => {
    const buckets = aggregateByPeriod(
      [session("x", "2026-01-05T10:00:00.000Z", [], { status: "discarded" })],
      "week",
    );
    expect(buckets).toEqual([]);
  });
});

describe("volumeByMuscleGroup", () => {
  const muscoli = new Map<string, { muscleGroup: MuscleGroup; secondaryMuscles: MuscleGroup[] }>([
    ["panca", { muscleGroup: "chest", secondaryMuscles: ["arms", "shoulders"] }],
    ["curl", { muscleGroup: "arms", secondaryMuscles: [] }],
  ]);

  it("da' al muscolo principale il doppio di ogni secondario", () => {
    // 1000 kg di panca: peso 1 al petto, 0,5 a braccia e 0,5 a spalle → 2 in totale
    // → petto 500, braccia 250, spalle 250.
    const rows = volumeByMuscleGroup(
      [session("a", "2026-01-05T10:00:00.000Z", [exercise("panca", [set({ weightKg: 100, reps: 10 })])])],
      muscoli,
    );
    expect(rows).toEqual([
      { muscleGroup: "chest", volumeKg: 500, share: 0.5 },
      { muscleGroup: "arms", volumeKg: 250, share: 0.25 },
      { muscleGroup: "shoulders", volumeKg: 250, share: 0.25 },
    ]);
  });

  it("somma piu' esercizi e ordina dal gruppo piu' allenato", () => {
    const rows = volumeByMuscleGroup(
      [
        session("a", "2026-01-05T10:00:00.000Z", [
          exercise("panca", [set({ weightKg: 100, reps: 10 })]),
          exercise("curl", [set({ weightKg: 20, reps: 50 })]),
        ]),
      ],
      muscoli,
    );
    expect(rows[0]).toEqual({ muscleGroup: "arms", volumeKg: 1250, share: 0.625 });
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10);
  });

  it("ignora un esercizio che non esiste piu' in libreria invece di sbagliare i conti", () => {
    const rows = volumeByMuscleGroup(
      [session("a", "2026-01-05T10:00:00.000Z", [exercise("sparito", [set({ weightKg: 10, reps: 10 })])])],
      muscoli,
    );
    expect(rows).toEqual([]);
  });
});

describe("e1rmSeries", () => {
  it("da' un punto per sessione, con la serie migliore di quella sessione", () => {
    const punti = e1rmSeries(
      [
        session("b", "2026-02-01T10:00:00.000Z", [
          exercise("panca", [set({ weightKg: 105, reps: 5 })]),
        ]),
        session("a", "2026-01-05T10:00:00.000Z", [
          exercise("panca", [
            set({ weightKg: 100, reps: 5 }),
            set({ weightKg: 95, reps: 5 }),
          ]),
        ]),
      ],
      "panca",
      "epley",
    );

    expect(punti).toEqual([
      { date: "2026-01-05T10:00:00.000Z", value: 116.67, weightKg: 100, reps: 5 },
      { date: "2026-02-01T10:00:00.000Z", value: 122.5, weightKg: 105, reps: 5 },
    ]);
  });

  it("salta le sessioni in cui l'esercizio non ha serie stimabili", () => {
    const punti = e1rmSeries(
      [
        session("a", "2026-01-05T10:00:00.000Z", [
          exercise("panca", [set({ weightKg: null, reps: 10 })]),
        ]),
      ],
      "panca",
      "epley",
    );
    expect(punti).toEqual([]);
  });
});

describe("personalTotals", () => {
  it("conta allenamenti, volume, serie, durata e la settimana media", () => {
    const totali = personalTotals(
      [
        session("a", "2026-01-05T10:00:00.000Z", [
          exercise("panca", [set({ weightKg: 100, reps: 5 })]),
        ]),
        session("b", "2026-01-12T10:00:00.000Z", [
          exercise("panca", [set({ weightKg: 100, reps: 5 })]),
        ]),
      ],
      Date.parse("2026-01-19T10:00:00.000Z"),
    );

    expect(totali.sessions).toBe(2);
    expect(totali.volumeKg).toBe(1000);
    expect(totali.sets).toBe(2);
    expect(totali.durationSec).toBe(7200);
    expect(totali.weeksTracked).toBe(3);
    expect(totali.sessionsPerWeek).toBeCloseTo(2 / 3, 5);
    expect(totali.firstAt).toBe("2026-01-05T10:00:00.000Z");
  });

  it("senza allenamenti non divide per zero", () => {
    const totali = personalTotals([], Date.parse("2026-01-19T10:00:00.000Z"));
    expect(totali).toMatchObject({ sessions: 0, volumeKg: 0, sessionsPerWeek: 0 });
    expect(totali.firstAt).toBeNull();
  });
});
