import { newId } from "@/lib/db/db";
import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Equipment,
  type Exercise,
  type ID,
  type ISODate,
  type MuscleGroup,
  type Settings,
} from "@/lib/db/schema";
import type {
  TrainerDay,
  TrainerExercise,
  TrainerProfile,
  TrainerProgram,
  TrainerWeek,
} from "@/lib/db/trainer-schema";
import { PATTERN_LABEL, PATTERN_MUSCLE, isSlotEligible, patternOf, type Pattern } from "./patterns";
import { deloadPrescription, prescribe, type Role } from "./prescription";
import {
  dayOffsets,
  exerciseCountFor,
  orderedSlots,
  splitFor,
  fallbackSplit,
  type DaySlot,
  type DaysPerWeek,
  type Split,
} from "./splits";

/**
 * Il generatore: dal profilo al programma.
 *
 * **Funzione pura.** Non tocca Dexie, non legge `Date.now()`, non guarda il DOM: prende
 * le risposte del questionario, la libreria dell'utente, il suo storico e le sue
 * impostazioni, e restituisce un programma. E' cosi' che si puo' provare che «ogni
 * giorno usa solo l'attrezzatura dichiarata» senza aprire un browser — ed e' una
 * proprieta' che con un browser di mezzo nessuno verificherebbe piu' di una volta.
 *
 * Il metodo, in tre passaggi:
 *  1. lo **split** decide la forma della settimana (§ `splits.ts`);
 *  2. ogni slot del giorno prende il miglior esercizio **compatibile con l'attrezzatura**;
 *  3. la **prescrizione** (serie, ripetizioni, RPE, recupero) viene dall'obiettivo, dal
 *     ruolo e dal livello, e nella settimana di scarico si taglia.
 *
 * Il carico della prima settimana **non si inventa**: se l'utente ha storico si parte
 * da li', altrimenti il campo resta vuoto ed e' la regola `first-time` a dirlo (§4.25).
 */

export const RULE_SET_VERSION = 1;
export const DEFAULT_WEEKS_TOTAL = 8;

export interface ExerciseHistory {
  lastWeightKg: number | null;
  lastReps: number | null;
  lastAt: ISODate;
  sessionId: ID;
}

export interface GenerateInput {
  profile: TrainerProfile;
  /** la libreria dell'utente, personalizzati compresi */
  library: readonly Exercise[];
  settings: Pick<Settings, "trainerDeloadEveryWeeks">;
  now: ISODate;
  /** l'ultimo carico di lavoro per esercizio, se c'e' */
  history?: ReadonlyMap<ID, ExerciseHistory>;
  weeksTotal?: number;
  /** iniettabile per i test: gli id non devono essere casuali quando si confrontano */
  makeId?: () => string;
}

export type GenerateResult =
  | { ok: true; program: TrainerProgram }
  | { ok: false; reason: string };

const GOAL_LABEL: Record<TrainerProfile["goal"], string> = {
  strength: "Forza",
  hypertrophy: "Ipertrofia",
  recomp: "Ricomposizione",
  maintenance: "Mantenimento",
};

const LETTERS = "ABCDEF";

export function generateProgram(input: GenerateInput): GenerateResult {
  const { profile, library, settings, now } = input;
  const makeId = input.makeId ?? newId;
  const weeksTotal = input.weeksTotal ?? DEFAULT_WEEKS_TOTAL;
  const history = input.history ?? new Map<ID, ExerciseHistory>();

  if (profile.equipment.length === 0) {
    return { ok: false, reason: "Non hai indicato nessun attrezzo." };
  }

  const available = new Set(profile.equipment);
  const pool = library
    .filter((row) => !row.archivedAt && available.has(row.equipment) && isSlotEligible(row))
    /*
      Ordine di preferenza: prima i piu' usati. `popularity` esiste nella libreria
      apposta (§9.4), quindi la scelta non dipende dall'ordine alfabetico — che
      regalerebbe «Ab roller» come primo esercizio di core a chiunque.
    */
    .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name, "it-IT"));

  if (pool.length === 0) {
    return { ok: false, reason: equipmentReason(profile.equipment) };
  }

  const byPattern = new Map<Pattern, Exercise[]>();
  for (const row of pool) {
    const pattern = patternOf(row);
    const list = byPattern.get(pattern);
    if (list) list.push(row);
    else byPattern.set(pattern, [row]);
  }

  const daysPerWeek = profile.daysPerWeek as DaysPerWeek;
  const perDay = exerciseCountFor(profile.sessionMinutes, profile.level);
  const offsets = dayOffsets(daysPerWeek);
  const deloadEvery = Math.max(2, settings.trainerDeloadEveryWeeks || 4);
  const start = startOfDay(now);

  /*
    Lo split scelto, e il ripiego. Con un catalogo stretto — il preset «Corpo libero»
    e' il caso vero, non un'ipotesi — un push/pull/legs produce un giorno di trazione
    con un esercizio dentro. Allora si ripiega sul full body invece di consegnarlo
    monco, e solo se anche quello non regge si rifiuta con il motivo esatto (§4.23).
  */
  let split = splitFor(daysPerWeek, profile.level);
  let plan = planDays(split, profile, byPattern, perDay);
  if (!plan.ok && split.label !== fallbackSplit(daysPerWeek).label) {
    split = fallbackSplit(daysPerWeek);
    plan = planDays(split, profile, byPattern, perDay);
  }
  if (!plan.ok) {
    return { ok: false, reason: plan.reason };
  }
  const dayPlans = plan.dayPlans;

  const weeks: TrainerWeek[] = [];
  for (let weekIndex = 1; weekIndex <= weeksTotal; weekIndex += 1) {
    const isDeload = weekIndex % deloadEvery === 0;
    const kind: TrainerWeek["kind"] = isDeload
      ? "scarico"
      : weekIndex > weeksTotal / 2
        ? "intensificazione"
        : "accumulo";

    const days: TrainerDay[] = dayPlans.map((plan, dayIndex) => {
      const exercises: TrainerExercise[] = plan.picks.map((pick, order) => {
        const base = prescribe(profile.goal, pick.role, profile.level);
        const prescription = isDeload ? deloadPrescription(base) : base;
        const known = weekIndex === 1 ? history.get(pick.exercise.id) : undefined;
        return {
          exerciseId: pick.exercise.id,
          exerciseName: pick.exercise.name,
          order,
          sets: prescription.sets,
          repsMin: prescription.repsMin,
          repsMax: prescription.repsMax,
          rpeTarget: prescription.rpeTarget,
          restSec: prescription.restSec,
          suggestedWeightKg: known?.lastWeightKg ?? null,
        };
      });

      return {
        id: makeId(),
        weekIndex,
        dayIndex: dayIndex + 1,
        name: `Giorno ${LETTERS[dayIndex]} · ${plan.template.label}`,
        targetMuscles: targetsOf(plan.picks),
        estimatedMinutes: estimateMinutes(exercises),
        status: "prevista",
        plannedFor: addDays(start, (weekIndex - 1) * 7 + offsets[dayIndex]),
        exercises,
      };
    });

    weeks.push({
      index: weekIndex,
      kind,
      status: weekIndex === 1 ? "in-corso" : "futura",
      days,
    });
  }

  const program: TrainerProgram = {
    id: makeId(),
    name: `${GOAL_LABEL[profile.goal]} · ${profile.daysPerWeek} giorni · ${weeksTotal} settimane`,
    profileSnapshot: { ...profile, priorityMuscles: [...profile.priorityMuscles], equipment: [...profile.equipment] },
    goal: profile.goal,
    weeksTotal,
    currentWeek: 1,
    status: "active",
    createdAt: now,
    startedAt: now,
    ruleSetVersion: RULE_SET_VERSION,
    weeks,
  };

  return { ok: true, program };
}

/** Come si chiama lo split a parole: lo mostra il passo 5 del questionario. */
export function splitLabel(days: DaysPerWeek, level: TrainerProfile["level"]): string {
  return splitFor(days, level).label;
}

interface Chosen {
  exercise: Exercise;
  role: Role;
  pattern: Pattern;
}

interface DayPlan {
  template: { key: string; label: string };
  picks: Chosen[];
}

type PlanResult = { ok: true; dayPlans: DayPlan[] } | { ok: false; reason: string };

/**
 * I tre gruppi che un programma deve toccare per chiamarsi programma. Senza gambe non
 * e' un allenamento, e' un hobby; senza dorso e' una scoliosi con le spalle larghe.
 * Se l'attrezzatura dichiarata non li copre, si dice **quali** mancano invece di
 * consegnare tre esercizi e chiamarli settimana (§4.23, error — generazione).
 */
const MUST_COVER: readonly MuscleGroup[] = ["chest", "back", "legs"];

function planDays(
  split: Split,
  profile: TrainerProfile,
  byPattern: Map<Pattern, Exercise[]>,
  perDay: number,
): PlanResult {
  /*
    Il contatore d'uso e' **di programma, non di giorno**: e' cosi' che il secondo
    «Parte alta» non ripete esercizio per esercizio il primo. Un esercizio gia' usato
    non e' vietato — con il solo corpo libero sarebbe impossibile — ma scende in fondo
    alla coda.
  */
  const usedInProgram = new Map<string, number>();
  const dayPlans: DayPlan[] = [];
  /*
    Il minimo per giorno. Tre esercizi sono la soglia di un principiante a 45 minuti;
    per tutti gli altri un giorno che arriva a tre e' un giorno mutilato, e consegnarlo
    lo stesso sarebbe peggio che dire di no.
  */
  const minPerDay = Math.min(perDay, 4);

  for (const template of split.days) {
    const picks = fillDay({
      slots: orderedSlots(template, profile.priorityMuscles),
      byPattern,
      count: perDay,
      usedInProgram,
    });
    if (picks.length < minPerDay) {
      return {
        ok: false,
        reason: dayReason(template.label, minPerDay, profile.equipment),
      };
    }
    dayPlans.push({ template, picks });
  }

  const covered = new Set(
    dayPlans.flatMap((day) => day.picks.map((pick) => PATTERN_MUSCLE[pick.pattern])),
  );
  const missing = MUST_COVER.filter((group) => !covered.has(group));
  if (missing.length > 0) {
    return { ok: false, reason: coverageReason(missing, profile.equipment) };
  }

  return { ok: true, dayPlans };
}

function fillDay({
  slots,
  byPattern,
  count,
  usedInProgram,
}: {
  slots: DaySlot[];
  byPattern: Map<Pattern, Exercise[]>;
  count: number;
  usedInProgram: Map<string, number>;
}): Chosen[] {
  const picks: Chosen[] = [];
  const usedIds = new Set<ID>();
  const usedFamilies = new Set<string>();

  const take = (item: DaySlot): boolean => {
    for (const pattern of item.patterns) {
      const candidate = bestCandidate(
        byPattern.get(pattern),
        item.role,
        usedIds,
        usedFamilies,
        usedInProgram,
      );
      if (!candidate) continue;
      picks.push({ exercise: candidate, role: item.role, pattern });
      usedIds.add(candidate.id);
      if (candidate.family) usedFamilies.add(candidate.family);
      const key = familyKey(candidate);
      usedInProgram.set(key, (usedInProgram.get(key) ?? 0) + 1);
      return true;
    }
    return false;
  };

  for (const item of slots) {
    if (picks.length >= count) break;
    take(item);
  }

  /*
    Seconda passata. Uno slot puo' restare vuoto perche' quel pattern non esiste con
    l'attrezzatura dichiarata — con i soli manubri non c'e' nessuna trazione verticale
    — e allora il giorno uscirebbe corto di uno o due esercizi pur avendo candidati in
    abbondanza sugli altri pattern. Qui si ripassa sugli stessi pattern del giorno e si
    pesca il secondo miglior esercizio, mai una seconda voce della stessa famiglia.
  */
  for (const item of slots) {
    if (picks.length >= count) break;
    take(item);
  }

  return picks;
}

/**
 * Il candidato migliore per uno slot — a **punteggio**, non a primo-che-passa.
 *
 * Tre forze tirano in direzioni diverse e vanno pesate insieme, altrimenti vince
 * sempre l'ultima scritta:
 *
 *  - **popolarita'**: a parita' di tutto si propone quello che la gente usa davvero;
 *  - **varieta'**: una famiglia gia' usata nel programma perde terreno, cosi' il
 *    secondo giorno di gambe non e' la fotocopia del primo. Conta la *famiglia* e non
 *    l'id, altrimenti «Squat (Corpo libero)» passerebbe per un esercizio nuovo;
 *  - **ruolo**: un fondamentale deve essere un multiarticolare a carico esterno. Senza
 *    questo peso la varieta' da sola proponeva «Push up» e «Leg curl» in 5x3 a un
 *    avanzato con il bilanciere in mano — varia, e sbagliato.
 *
 * La famiglia gia' usata **dentro il giorno** resta un divieto, non un malus: due
 * panche piane nella stessa seduta non sono una variante, sono un errore.
 */
function bestCandidate(
  candidates: Exercise[] | undefined,
  role: Role,
  usedIds: Set<ID>,
  usedFamilies: Set<string>,
  usedInProgram: Map<string, number>,
): Exercise | null {
  if (!candidates || candidates.length === 0) return null;
  let best: Exercise | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const row of candidates) {
    if (usedIds.has(row.id)) continue;
    if (row.family && usedFamilies.has(row.family)) continue;
    const score = scoreFor(row, role, usedInProgram.get(familyKey(row)) ?? 0);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

const FAMILY_REUSE_PENALTY = 25;

/**
 * Gli attrezzi con cui si puo' salire davvero di due chili e mezzo alla volta.
 *
 * Una banda elastica, un disco o una palla medica sono carico esterno nello schema, ma
 * non sono carico *regolabile*: una progressione a ripetizioni basse costruita su un
 * push up alle bande e' una progressione che non puo' avanzare. Restano perfetti come
 * complementari, e non diventano mai il fondamentale del giorno.
 */
const PROGRESSIVE_EQUIPMENT = new Set<Equipment>([
  "barbell",
  "ez-bar",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "kettlebell",
  "trap-bar",
  "weighted",
  "assisted-machine",
]);

function scoreFor(exercise: Exercise, role: Role, familyUses: number): number {
  let score = exercise.popularity - familyUses * FAMILY_REUSE_PENALTY;

  if (role === "primario") {
    score += exercise.mechanics === "compound" ? 30 : -60;
    // un carico che non si puo' aumentare di 2,5 kg non regge una progressione a
    // ripetizioni basse: resta un buon esercizio, non un buon fondamentale
    score += PROGRESSIVE_EQUIPMENT.has(exercise.equipment) ? 20 : -25;
  } else if (role === "secondario") {
    score += exercise.mechanics === "compound" ? 10 : 0;
  } else {
    score += exercise.mechanics === "isolation" ? 10 : 0;
  }

  return score;
}

/** I personalizzati non hanno famiglia (§9.4): per loro l'identita' resta l'id. */
function familyKey(exercise: Exercise): string {
  return exercise.family || `id:${exercise.id}`;
}

function targetsOf(picks: Chosen[]): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const pick of picks) seen.add(PATTERN_MUSCLE[pick.pattern]);
  return [...seen];
}

/**
 * Stima dei minuti: per ogni serie, il recupero piu' il tempo di lavoro (45 secondi),
 * piu' due minuti di preparazione per esercizio. E' una stima dichiarata, non una
 * promessa: la card «Oggi» la scrive con la tilde («~60 min»).
 */
export function estimateMinutes(exercises: readonly TrainerExercise[]): number {
  let seconds = 0;
  for (const exercise of exercises) {
    seconds += exercise.sets * (exercise.restSec + 45) + 120;
  }
  return Math.round(seconds / 60);
}

function equipmentReason(equipment: readonly Equipment[]): string {
  return `Con ${listEquipment(equipment)} non trovo abbastanza esercizi per costruire un programma.`;
}

function dayReason(
  dayLabel: string,
  minPerDay: number,
  equipment: readonly Equipment[],
): string {
  return `Il giorno «${dayLabel}» resterebbe sotto i ${minPerDay} esercizi: ${listEquipment(
    equipment,
  )} non copre abbastanza movimenti.`;
}

function coverageReason(
  missing: readonly MuscleGroup[],
  equipment: readonly Equipment[],
): string {
  const names = missing.map((group) => MUSCLE_GROUP_LABEL[group].toLocaleLowerCase("it-IT"));
  const elenco =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return `Con ${listEquipment(equipment)} non riesco ad allenare ${elenco}: aggiungi almeno un attrezzo.`;
}

function listEquipment(equipment: readonly Equipment[]): string {
  const names = equipment.map((item) => EQUIPMENT_LABEL[item].toLocaleLowerCase("it-IT"));
  if (names.length === 1) return `solo ${names[0]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Mezzanotte locale del giorno di `iso`: le date del calendario sono giorni, non istanti. */
function startOfDay(iso: ISODate): Date {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(from: Date, days: number): ISODate {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export { PATTERN_LABEL };
