import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type LiftedDB } from "./db";
import {
  ActiveSessionExistsError,
  createExercise,
  createRoutine,
  DuplicateNameError,
  deleteExercise,
  deleteRoutine,
  discardSession,
  finishSession,
  moveRoutine,
  startSession,
  updateActiveSession,
} from "./mutations";
import { getActiveSession, listRoutines, previousSetsFor } from "./queries";
import { ensureSeeded } from "./seed";
import { patchSet, toggleSetCompleted } from "./session-ops";

let db: LiftedDB;
let dbName = "";

beforeEach(async () => {
  dbName = `lifted-mut-${Math.random().toString(36).slice(2)}`;
  db = createTestDb(dbName);
  await db.open();
  await ensureSeeded(db);
});

afterEach(async () => {
  db.close();
  await createTestDb(dbName).delete();
});

async function pushRoutine() {
  return createRoutine(db, {
    name: "Push A",
    split: "Push",
    exercises: [
      {
        exerciseId: "lib-panca-piana-con-bilanciere",
        exerciseName: "Panca piana con bilanciere",
        order: 0,
        sets: [{ type: "normal" }, { type: "normal" }, { type: "normal" }],
      },
    ],
  });
}

describe("esercizi personalizzati", () => {
  it("si creano e restano marcati come personalizzati", async () => {
    const exercise = await createExercise(db, {
      name: "Rematore Kroc",
      muscleGroup: "back",
      equipment: "dumbbell",
    });
    expect(exercise.isCustom).toBe(true);
    expect((await db.exercises.get(exercise.id))?.name).toBe("Rematore Kroc");
  });

  it("un nome gia' usato non passa, nemmeno con maiuscole diverse", async () => {
    await expect(
      createExercise(db, {
        name: "panca PIANA con bilanciere",
        muscleGroup: "chest",
        equipment: "barbell",
      }),
    ).rejects.toBeInstanceOf(DuplicateNameError);
  });

  it("gli esercizi della libreria non si eliminano", async () => {
    await expect(deleteExercise(db, "lib-plank")).rejects.toThrow(/libreria/);
  });
});

describe("routine", () => {
  it("si creano in coda e si rinumerano quando una sparisce", async () => {
    const a = await pushRoutine();
    const b = await createRoutine(db, { name: "Pull A", exercises: [] });
    const c = await createRoutine(db, { name: "Legs", exercises: [] });
    expect([a.order, b.order, c.order]).toEqual([0, 1, 2]);

    await deleteRoutine(db, b.id);
    const rest = await listRoutines(db);
    expect(rest.map((routine) => routine.name)).toEqual(["Push A", "Legs"]);
    expect(rest.map((routine) => routine.order)).toEqual([0, 1]);
  });

  it("si riordinano", async () => {
    const a = await pushRoutine();
    await createRoutine(db, { name: "Pull A", exercises: [] });
    await moveRoutine(db, a.id, 1);
    expect((await listRoutines(db)).map((r) => r.name)).toEqual(["Pull A", "Push A"]);
  });

  it("una routine senza esercizi riceve comunque una serie di riferimento per esercizio aggiunto", async () => {
    const routine = await createRoutine(db, {
      name: "Vuota",
      exercises: [
        {
          exerciseId: "lib-plank",
          exerciseName: "Plank",
          order: 0,
          sets: [],
        },
      ],
    });
    expect(routine.exercises[0].sets).toHaveLength(1);
  });
});

describe("sessione attiva", () => {
  it("parte da una routine con gli esercizi gia' caricati", async () => {
    const routine = await pushRoutine();
    const session = await startSession(db, { routineId: routine.id });
    expect(session.routineName).toBe("Push A");
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].sets).toHaveLength(3);
    expect(session.exercises[0].equipment).toBe("barbell");
    expect(session.exerciseIds).toEqual(["lib-panca-piana-con-bilanciere"]);
  });

  it("parte anche vuota", async () => {
    const session = await startSession(db);
    expect(session.exercises).toEqual([]);
    expect(session.status).toBe("active");
  });

  it("non ne apre due: il vincolo sta nel dato, non nel bottone", async () => {
    await startSession(db);
    await expect(startSession(db)).rejects.toBeInstanceOf(ActiveSessionExistsError);
    expect(await db.sessions.count()).toBe(1);
  });

  it("scartarla la cancella e libera il posto", async () => {
    await startSession(db);
    await discardSession(db);
    expect(await getActiveSession(db)).toBeUndefined();
    await expect(startSession(db)).resolves.toBeTruthy();
  });
});

describe("chiusura della sessione", () => {
  it("salva durata, volume e serie, e butta le serie vuote", async () => {
    const routine = await pushRoutine();
    const session = await startSession(db, { routineId: routine.id });
    const exId = session.exercises[0].id;
    const setId = session.exercises[0].sets[0].id;

    await updateActiveSession(db, (current) =>
      toggleSetCompleted(
        patchSet(current, exId, setId, { weightKg: 80, reps: 8 }),
        exId,
        setId,
        true,
        new Date().toISOString(),
      ),
    );

    const finished = await finishSession(db);
    expect(finished?.status).toBe("completed");
    expect(finished?.totalVolumeKg).toBe(640);
    expect(finished?.totalSets).toBe(1);
    expect(finished?.exercises[0].sets).toHaveLength(1);
    expect(finished?.endedAt).toBeTruthy();
    expect(finished?.durationSec).toBeGreaterThanOrEqual(0);
    expect(await getActiveSession(db)).toBeUndefined();
  });

  it("segna la routine come eseguita", async () => {
    const routine = await pushRoutine();
    const session = await startSession(db, { routineId: routine.id });
    const exId = session.exercises[0].id;
    const setId = session.exercises[0].sets[0].id;
    await updateActiveSession(db, (current) =>
      toggleSetCompleted(
        patchSet(current, exId, setId, { weightKg: 60, reps: 10 }),
        exId,
        setId,
        true,
        new Date().toISOString(),
      ),
    );
    await finishSession(db);
    expect((await db.routines.get(routine.id))?.lastPerformedAt).toBeTruthy();
  });
});

describe("la colonna PRECEDENTE", () => {
  it("la seconda sessione nasce con i valori della prima gia' scritti sulle serie", async () => {
    const routine = await pushRoutine();

    const first = await startSession(db, { routineId: routine.id });
    const exId = first.exercises[0].id;
    for (const [i, set] of first.exercises[0].sets.entries()) {
      await updateActiveSession(db, (current) =>
        toggleSetCompleted(
          patchSet(current, exId, set.id, { weightKg: 80 + i * 2.5, reps: 8 - i }),
          exId,
          set.id,
          true,
          new Date().toISOString(),
        ),
      );
    }
    await finishSession(db);

    expect(await previousSetsFor(db, "lib-panca-piana-con-bilanciere")).toEqual([
      { weightKg: 80, reps: 8 },
      { weightKg: 82.5, reps: 7 },
      { weightKg: 85, reps: 6 },
    ]);

    const second = await startSession(db, { routineId: routine.id });
    expect(second.exercises[0].sets.map((s) => s.prevWeightKg)).toEqual([80, 82.5, 85]);
    expect(second.exercises[0].sets.map((s) => s.prevReps)).toEqual([8, 7, 6]);
    expect(second.exercises[0].sets.map((s) => s.weightKg)).toEqual([null, null, null]);
  });

  it("un esercizio mai fatto non inventa valori precedenti", async () => {
    expect(await previousSetsFor(db, "lib-ab-wheel")).toEqual([]);
  });
});
