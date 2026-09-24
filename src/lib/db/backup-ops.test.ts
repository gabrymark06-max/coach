import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBackup, serializeBackup } from "@/lib/backup/format";
import { createBackup, restoreBackup, tableCounts, wipeAllData } from "./backup-ops";
import { createTestDb, type LiftedDB } from "./db";
import { createMeasurement } from "./measurements";
import {
  createExercise,
  createRoutine,
  finishSession,
  startSession,
  updateActiveSession,
} from "./mutations";
import { listPersonalRecords } from "./pr-ops";
import { ensureSeeded } from "./seed";
import { patchSet, toggleSetCompleted } from "./session-ops";

let db: LiftedDB;
let dbName = "";

beforeEach(async () => {
  dbName = `lifted-backup-${Math.random().toString(36).slice(2)}`;
  db = createTestDb(dbName);
  await db.open();
  await ensureSeeded(db);
});

afterEach(async () => {
  db.close();
  await createTestDb(dbName).delete();
});

async function datiDiProva() {
  const panca = await createExercise(db, {
    name: "Panca",
    muscleGroup: "chest",
    equipment: "barbell",
  });
  const routine = await createRoutine(db, {
    name: "Push A",
    exercises: [
      { exerciseId: panca.id, exerciseName: "Panca", order: 0, sets: [{ type: "normal" }] },
    ],
  });
  const session = await startSession(db, { routineId: routine.id });
  const exId = session.exercises[0].id;
  const setId = session.exercises[0].sets[0].id;
  await updateActiveSession(db, (current) =>
    toggleSetCompleted(
      patchSet(current, exId, setId, { weightKg: 100, reps: 5 }),
      exId,
      setId,
      true,
      new Date().toISOString(),
    ),
  );
  await finishSession(db);
  await createMeasurement(db, {
    metric: "bodyweight",
    value: 78.4,
    date: new Date().toISOString(),
  });
  return { panca, routine };
}

describe("export → import", () => {
  it("dopo un giro completo i dati tornano identici", async () => {
    await datiDiProva();

    const prima = {
      esercizi: await db.exercises.toArray(),
      routine: await db.routines.toArray(),
      sessioni: await db.sessions.toArray(),
      record: await db.personalRecords.toArray(),
      misure: await db.measurements.toArray(),
    };

    const testo = serializeBackup(await createBackup(db));
    await wipeAllData(db);
    expect(await tableCounts(db)).toEqual({
      exercises: 0,
      routines: 0,
      sessions: 0,
      personalRecords: 0,
      measurements: 0,
      trainerPrograms: 0,
      trainerDays: 0,
      trainerDecisions: 0,
    });

    await restoreBackup(db, parseBackup(testo));

    expect(await db.exercises.toArray()).toEqual(prima.esercizi);
    expect(await db.routines.toArray()).toEqual(prima.routine);
    expect(await db.sessions.toArray()).toEqual(prima.sessioni);
    expect(await db.measurements.toArray()).toEqual(prima.misure);
    expect((await db.personalRecords.toArray()).toSorted((a, b) => a.id.localeCompare(b.id)))
      .toEqual(prima.record.toSorted((a, b) => a.id.localeCompare(b.id)));
  });

  it("l'allenamento ancora aperto non finisce nel backup", async () => {
    const { routine } = await datiDiProva();
    await startSession(db, { routineId: routine.id });

    const backup = await createBackup(db);
    expect(backup.data.sessions.every((s) => s.status === "completed")).toBe(true);
    expect(backup.counts.sessions).toBe(1);
  });

  it("un backup senza record personali li ricalcola dallo storico", async () => {
    await datiDiProva();
    const backup = await createBackup(db);
    const senzaRecord = {
      ...backup,
      data: { ...backup.data, personalRecords: [] },
      counts: { ...backup.counts, personalRecords: 0 },
    };

    await wipeAllData(db);
    const esito = await restoreBackup(db, senzaRecord);

    expect(esito.rebuiltRecords).toBe(3);
    expect(await listPersonalRecords(db)).toHaveLength(3);
  });

  /*
    QA, secondo audit, DIFETTO 9: un file modificato a mano con `exercises: []` lasciava
    la libreria vuota **per sempre** — «Cancella tutti i dati» risemina, l'import no —
    e senza un modo di tornare indietro che non fosse cancellare tutto.
  */
  it("un import senza esercizi rimette la libreria di base", async () => {
    await datiDiProva();
    const backup = await createBackup(db);
    const senzaLibreria = {
      ...backup,
      data: { ...backup.data, exercises: [] },
      counts: { ...backup.counts, exercises: 0 },
    };

    const esito = await restoreBackup(db, senzaLibreria);

    const quanti = await db.exercises.count();
    expect(quanti).toBeGreaterThan(200);
    expect(esito.counts.exercises).toBe(quanti);
    // e sono quelli di sistema, non i personalizzati dell'utente
    const tutti = await db.exercises.toArray();
    expect(tutti.every((row) => !row.isCustom)).toBe(true);
  });
});

describe("import di un file malformato", () => {
  it("un file che non e' JSON non arriva nemmeno al database", async () => {
    await datiDiProva();
    const prima = await tableCounts(db);
    expect(() => parseBackup("{rotto")).toThrow("Questo file non è un backup di Lifted.");
    expect(await tableCounts(db)).toEqual(prima);
  });

  it("se una scrittura fallisce a meta', la transazione annulla tutto", async () => {
    await datiDiProva();
    const prima = await tableCounts(db);
    const esercizioPrima = await db.exercises.toArray();

    // Due esercizi con lo stesso nome: l'indice unico `&nameKey` rifiuta il secondo a
    // meta' della bulkAdd, dopo che le tabelle sono gia' state svuotate.
    const backup = await createBackup(db);
    const rotto = {
      ...backup,
      data: {
        ...backup.data,
        exercises: [
          { ...backup.data.exercises[0], id: "uno", nameKey: "doppione", name: "Doppione" },
          { ...backup.data.exercises[0], id: "due", nameKey: "doppione", name: "Doppione" },
        ],
      },
    };

    await expect(restoreBackup(db, rotto)).rejects.toThrow();

    expect(await tableCounts(db)).toEqual(prima);
    expect(await db.exercises.toArray()).toEqual(esercizioPrima);
  });
});
