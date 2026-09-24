import { programClock, performedIn, todayFocus } from "@/lib/trainer/clock";
import {
  generateProgram,
  type ExerciseHistory,
  type GenerateResult,
} from "@/lib/trainer/generator";
import { incrementFor } from "@/lib/trainer/increments";
import type { Draft, Step } from "@/lib/trainer/questionnaire";
import { toProfile } from "@/lib/trainer/questionnaire";
import {
  decideProgression,
  type DecisionDraft,
  type SessionPerformance,
} from "@/lib/trainer/rules";
import { newId, nowIso, type LiftedDB } from "./db";
import { DEFAULT_SETTINGS, type Exercise, type ID, type ISODate, type Session, type Settings } from "./schema";
import type {
  ProgressionDecision,
  TrainerDay,
  TrainerProfile,
  TrainerProgram,
  TrainerWeek,
} from "./trainer-schema";

/**
 * Lo strato Dexie del Trainer.
 *
 * Tutta la logica vera sta in `@/lib/trainer/*`, che non conosce IndexedDB. Qui si fa
 * solo tre cose: leggere quello che serve, chiamare una funzione pura, scrivere il
 * risultato dentro una transazione.
 *
 * **Il programma e' la fonte unica di verita'**; `trainerDays` e' un *indice*, non una
 * seconda copia: serve a `/trainer/giorno/[id]`, che e' un deep link e deve poter
 * trovare un giorno per id senza scorrere tutti i programmi. Si riscrive **sempre
 * insieme** al programma, da `putProgram`, cosi' non puo' divergere.
 *
 * `ProgressionDecision` si **scrive**, non si ricalcola (§10-bis passo 5): e' lo stesso
 * principio di `PersonalRecord`. La storia deve restare quella che e' stata, anche dopo
 * che l'utente ha cancellato un allenamento o cambiato un'impostazione.
 */

export type TrainerDayRow = TrainerDay & { programId: ID };

// ---------------------------------------------------------------- profilo e bozza

export function getTrainerProfile(db: LiftedDB): Promise<TrainerProfile | undefined> {
  return db.trainerProfile.get("singleton");
}

/**
 * Salva la bozza **al momento della risposta**, non alla fine (§4.23, `form-autosave`).
 * Chiudere l'app al passo 3 e riaprirla deve riportare al passo 3.
 */
export async function saveDraft(db: LiftedDB, draft: Draft, step: Step): Promise<void> {
  const current = await db.trainerProfile.get("singleton");
  await db.trainerProfile.put({
    ...(current ?? {}),
    ...draft,
    id: "singleton",
    draftStep: step,
  } as TrainerProfile);
}

export async function clearDraft(db: LiftedDB): Promise<void> {
  await db.trainerProfile.delete("singleton");
}

// ---------------------------------------------------------------- programma

/** Il programma su cui si sta lavorando: attivo o in pausa. Al massimo uno. */
export async function getCurrentProgram(db: LiftedDB): Promise<TrainerProgram | undefined> {
  const rows = await db.trainerPrograms.where("status").anyOf("active", "paused").toArray();
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/** L'ultimo programma comunque concluso: la schermata «finito» resta consultabile. */
export async function getLastFinishedProgram(
  db: LiftedDB,
): Promise<TrainerProgram | undefined> {
  const rows = await db.trainerPrograms.where("status").equals("completed").toArray();
  return rows.sort((a, b) =>
    (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt),
  )[0];
}

export function getProgram(db: LiftedDB, id: ID): Promise<TrainerProgram | undefined> {
  return db.trainerPrograms.get(id);
}

export function getDayRow(db: LiftedDB, dayId: ID): Promise<TrainerDayRow | undefined> {
  return db.trainerDays.get(dayId) as Promise<TrainerDayRow | undefined>;
}

/** Scrive programma e indice dei giorni insieme: non possono divergere. */
export async function putProgram(db: LiftedDB, program: TrainerProgram): Promise<void> {
  await db.transaction("rw", db.trainerPrograms, db.trainerDays, async () => {
    await writeProgram(db, program);
  });
}

async function writeProgram(db: LiftedDB, program: TrainerProgram): Promise<void> {
  await db.trainerPrograms.put(program);
  await db.trainerDays.where("programId").equals(program.id).delete();
  const rows: TrainerDayRow[] = program.weeks.flatMap((week) =>
    week.days.map((day) => ({ ...day, programId: program.id })),
  );
  if (rows.length > 0) await db.trainerDays.bulkAdd(rows);
}

/**
 * Genera il programma dalle risposte e lo scrive, **con le decisioni della prima
 * settimana gia' dentro**: la riga del perche' esiste dal primo giorno, non dal
 * secondo (§4.25, «sotto il carico consigliato di *ogni* esercizio, sempre»).
 */
export async function createProgramFromDraft(
  db: LiftedDB,
  draft: Draft,
  now: ISODate = nowIso(),
): Promise<GenerateResult> {
  const profile = toProfile(draft);
  if (!profile) {
    return { ok: false, reason: "Mancano ancora delle risposte." };
  }

  const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const library = await db.exercises.toArray();
  const history = await historyFor(db, library);

  const result = generateProgram({ profile, library, settings, now, history });
  if (!result.ok) return result;

  const program = result.program;
  const decisions = firstWeekDecisions(program, library, settings, now);

  await db.transaction(
    "rw",
    db.trainerPrograms,
    db.trainerDays,
    db.trainerDecisions,
    db.trainerProfile,
    async () => {
      // Un programma nuovo chiude quello di prima: due programmi attivi insieme sono
      // due allenatori che parlano sopra.
      const running = await db.trainerPrograms.where("status").anyOf("active", "paused").toArray();
      for (const old of running) {
        await db.trainerPrograms.update(old.id, { status: "abandoned" });
        await db.trainerDays.where("programId").equals(old.id).delete();
      }
      await writeProgram(db, program);
      if (decisions.length > 0) await db.trainerDecisions.bulkAdd(decisions);
      await db.trainerProfile.put({ ...profile, answeredAt: now, draftStep: undefined });
    },
  );

  return { ok: true, program };
}

/**
 * L'allenamento del Trainer previsto **oggi**, se c'e' e non e' gia' fatto (§9.6).
 *
 * La leggono `/home` (per la card «Oggi») e la `Sidebar` (per il badge): una funzione
 * sola, perche' due letture diverse dello stesso stato sarebbero due schermate che si
 * contraddicono a vicenda sullo stesso giorno.
 */
export async function todayTrainerDay(
  db: LiftedDB,
  now: ISODate = nowIso(),
): Promise<{ program: TrainerProgram; week: TrainerWeek; day: TrainerDay } | null> {
  const program = await getCurrentProgram(db);
  if (!program || program.status !== "active") return null;
  const focus = todayFocus(program, now);
  if (focus.kind !== "allenamento") return null;
  return { program, week: focus.week, day: focus.day };
}

/** L'ultimo carico di lavoro per esercizio, letto dallo storico gia' presente. */
async function historyFor(
  db: LiftedDB,
  library: readonly Exercise[],
): Promise<Map<ID, ExerciseHistory>> {
  const out = new Map<ID, ExerciseHistory>();
  const known = new Set(library.map((row) => row.id));

  await db.sessions
    .where("[status+startedAt]")
    .between(["completed", ""], ["completed", "￿"])
    .each((session) => {
      for (const exercise of session.exercises) {
        if (!known.has(exercise.exerciseId)) continue;
        const best = topSet(exercise.sets);
        if (!best) continue;
        const current = out.get(exercise.exerciseId);
        if (current && current.lastAt >= session.startedAt) continue;
        out.set(exercise.exerciseId, {
          lastWeightKg: best.weightKg,
          lastReps: best.reps,
          lastAt: session.startedAt,
          sessionId: session.id,
        });
      }
    });

  return out;
}

function topSet(sets: Session["exercises"][number]["sets"]) {
  let best: { weightKg: number; reps: number | null } | null = null;
  for (const set of sets) {
    if (!set.completed || set.type === "warmup" || set.weightKg == null) continue;
    if (!best || set.weightKg > best.weightKg) best = { weightKg: set.weightKg, reps: set.reps };
  }
  return best;
}

function firstWeekDecisions(
  program: TrainerProgram,
  library: readonly Exercise[],
  settings: Settings,
  now: ISODate,
): ProgressionDecision[] {
  const byId = new Map(library.map((row) => [row.id, row]));
  const week = program.weeks[0];
  if (!week) return [];

  return week.days.flatMap((day) =>
    day.exercises.map((exercise) => {
      const row = byId.get(exercise.exerciseId);
      const steps = row
        ? incrementFor(row, settings)
        : { stepKg: settings.trainerIncrementUpperKg, fineStepKg: settings.stepKgFine };
      const draft = decideProgression({
        planned: exercise,
        performances: [],
        nextWeekKind: week.kind,
        stepKg: steps.stepKg,
        fineStepKg: steps.fineStepKg,
        rpeCap: settings.trainerRpeCap,
        decidedAt: now,
      });
      const decision = materialise(draft, {
        programId: program.id,
        weekIndex: week.index,
        dayId: day.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        decidedAt: now,
      });
      exercise.decisionId = decision.id;
      /*
        Il carico della prima settimana lo ha gia' scelto il generatore dallo storico.
        Se la regola e' `first-time` non c'e' storico, e allora il campo resta vuoto:
        la decisione dice esattamente questo, e la riga del perche' lo spiega.
      */
      if (draft.rule === "first-time") exercise.suggestedWeightKg = null;
      return decision;
    }),
  );
}

function materialise(
  draft: DecisionDraft,
  meta: {
    programId: ID;
    weekIndex: number;
    dayId: ID;
    exerciseId: ID;
    exerciseName: string;
    decidedAt: ISODate;
  },
): ProgressionDecision {
  return { id: newId(), ...meta, ...draft };
}

// ---------------------------------------------------------------- progressione

/**
 * La progressione dopo un allenamento del programma.
 *
 * Gira **dentro la transazione di `finishSession`**: o si salvano l'allenamento, i suoi
 * record e le decisioni che ne derivano, o non si salva niente. Una decisione senza la
 * sessione che l'ha prodotta sarebbe un numero senza storia — la stessa ragione per cui
 * i PR stanno li' dentro.
 */
export async function progressAfterSession(
  db: LiftedDB,
  session: Session,
  now: ISODate,
): Promise<ProgressionDecision[]> {
  if (!session.trainerDayId) return [];

  const row = await db.trainerDays.get(session.trainerDayId);
  if (!row) return [];
  const program = await db.trainerPrograms.get((row as TrainerDayRow).programId);
  if (!program || program.status !== "active") return [];

  const found = locate(program, session.trainerDayId);
  if (!found) return [];
  const { week, day } = found;

  day.status = "completata";
  day.sessionId = session.id;
  if (week.days.every((item) => item.status !== "prevista")) week.status = "completata";

  const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const library = await db.exercises.bulkGet(day.exercises.map((item) => item.exerciseId));
  const byId = new Map<ID, Exercise>();
  for (const item of library) if (item) byId.set(item.id, item);

  const decisions = await decideForNextWeek(db, program, week.index, day, byId, settings, now, false);

  if (week.index >= program.currentWeek) program.currentWeek = week.index;
  if (
    program.weeks.every((item) => item.days.every((d) => d.status !== "prevista")) ||
    (week.index === program.weeksTotal && week.status === "completata")
  ) {
    program.status = "completed";
    program.completedAt = now;
  }

  await writeProgram(db, program);
  if (decisions.length > 0) await db.trainerDecisions.bulkAdd(decisions);
  return decisions;
}

/**
 * Scrive le decisioni per il giorno gemello della settimana successiva.
 *
 * «Gemello» vuol dire stesso `dayIndex`: il Giorno B della settimana 3 progredisce dal
 * Giorno B della settimana 2, non dall'ultimo allenamento qualunque. E' quello che
 * rende il programma progressivo invece che reattivo.
 */
async function decideForNextWeek(
  db: LiftedDB,
  program: TrainerProgram,
  weekIndex: number,
  day: TrainerDay,
  byId: Map<ID, Exercise>,
  settings: Settings,
  now: ISODate,
  weekSkipped: boolean,
): Promise<ProgressionDecision[]> {
  const nextWeek = program.weeks.find((item) => item.index === weekIndex + 1);
  if (!nextWeek) return [];
  const target = nextWeek.days.find((item) => item.dayIndex === day.dayIndex);
  if (!target) return [];

  const dayIds = new Set(program.weeks.flatMap((w) => w.days.map((d) => d.id)));
  const out: ProgressionDecision[] = [];

  for (const planned of day.exercises) {
    const slot = target.exercises.find((item) => item.exerciseId === planned.exerciseId);
    if (!slot) continue;
    if (slot.decisionId) continue; // gia' deciso: non si riscrive la storia

    const exercise = byId.get(planned.exerciseId) ?? (await db.exercises.get(planned.exerciseId));
    const steps = exercise
      ? incrementFor(exercise, settings)
      : { stepKg: settings.trainerIncrementUpperKg, fineStepKg: settings.stepKgFine };

    const performances = weekSkipped
      ? []
      : await performancesFor(db, planned.exerciseId, dayIds, planned.sets);

    const draft = decideProgression({
      planned,
      performances,
      nextWeekKind: nextWeek.kind,
      stepKg: steps.stepKg,
      fineStepKg: steps.fineStepKg,
      rpeCap: settings.trainerRpeCap,
      decidedAt: now,
      weekSkipped,
    });

    const decision = materialise(draft, {
      programId: program.id,
      weekIndex: nextWeek.index,
      dayId: target.id,
      exerciseId: planned.exerciseId,
      exerciseName: planned.exerciseName,
      decidedAt: now,
    });
    slot.suggestedWeightKg = draft.toWeightKg;
    slot.decisionId = decision.id;
    out.push(decision);
  }

  return out;
}

/** Le sedute di quell'esercizio **dentro questo programma**, dalla piu' recente. */
async function performancesFor(
  db: LiftedDB,
  exerciseId: ID,
  dayIds: ReadonlySet<ID>,
  setsPlanned: number,
): Promise<SessionPerformance[]> {
  const sessions = await db.sessions
    .where("exerciseIds")
    .equals(exerciseId)
    .filter(
      (session) =>
        session.status === "completed" &&
        Boolean(session.trainerDayId) &&
        dayIds.has(session.trainerDayId as ID),
    )
    .toArray();

  return sessions
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
      const sets = (exercise?.sets ?? [])
        .filter((set) => set.completed && set.type !== "warmup")
        .map((set) => ({
          weightKg: set.weightKg,
          reps: set.reps,
          rpe: set.rpe ?? null,
          completed: true,
        }));
      return { sessionId: session.id, date: session.startedAt, sets, setsPlanned };
    })
    .filter((performance) => performance.sets.length > 0);
}

/**
 * L'override manuale — «Non sono d'accordo» (§4.25).
 *
 * Entra nel registro **come ogni altra decisione**, con `rule: "manual"`, e da li' in
 * poi la progressione riparte da quel valore. Il Trainer non si offende e non riscrive
 * la scelta alla sessione successiva: la decisione precedente resta, marcata come
 * superata, perche' la storia non si cancella.
 */
export async function overrideWeight(
  db: LiftedDB,
  input: { dayId: ID; exerciseId: ID; weightKg: number; note?: string },
  now: ISODate = nowIso(),
): Promise<ProgressionDecision | null> {
  const row = (await db.trainerDays.get(input.dayId)) as TrainerDayRow | undefined;
  if (!row) return null;
  const program = await db.trainerPrograms.get(row.programId);
  if (!program) return null;
  const found = locate(program, input.dayId);
  if (!found) return null;

  const slot = found.day.exercises.find((item) => item.exerciseId === input.exerciseId);
  if (!slot) return null;

  const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const exercise = await db.exercises.get(input.exerciseId);
  const steps = exercise
    ? incrementFor(exercise, settings)
    : { stepKg: settings.trainerIncrementUpperKg, fineStepKg: settings.stepKgFine };

  const draft = decideProgression({
    planned: slot,
    performances: [],
    nextWeekKind: found.week.kind,
    stepKg: steps.stepKg,
    fineStepKg: steps.fineStepKg,
    rpeCap: settings.trainerRpeCap,
    decidedAt: now,
    manual: { weightKg: input.weightKg, note: input.note },
  });

  const decision = materialise(draft, {
    programId: program.id,
    weekIndex: found.week.index,
    dayId: found.day.id,
    exerciseId: input.exerciseId,
    exerciseName: slot.exerciseName,
    decidedAt: now,
  });

  const previousId = slot.decisionId;
  slot.suggestedWeightKg = input.weightKg;
  slot.decisionId = decision.id;

  await db.transaction(
    "rw",
    db.trainerPrograms,
    db.trainerDays,
    db.trainerDecisions,
    async () => {
      await writeProgram(db, program);
      await db.trainerDecisions.add(decision);
      if (previousId) {
        await db.trainerDecisions.update(previousId, { overriddenBy: decision.id });
      }
    },
  );

  return decision;
}

// ---------------------------------------------------------------- le decisioni

export type DecisionFilter = "tutte" | "aumenti" | "riduzioni" | "scarichi" | "scelte";

export const DECISION_FILTERS: { value: DecisionFilter; label: string }[] = [
  { value: "tutte", label: "Tutte" },
  { value: "aumenti", label: "Aumenti" },
  { value: "riduzioni", label: "Riduzioni" },
  { value: "scarichi", label: "Scarichi" },
  { value: "scelte", label: "Tue scelte" },
];

export function matchesFilter(
  decision: ProgressionDecision,
  filter: DecisionFilter,
): boolean {
  switch (filter) {
    case "aumenti":
      return decision.direction === "up";
    case "riduzioni":
      return decision.direction === "down";
    case "scarichi":
      return decision.direction === "deload";
    case "scelte":
      return decision.rule === "manual";
    default:
      return true;
  }
}

export async function listDecisions(
  db: LiftedDB,
  programId: ID,
  filter: DecisionFilter = "tutte",
  limit = 50,
): Promise<{ rows: ProgressionDecision[]; total: number }> {
  const all = await db.trainerDecisions
    .where("[programId+decidedAt]")
    .between([programId, ""], [programId, "￿"])
    .reverse()
    .toArray();
  const rows = all.filter((decision) => matchesFilter(decision, filter));
  return { rows: rows.slice(0, limit), total: rows.length };
}

/**
 * Le decisioni che quell'allenamento ha prodotto — la card «Cosa cambia la prossima
 * volta» del riepilogo (§6.8).
 *
 * E' il momento in cui l'utente ha piu' attenzione e meno domande: mostrargli li' il
 * perche' del carico della settimana prossima costa un tocco a zero e gli risparmia la
 * sorpresa fra sei giorni.
 */
export async function decisionsFromSession(
  db: LiftedDB,
  sessionId: ID,
): Promise<ProgressionDecision[]> {
  const rows = await db.trainerDecisions
    .filter((decision) => decision.evidence.sessionIds.includes(sessionId))
    .toArray();
  return rows.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "it-IT"));
}

export async function decisionsByIds(
  db: LiftedDB,
  ids: readonly ID[],
): Promise<Map<ID, ProgressionDecision>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db.trainerDecisions.bulkGet(unique);
  const out = new Map<ID, ProgressionDecision>();
  for (const row of rows) if (row) out.set(row.id, row);
  return out;
}

// ---------------------------------------------------------------- azioni sul ciclo

export async function pauseProgram(db: LiftedDB, now = nowIso()): Promise<void> {
  const program = await getCurrentProgram(db);
  if (!program || program.status !== "active") return;
  await db.trainerPrograms.update(program.id, { status: "paused", pausedAt: now });
}

export async function resumeProgram(db: LiftedDB): Promise<void> {
  const program = await getCurrentProgram(db);
  if (!program || program.status !== "paused") return;
  await db.trainerPrograms.update(program.id, { status: "active", pausedAt: undefined });
}

export async function endProgram(db: LiftedDB, now = nowIso()): Promise<void> {
  const program = await getCurrentProgram(db);
  if (!program) return;
  await db.trainerPrograms.update(program.id, { status: "completed", completedAt: now });
}

/**
 * «Ripeti la settimana N» — stessi carichi, nessun aumento.
 *
 * La settimana saltata si marca `ripetuta` e si ricopia sopra quella successiva: cosi'
 * il ciclo non si accorcia e i carichi restano quelli dell'ultima settimana davvero
 * fatta. Le date si ricalcolano da oggi: proporre allenamenti con la data della
 * settimana scorsa e' il modo piu' rapido di farsi ignorare.
 */
export async function repeatWeek(
  db: LiftedDB,
  weekIndex: number,
  now: ISODate = nowIso(),
): Promise<void> {
  const program = await getCurrentProgram(db);
  if (!program) return;
  const week = program.weeks.find((item) => item.index === weekIndex);
  if (!week) return;

  week.status = "ripetuta";
  for (const day of week.days) {
    if (day.status === "prevista") day.status = "prevista";
  }
  reschedule(program, weekIndex, now);
  program.currentWeek = weekIndex;
  program.startedAt = shiftStart(program, weekIndex, now);
  await putProgram(db, program);
}

/**
 * «Vai alla settimana N+1» — si prosegue come previsto.
 *
 * La settimana saltata resta `saltata` (non si finge che sia successa) e la regola
 * `skip-hold` scrive per ognuno dei suoi esercizi una decisione: «nessun allenamento
 * registrato, tengo il carico». Cosi' anche una settimana vuota lascia una traccia
 * leggibile nel registro.
 */
export async function advanceWeek(
  db: LiftedDB,
  weekIndex: number,
  now: ISODate = nowIso(),
): Promise<void> {
  const program = await getCurrentProgram(db);
  if (!program) return;
  const week = program.weeks.find((item) => item.index === weekIndex);
  if (!week) return;

  const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const ids = [...new Set(week.days.flatMap((day) => day.exercises.map((e) => e.exerciseId)))];
  const rows = await db.exercises.bulkGet(ids);
  const byId = new Map<ID, Exercise>();
  for (const row of rows) if (row) byId.set(row.id, row);

  const decisions: ProgressionDecision[] = [];
  for (const day of week.days) {
    if (day.status === "prevista") day.status = "saltata";
    decisions.push(
      ...(await decideForNextWeek(db, program, weekIndex, day, byId, settings, now, true)),
    );
  }
  week.status = "saltata";
  program.currentWeek = Math.min(weekIndex + 1, program.weeksTotal);
  reschedule(program, program.currentWeek, now);
  program.startedAt = shiftStart(program, program.currentWeek, now);

  await db.transaction(
    "rw",
    db.trainerPrograms,
    db.trainerDays,
    db.trainerDecisions,
    async () => {
      await writeProgram(db, program);
      if (decisions.length > 0) await db.trainerDecisions.bulkAdd(decisions);
    },
  );
}

/**
 * «Riduci a N giorni a settimana» — dopo due settimane saltate (§4.24).
 *
 * Adattare, non insistere: il profilo cambia, il programma si rigenera **da oggi** e
 * quello vecchio si chiude. Le decisioni gia' scritte restano: sono successe.
 */
export async function reduceDays(
  db: LiftedDB,
  daysPerWeek: 2 | 3 | 4 | 5 | 6,
  now: ISODate = nowIso(),
): Promise<GenerateResult> {
  const profile = await getTrainerProfile(db);
  if (!profile) return { ok: false, reason: "Non trovo le tue risposte." };
  return createProgramFromDraft(db, { ...profile, daysPerWeek }, now);
}

/** «Rigenera da qui»: stesse risposte, programma nuovo che parte oggi. */
export async function regenerateFromToday(
  db: LiftedDB,
  now: ISODate = nowIso(),
): Promise<GenerateResult> {
  const profile = await getTrainerProfile(db);
  if (!profile) return { ok: false, reason: "Non trovo le tue risposte." };
  return createProgramFromDraft(db, profile, now);
}

/**
 * L'orologio del programma, allineato **solo quando serve**.
 *
 * Il tempo passa anche quando l'app e' chiusa, e `currentWeek` e' un campo scritto. La
 * dashboard chiama questa funzione una volta al montaggio: se la settimana derivata dal
 * calendario e' piu' avanti di quella scritta — e la precedente ha almeno un
 * allenamento — la sposta. Sopra una settimana vuota **non passa**: li' decide
 * l'utente (§4.24).
 */
export async function syncProgramClock(
  db: LiftedDB,
  now: ISODate = nowIso(),
): Promise<boolean> {
  const program = await getCurrentProgram(db);
  if (!program || program.status !== "active") return false;

  const clock = programClock(program, now);
  if (clock.finished) {
    await db.trainerPrograms.update(program.id, { status: "completed", completedAt: now });
    return true;
  }
  if (clock.derivedWeek === program.currentWeek) return false;

  const settings = (await db.settings.get("singleton")) ?? DEFAULT_SETTINGS;
  const decisions: ProgressionDecision[] = [];

  for (let index = program.currentWeek; index < clock.derivedWeek; index += 1) {
    const week = program.weeks.find((item) => item.index === index);
    if (!week) continue;
    const done = performedIn(program, index);
    week.status = done > 0 ? "completata" : "saltata";
    for (const day of week.days) {
      if (day.status !== "prevista") continue;
      day.status = "saltata";
      /*
        Un giorno lasciato indietro in una settimana comunque allenata: la settimana
        dopo deve avere una decisione lo stesso, altrimenti la riga del perche' non ha
        niente da dire. `skip-hold` e' esattamente la frase giusta.
      */
      decisions.push(
        ...(await decideForNextWeek(db, program, index, day, new Map(), settings, now, true)),
      );
    }
  }

  program.currentWeek = clock.derivedWeek;
  const current = program.weeks.find((item) => item.index === clock.derivedWeek);
  if (current && current.status === "futura") current.status = "in-corso";

  await db.transaction(
    "rw",
    db.trainerPrograms,
    db.trainerDays,
    db.trainerDecisions,
    async () => {
      await writeProgram(db, program);
      if (decisions.length > 0) await db.trainerDecisions.bulkAdd(decisions);
    },
  );
  return true;
}

// ---------------------------------------------------------------- utilita'

export function locate(
  program: TrainerProgram,
  dayId: ID,
): { week: TrainerProgram["weeks"][number]; day: TrainerDay } | null {
  for (const week of program.weeks) {
    const day = week.days.find((item) => item.id === dayId);
    if (day) return { week, day };
  }
  return null;
}

/** Ridistribuisce le date dalla settimana `from` in poi, a partire da oggi. */
function reschedule(program: TrainerProgram, from: number, now: ISODate): void {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const first = program.weeks.find((item) => item.index === from);
  if (!first) return;

  const offsets = first.days.map((day, index) =>
    day.plannedFor ? dayDiff(first.days[0].plannedFor ?? day.plannedFor, day.plannedFor) : index,
  );

  for (const week of program.weeks) {
    if (week.index < from) continue;
    week.days.forEach((day, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + (week.index - from) * 7 + (offsets[index] ?? index));
      day.plannedFor = date.toISOString();
    });
  }
}

/** Il nuovo `startedAt` implicito: la settimana `from` comincia oggi. */
function shiftStart(program: TrainerProgram, from: number, now: ISODate): ISODate {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (from - 1) * 7);
  return start.toISOString();
}

function dayDiff(a: ISODate, b: ISODate): number {
  const from = new Date(a);
  from.setHours(0, 0, 0, 0);
  const to = new Date(b);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
