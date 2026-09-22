import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type LiftedDB } from "./db";
import {
  createExercise,
  createRoutine,
  deleteSession,
  discardSession,
  finishSession,
  startSession,
  updateActiveSession,
} from "./mutations";
import { listPersonalRecords, rebuildPersonalRecords } from "./pr-ops";
import { ensureSeeded } from "./seed";
import { patchSet, toggleSetCompleted } from "./session-ops";

let db: LiftedDB;
let dbName = "";

beforeEach(async () => {
  dbName = `lifted-pr-${Math.random().toString(36).slice(2)}`;
  db = createTestDb(dbName);
  await db.open();
  await ensureSeeded(db);
});

afterEach(async () => {
  db.close();
  await createTestDb(dbName).delete();
});

async function routineConPanca(exerciseId: string) {
  return createRoutine(db, {
    name: "Push A",
    exercises: [
      {
        exerciseId,
        exerciseName: "Panca",
        order: 0,
        sets: [{ type: "normal" }],
      },
    ],
  });
}

/** Un allenamento completo: avvia, compila l'unica serie, termina. */
async function allena(routineId: string, weightKg: number, reps: number) {
  const session = await startSession(db, { routineId });
  const exId = session.exercises[0].id;
  const setId = session.exercises[0].sets[0].id;
  await updateActiveSession(db, (current) =>
    toggleSetCompleted(
      patchSet(current, exId, setId, { weightKg, reps }),
      exId,
      setId,
      true,
      new Date().toISOString(),
    ),
  );
  return finishSession(db);
}

describe("rilevamento dei PR alla chiusura della sessione", () => {
  it("scrive i record del primo allenamento e li lega alle serie", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    const finished = await allena(routine.id, 100, 5);
    expect(finished?.records.map((r) => r.kind).toSorted()).toEqual([
      "e1rm",
      "reps",
      "volume",
    ]);

    const salvati = await listPersonalRecords(db);
    expect(salvati).toHaveLength(3);
    const setPrIds = finished!.session.exercises[0].sets[0].prIds ?? [];
    expect(setPrIds).toHaveLength(3);
    expect(salvati.map((r) => r.id).toSorted()).toEqual(setPrIds.toSorted());
  });

  it("al secondo allenamento migliore registra il record precedente e la sua data", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    const primo = await allena(routine.id, 100, 5);
    const secondo = await allena(routine.id, 108, 5);

    const e1rm = secondo!.records.find((r) => r.kind === "e1rm");
    expect(e1rm?.value).toBe(126);
    expect(e1rm?.previousValue).toBe(116.67);
    expect(e1rm?.previousAchievedAt).toBe(primo!.session.endedAt);
  });

  it("un allenamento uguale al precedente non genera nessun record", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    await allena(routine.id, 100, 5);
    const secondo = await allena(routine.id, 100, 5);

    expect(secondo?.records).toEqual([]);
    expect(await listPersonalRecords(db)).toHaveLength(3);
  });

  it("una sessione scartata non lascia record dietro di se'", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    const session = await startSession(db, { routineId: routine.id });
    const exId = session.exercises[0].id;
    const setId = session.exercises[0].sets[0].id;
    await updateActiveSession(db, (current) =>
      toggleSetCompleted(
        patchSet(current, exId, setId, { weightKg: 300, reps: 5 }),
        exId,
        setId,
        true,
        new Date().toISOString(),
      ),
    );
    await discardSession(db);

    expect(await listPersonalRecords(db)).toEqual([]);
  });
});

describe("coerenza dei record quando lo storico cambia", () => {
  it("eliminando l'allenamento del record, il record torna a quello precedente", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    await allena(routine.id, 100, 5);
    const migliore = await allena(routine.id, 120, 5);

    await deleteSession(db, migliore!.session.id);

    const records = await listPersonalRecords(db);
    expect(records.filter((r) => r.kind === "e1rm").map((r) => r.value)).toEqual([116.67]);
    expect(records.every((r) => r.sessionId !== migliore!.session.id)).toBe(true);
  });

  it("dopo il ricalcolo le serie non puntano piu' a record che non esistono", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    const primo = await allena(routine.id, 100, 5);
    const secondo = await allena(routine.id, 120, 5);
    await deleteSession(db, secondo!.session.id);

    const rimasta = await db.sessions.get(primo!.session.id);
    const prIds = rimasta!.exercises[0].sets[0].prIds ?? [];
    const esistenti = new Set((await listPersonalRecords(db)).map((r) => r.id));
    expect(prIds.length).toBeGreaterThan(0);
    expect(prIds.every((id) => esistenti.has(id))).toBe(true);
  });

  it("il ricalcolo completo riproduce esattamente la catena costruita a mano a mano", async () => {
    const panca = await createExercise(db, {
      name: "Panca",
      muscleGroup: "chest",
      equipment: "barbell",
    });
    const routine = await routineConPanca(panca.id);

    await allena(routine.id, 100, 5);
    await allena(routine.id, 105, 5);
    await allena(routine.id, 102, 8);

    // I record di una stessa sessione condividono `achievedAt`: si confronta l'insieme,
    // non l'ordine con cui IndexedDB li restituisce.
    const catena = async () =>
      (await listPersonalRecords(db))
        .map((r) => ({
          kind: r.kind,
          value: r.value,
          sessionId: r.sessionId,
          previousValue: r.previousValue,
          achievedAt: r.achievedAt,
        }))
        .toSorted((a, b) =>
          `${a.achievedAt}|${a.kind}|${a.value}`.localeCompare(
            `${b.achievedAt}|${b.kind}|${b.value}`,
          ),
        );

    const prima = await catena();
    await rebuildPersonalRecords(db, "epley");
    const dopo = await catena();

    expect(dopo).toEqual(prima);
  });
});
