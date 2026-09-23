import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBackup, serializeBackup } from "@/lib/backup/format";
import type { Draft } from "@/lib/trainer/questionnaire";
import { createBackup, restoreBackup } from "./backup-ops";
import { createTestDb, type LiftedDB } from "./db";
import { finishSession, startSession, updateActiveSession } from "./mutations";
import { ensureSeeded } from "./seed";
import { patchSet, toggleSetCompleted } from "./session-ops";
import {
  advanceWeek,
  createProgramFromDraft,
  getCurrentProgram,
  listDecisions,
  overrideWeight,
  saveDraft,
  getTrainerProfile,
} from "./trainer-ops";
import type { TrainerProgram } from "./trainer-schema";

let db: LiftedDB;
let dbName = "";

beforeEach(async () => {
  dbName = `lifted-trainer-${Math.random().toString(36).slice(2)}`;
  db = createTestDb(dbName);
  await db.open();
  await ensureSeeded(db);
});

afterEach(async () => {
  db.close();
  await createTestDb(dbName).delete();
});

const RISPOSTE: Draft = {
  goal: "hypertrophy",
  priorityMuscles: [],
  equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  level: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 60,
};

async function genera(): Promise<TrainerProgram> {
  const result = await createProgramFromDraft(db, RISPOSTE);
  if (!result.ok) throw new Error(result.reason);
  return result.program;
}

/** Chiude il giorno registrando `reps` ripetizioni a `weightKg` su ogni serie. */
async function allenaIlGiorno(dayId: string, weightKg: number, reps: number, rpe = 7) {
  const session = await startSession(db, { trainerDayId: dayId });
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      await updateActiveSession(db, (current) =>
        toggleSetCompleted(
          patchSet(current, exercise.id, set.id, { weightKg, reps, rpe }),
          exercise.id,
          set.id,
          true,
          new Date().toISOString(),
        ),
      );
    }
  }
  return finishSession(db);
}

describe("la bozza del questionario", () => {
  it("si scrive a ogni risposta e si rilegge dal passo raggiunto", async () => {
    await saveDraft(db, { goal: "strength" }, 2);
    await saveDraft(db, { goal: "strength", priorityMuscles: ["back"] }, 3);
    const profile = await getTrainerProfile(db);
    expect(profile?.draftStep).toBe(3);
    expect(profile?.priorityMuscles).toEqual(["back"]);
  });
});

describe("generazione e scrittura del programma", () => {
  it("scrive il programma, l'indice dei giorni e le decisioni della prima settimana", async () => {
    const program = await genera();

    expect(await db.trainerPrograms.count()).toBe(1);
    expect(await db.trainerDays.count()).toBe(program.weeksTotal * 4);

    const { rows } = await listDecisions(db, program.id, "tutte", 500);
    const primaSettimana = program.weeks[0].days.flatMap((day) => day.exercises);
    expect(rows).toHaveLength(primaSettimana.length);
    // Senza storico, ogni esercizio della prima settimana e' un «prima volta»:
    // la riga del perche' esiste dal primo giorno, non dal secondo.
    expect(rows.every((row) => row.rule === "first-time")).toBe(true);
    expect(primaSettimana.every((exercise) => exercise.decisionId)).toBe(true);
  });

  it("un programma nuovo chiude quello di prima: mai due allenatori insieme", async () => {
    const primo = await genera();
    const secondo = await genera();
    expect(secondo.id).not.toBe(primo.id);
    expect((await db.trainerPrograms.get(primo.id))?.status).toBe("abandoned");
    expect((await getCurrentProgram(db))?.id).toBe(secondo.id);
  });
});

describe("avvio della sessione dal giorno del Trainer", () => {
  it("porta il giorno nella sessione e il carico consigliato **nel campo**", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    // si finge che la progressione abbia gia' proposto un carico
    day.exercises[0].suggestedWeightKg = 60;
    await db.trainerPrograms.put(program);
    await db.trainerDays.put({ ...day, programId: program.id });

    const session = await startSession(db, { trainerDayId: day.id });
    expect(session.trainerDayId).toBe(day.id);
    expect(session.routineName).toBe(day.name);
    expect(session.exercises).toHaveLength(day.exercises.length);
    // valore, non placeholder
    expect(session.exercises[0].sets[0].weightKg).toBe(60);
    expect(session.exercises[0].sets).toHaveLength(day.exercises[0].sets);
    expect(session.exercises[0].notes).toContain("Obiettivo");
  });
});

describe("la progressione gira alla chiusura della sessione", () => {
  it("marca il giorno, scrive le decisioni e cambia il carico della settimana dopo", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    const pianificato = day.exercises[0];

    // tutte le serie al tetto dell'intervallo, RPE sotto l'obiettivo
    const finished = await allenaIlGiorno(day.id, 60, pianificato.repsMax, 7);
    expect(finished?.decisions.length).toBeGreaterThan(0);

    const dopo = await db.trainerPrograms.get(program.id);
    const giornoChiuso = dopo!.weeks[0].days[0];
    expect(giornoChiuso.status).toBe("completata");
    expect(giornoChiuso.sessionId).toBe(finished!.session.id);

    const gemello = dopo!.weeks[1].days.find((d) => d.dayIndex === day.dayIndex)!;
    const slot = gemello.exercises.find((e) => e.exerciseId === pianificato.exerciseId)!;
    expect(slot.suggestedWeightKg).toBeGreaterThan(60);
    expect(slot.decisionId).toBeTruthy();

    const decisione = await db.trainerDecisions.get(slot.decisionId!);
    expect(decisione?.rule).toBe("double-progression");
    expect(decisione?.evidence.sessionIds).toContain(finished!.session.id);
    expect(decisione?.nextStepHint).not.toBe("");
  });

  it("tiene il carico quando la seduta resta sotto il fondo dell'intervallo", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    const pianificato = day.exercises[0];

    await allenaIlGiorno(day.id, 60, Math.max(1, pianificato.repsMin - 2), 9);

    const dopo = await db.trainerPrograms.get(program.id);
    const gemello = dopo!.weeks[1].days.find((d) => d.dayIndex === day.dayIndex)!;
    const slot = gemello.exercises.find((e) => e.exerciseId === pianificato.exerciseId)!;
    expect(slot.suggestedWeightKg).toBe(60);
    const decisione = await db.trainerDecisions.get(slot.decisionId!);
    expect(decisione?.rule).toBe("hold-on-miss");
  });

  it("non tocca il programma quando la sessione non viene dal Trainer", async () => {
    const program = await genera();
    const prima = await db.trainerDecisions.count();
    const session = await startSession(db);
    expect(session.trainerDayId).toBeUndefined();
    await finishSession(db);
    expect(await db.trainerDecisions.count()).toBe(prima);
    expect((await db.trainerPrograms.get(program.id))?.status).toBe("active");
  });
});

describe("l'override manuale", () => {
  it("entra nel registro e diventa la nuova base", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    const esercizio = day.exercises[0];
    const precedente = esercizio.decisionId!;

    const decisione = await overrideWeight(db, {
      dayId: day.id,
      exerciseId: esercizio.exerciseId,
      weightKg: 47.5,
      note: "spalla indolenzita",
    });

    expect(decisione?.rule).toBe("manual");
    expect(decisione?.humanReason).toContain("spalla indolenzita");

    const dopo = await db.trainerPrograms.get(program.id);
    const slot = dopo!.weeks[0].days[0].exercises[0];
    expect(slot.suggestedWeightKg).toBe(47.5);
    expect(slot.decisionId).toBe(decisione!.id);

    // la decisione di prima resta, marcata come superata: la storia non si cancella
    expect((await db.trainerDecisions.get(precedente))?.overriddenBy).toBe(decisione!.id);

    const scelte = await listDecisions(db, program.id, "scelte");
    expect(scelte.rows.map((row) => row.id)).toContain(decisione!.id);
  });

  it("il carico scelto a mano finisce nei campi della sessione", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    await overrideWeight(db, {
      dayId: day.id,
      exerciseId: day.exercises[0].exerciseId,
      weightKg: 47.5,
    });
    const session = await startSession(db, { trainerDayId: day.id });
    expect(session.exercises[0].sets[0].weightKg).toBe(47.5);
  });
});

describe("la settimana saltata", () => {
  it("«Vai alla settimana dopo» marca la settimana e non lascia buchi nel registro", async () => {
    const program = await genera();
    await advanceWeek(db, 1);

    const dopo = await db.trainerPrograms.get(program.id);
    expect(dopo!.weeks[0].status).toBe("saltata");
    expect(dopo!.weeks[0].days.every((day) => day.status === "saltata")).toBe(true);
    expect(dopo!.currentWeek).toBe(2);

    // ogni esercizio della settimana 2 ha la sua decisione: la riga del perche' non
    // resta mai vuota, nemmeno dopo una settimana passata a vuoto
    const settimana2 = dopo!.weeks[1].days.flatMap((day) => day.exercises);
    expect(settimana2.every((exercise) => exercise.decisionId)).toBe(true);
  });

  it("dice «nessun allenamento registrato» quando il carico c'era già", async () => {
    // Si allena il giorno A della settimana 1 (cosi' il giorno A della 2 ha un carico),
    // poi si salta tutta la settimana 2: il giorno A della 3 deve dire perche'.
    const program = await genera();
    const dayA = program.weeks[0].days[0];
    await allenaIlGiorno(dayA.id, 60, dayA.exercises[0].repsMax, 7);
    await advanceWeek(db, 2);

    const dopo = await db.trainerPrograms.get(program.id);
    const gemello = dopo!.weeks[2].days.find((d) => d.dayIndex === dayA.dayIndex)!;
    const slot = gemello.exercises.find((e) => e.exerciseId === dayA.exercises[0].exerciseId)!;
    const decisione = await db.trainerDecisions.get(slot.decisionId!);

    expect(decisione?.rule).toBe("skip-hold");
    expect(decisione?.humanReason).toMatch(/nessun allenamento/i);
    expect(decisione?.nextStepHint).not.toBe("");
    expect(slot.suggestedWeightKg).toBe(62.5);
  });
});

describe("il registro delle decisioni", () => {
  it("filtra per direzione e conta il totale prima del taglio", async () => {
    const program = await genera();
    const day = program.weeks[0].days[0];
    await allenaIlGiorno(day.id, 60, day.exercises[0].repsMax, 7);

    const tutte = await listDecisions(db, program.id, "tutte", 500);
    const aumenti = await listDecisions(db, program.id, "aumenti", 500);
    expect(aumenti.rows.every((row) => row.direction === "up")).toBe(true);
    expect(aumenti.total).toBeLessThanOrEqual(tutte.total);

    const riduzioni = await listDecisions(db, program.id, "riduzioni", 500);
    expect(riduzioni.rows).toHaveLength(0);
  });

  it("torna in ordine inverso di data", async () => {
    const program = await genera();
    const { rows } = await listDecisions(db, program.id, "tutte", 500);
    const date = rows.map((row) => row.decidedAt);
    expect(date).toEqual([...date].sort().reverse());
  });
});

describe("il backup porta con sé il Trainer", () => {
  it("esporta e reimporta programma, giorni, decisioni e profilo", async () => {
    const program = await genera();
    await allenaIlGiorno(program.weeks[0].days[0].id, 60, program.weeks[0].days[0].exercises[0].repsMax, 7);

    const backup = parseBackup(serializeBackup(await createBackup(db)));
    expect(backup.counts.trainerPrograms).toBe(1);
    expect(backup.counts.trainerDays).toBe(program.weeksTotal * 4);
    expect(backup.counts.trainerDecisions).toBeGreaterThan(0);
    expect(backup.data.trainerProfile?.goal).toBe("hypertrophy");

    await restoreBackup(db, backup);

    const ripristinato = await getCurrentProgram(db);
    expect(ripristinato?.id).toBe(program.id);
    expect(await db.trainerDecisions.count()).toBe(backup.counts.trainerDecisions);
    expect((await getTrainerProfile(db))?.daysPerWeek).toBe(4);
  });

  it("importa senza errori un backup che il Trainer non ce l'ha proprio", async () => {
    await genera();
    const backup = parseBackup(
      JSON.stringify({
        app: "lifted",
        formatVersion: 1,
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        data: { exercises: [], routines: [], sessions: [], personalRecords: [], measurements: [] },
      }),
    );
    await restoreBackup(db, backup);
    expect(await db.trainerPrograms.count()).toBe(0);
    expect(await db.trainerDays.count()).toBe(0);
    expect(await getCurrentProgram(db)).toBeUndefined();
  });
});
