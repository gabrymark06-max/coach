import { describe, expect, it } from "vitest";
import type { Session } from "./schema";
import {
  addExercise,
  addSet,
  deleteSet,
  moveExercise,
  patchSet,
  recalc,
  removeExercise,
  replaceExercise,
  setDisplayNumber,
  toggleSetCompleted,
} from "./session-ops";

const NOW = "2026-09-22T18:00:00.000Z";

function emptySession(): Session {
  return {
    id: "sess",
    startedAt: NOW,
    status: "active",
    pausedMs: 0,
    exercises: [],
    totalVolumeKg: 0,
    totalSets: 0,
    durationSec: 0,
    exerciseIds: [],
  };
}

function withPanca(): Session {
  return addExercise(emptySession(), {
    exerciseId: "lib-panca",
    exerciseName: "Panca piana con bilanciere",
    equipment: "barbell",
    restSec: 90,
    sets: [
      { type: "normal", prevWeightKg: 80, prevReps: 8 },
      { type: "normal", prevWeightKg: 80, prevReps: 7 },
    ],
  });
}

describe("addExercise", () => {
  it("aggiunge l'esercizio in coda con le sue serie e aggiorna l'indice degli esercizi", () => {
    const session = withPanca();
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].order).toBe(0);
    expect(session.exercises[0].sets).toHaveLength(2);
    expect(session.exerciseIds).toEqual(["lib-panca"]);
  });

  it("porta la serie precedente sulla riga, scritta, non calcolata al volo", () => {
    const session = withPanca();
    expect(session.exercises[0].sets[0].prevWeightKg).toBe(80);
    expect(session.exercises[0].sets[0].prevReps).toBe(8);
  });

  it("un esercizio senza serie di riferimento ne riceve una vuota", () => {
    const session = addExercise(emptySession(), {
      exerciseId: "lib-curl",
      exerciseName: "Curl con manubri",
      equipment: "dumbbell",
      restSec: 90,
      sets: [],
    });
    expect(session.exercises[0].sets).toHaveLength(1);
    expect(session.exercises[0].sets[0].type).toBe("normal");
  });
});

describe("removeExercise / moveExercise", () => {
  const base = () =>
    addExercise(withPanca(), {
      exerciseId: "lib-curl",
      exerciseName: "Curl con manubri",
      equipment: "dumbbell",
      restSec: 60,
      sets: [],
    });

  it("rimuove l'esercizio e lo toglie dall'indice", () => {
    const start = base();
    const session = removeExercise(start, start.exercises[0].id);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].exerciseName).toBe("Curl con manubri");
    expect(session.exerciseIds).toEqual(["lib-curl"]);
    expect(session.exercises[0].order).toBe(0);
  });

  it("sposta un esercizio in giu' e rinumera", () => {
    const start = base();
    const session = moveExercise(start, start.exercises[0].id, 1);
    expect(session.exercises.map((e) => e.exerciseName)).toEqual([
      "Curl con manubri",
      "Panca piana con bilanciere",
    ]);
    expect(session.exercises.map((e) => e.order)).toEqual([0, 1]);
  });

  it("non sposta oltre i bordi", () => {
    const start = base();
    expect(moveExercise(start, start.exercises[0].id, -1)).toBe(start);
    expect(moveExercise(start, start.exercises[1].id, 1)).toBe(start);
  });
});

describe("addSet / deleteSet", () => {
  it("la serie nuova va in coda e prende il numero successivo", () => {
    const start = withPanca();
    const session = addSet(start, start.exercises[0].id);
    expect(session.exercises[0].sets).toHaveLength(3);
    expect(session.exercises[0].sets[2].index).toBe(3);
  });

  it("la serie nuova eredita il tipo dell'ultima", () => {
    const start = withPanca();
    const typed = patchSet(start, start.exercises[0].id, start.exercises[0].sets[1].id, {
      type: "drop",
    });
    const session = addSet(typed, typed.exercises[0].id);
    expect(session.exercises[0].sets[2].type).toBe("drop");
  });

  it("eliminare una serie rinumera quelle che restano", () => {
    const panca = withPanca();
    const start = addSet(panca, panca.exercises[0].id);
    const session = deleteSet(start, start.exercises[0].id, start.exercises[0].sets[0].id);
    expect(session.exercises[0].sets.map((s) => s.index)).toEqual([1, 2]);
  });
});

describe("toggleSetCompleted", () => {
  it("segna la serie, marca l'ora e ricalcola volume e conteggio", () => {
    const start = withPanca();
    const exId = start.exercises[0].id;
    const setId = start.exercises[0].sets[0].id;

    const filled = patchSet(start, exId, setId, { weightKg: 80, reps: 8 });
    const session = toggleSetCompleted(filled, exId, setId, true, NOW);

    expect(session.exercises[0].sets[0].completed).toBe(true);
    expect(session.exercises[0].sets[0].completedAt).toBe(NOW);
    expect(session.totalVolumeKg).toBe(640);
    expect(session.totalSets).toBe(1);
  });

  it("togliere la spunta toglie anche il volume", () => {
    const start = withPanca();
    const exId = start.exercises[0].id;
    const setId = start.exercises[0].sets[0].id;
    const done = toggleSetCompleted(
      patchSet(start, exId, setId, { weightKg: 80, reps: 8 }),
      exId,
      setId,
      true,
      NOW,
    );
    const undone = toggleSetCompleted(done, exId, setId, false, NOW);
    expect(undone.totalVolumeKg).toBe(0);
    expect(undone.totalSets).toBe(0);
    expect(undone.exercises[0].sets[0].completedAt).toBeUndefined();
  });
});

describe("patchSet — validazione dei valori", () => {
  const exId = () => withPanca().exercises[0].id;

  it("il peso a corpo libero puo' restare vuoto", () => {
    const start = withPanca();
    const session = patchSet(start, start.exercises[0].id, start.exercises[0].sets[0].id, {
      weightKg: null,
      reps: 12,
    });
    expect(session.exercises[0].sets[0].weightKg).toBeNull();
  });

  it("non accetta un RPE fuori scala", () => {
    const start = withPanca();
    expect(() =>
      patchSet(start, exId(), start.exercises[0].sets[0].id, { rpe: 12 }),
    ).toThrowError(/RPE/);
  });

  it("non accetta un peso negativo o oltre i 1000 kg", () => {
    const start = withPanca();
    const setId = start.exercises[0].sets[0].id;
    expect(() => patchSet(start, exId(), setId, { weightKg: -5 })).toThrowError(/peso/i);
    expect(() => patchSet(start, exId(), setId, { weightKg: 1001 })).toThrowError(/peso/i);
  });

  it("non accetta ripetizioni fuori scala", () => {
    const start = withPanca();
    const setId = start.exercises[0].sets[0].id;
    expect(() => patchSet(start, exId(), setId, { reps: 1000 })).toThrowError(
      /ripetizioni/i,
    );
  });
});

describe("setDisplayNumber", () => {
  it("le serie di riscaldamento non consumano un numero", () => {
    const sets = [
      { type: "warmup" as const },
      { type: "warmup" as const },
      { type: "normal" as const },
      { type: "drop" as const },
      { type: "normal" as const },
    ];
    expect(sets.map((_, i) => setDisplayNumber(sets, i))).toEqual([null, null, 1, 2, 3]);
  });
});

describe("recalc", () => {
  it("riallinea totali e indice multiEntry su una sessione arrivata da fuori", () => {
    const broken: Session = {
      ...withPanca(),
      totalVolumeKg: 9999,
      totalSets: 42,
      exerciseIds: [],
    };
    const fixed = recalc(broken);
    expect(fixed.totalVolumeKg).toBe(0);
    expect(fixed.totalSets).toBe(0);
    expect(fixed.exerciseIds).toEqual(["lib-panca"]);
  });
});

describe("replaceExercise", () => {
  it("cambia l'esercizio tenendo posizione, numero e tipo delle serie", () => {
    const session = withPanca();
    const id = session.exercises[0].id;
    const con = patchSet(session, id, session.exercises[0].sets[0].id, {
      weightKg: 80,
      reps: 8,
    });

    const dopo = replaceExercise(con, id, {
      exerciseId: "lib-croci",
      exerciseName: "Croci ai cavi",
      equipment: "cable",
      restSec: 60,
      previous: [{ type: "normal", prevWeightKg: 12.5, prevReps: 12 }],
    });

    expect(dopo.exercises).toHaveLength(1);
    expect(dopo.exercises[0].exerciseId).toBe("lib-croci");
    expect(dopo.exercises[0].exerciseName).toBe("Croci ai cavi");
    expect(dopo.exercises[0].order).toBe(0);
    expect(dopo.exercises[0].sets).toHaveLength(2);
    expect(dopo.exerciseIds).toEqual(["lib-croci"]);
  });

  it("azzera i valori inseriti: 80 kg di panca non sono 80 kg di croci", () => {
    const session = withPanca();
    const id = session.exercises[0].id;
    const setId = session.exercises[0].sets[0].id;
    const con = toggleSetCompleted(
      patchSet(session, id, setId, { weightKg: 80, reps: 8 }),
      id,
      setId,
      true,
      NOW,
    );
    expect(con.totalVolumeKg).toBe(640);

    const dopo = replaceExercise(con, id, {
      exerciseId: "lib-croci",
      exerciseName: "Croci ai cavi",
      equipment: "cable",
      restSec: 60,
      previous: [{ type: "normal", prevWeightKg: 12.5, prevReps: 12 }],
    });

    expect(dopo.exercises[0].sets[0].weightKg).toBeNull();
    expect(dopo.exercises[0].sets[0].reps).toBeNull();
    expect(dopo.exercises[0].sets[0].completed).toBe(false);
    expect(dopo.exercises[0].sets[0].prevWeightKg).toBe(12.5);
    expect(dopo.totalVolumeKg).toBe(0);
  });
});
