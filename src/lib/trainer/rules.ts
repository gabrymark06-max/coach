import { formatKg, formatKgValue } from "@/lib/format";
import type { ID, ISODate } from "@/lib/db/schema";
import type {
  ProgressionDecision,
  ProgressionRule,
  TrainerExercise,
  TrainerWeek,
} from "@/lib/db/trainer-schema";

/**
 * Il motore di progressione — le nove regole di §4.25.
 *
 * **Sono dati, non `if` sparsi.** `PROGRESSION_RULES` e' la tabella che il foglio
 * «Perche' questo carico» legge per scrivere il nome della regola e la riga di
 * spiegazione; `decideProgression` e' la funzione pura che, davanti a quello che
 * l'utente ha davvero fatto, dice quale regola scatta e con che effetto.
 *
 * Due cose che questo modulo **non** fa, di proposito:
 *  - non legge il database: prende le sedute gia' estratte e restituisce una bozza di
 *    decisione. E' cosi' che tutte e nove le regole si provano senza browser;
 *  - non arrotonda in silenzio. Se un incremento non e' caricabile con l'attrezzo, la
 *    decisione lo dice nella frase e il carico resta dov'e' (§4.25, «incrementi minimi»).
 */

export interface RuleSpec {
  /** il nome mostrato: «Doppia progressione» */
  name: string;
  /** quando scatta, in una riga */
  when: string;
  /** che cosa fa, in una riga */
  effect: string;
}

export const PROGRESSION_RULES: Record<ProgressionRule, RuleSpec> = {
  "double-progression": {
    name: "Doppia progressione",
    when: "Tutte le serie al tetto dell'intervallo, con l'RPE medio entro l'obiettivo.",
    effect: "Salgo di un incremento e le ripetizioni tornano al fondo dell'intervallo.",
  },
  "reps-first": {
    name: "Prima le ripetizioni",
    when: "Le serie sono complete ma non sei ancora in cima all'intervallo.",
    effect: "Stesso carico, una ripetizione in più sulla prima serie che non è al tetto.",
  },
  "rpe-cap": {
    name: "Freno da RPE",
    when: "Una serie è arrivata allo sforzo massimo che ci siamo dati.",
    effect: "L'aumento previsto si dimezza. Se mezzo incremento non è caricabile, resto fermo.",
  },
  "hold-on-miss": {
    name: "Mantenimento",
    when: "Una seduta è rimasta sotto il fondo dell'intervallo di ripetizioni.",
    effect: "Carico invariato: prima si completa, poi si sale.",
  },
  "deload-on-miss": {
    name: "Riduzione",
    when: "Due sedute di fila sotto il fondo dell'intervallo.",
    effect: "Carico giù del 10%, arrotondato a quello che si può caricare davvero.",
  },
  "planned-deload": {
    name: "Scarico programmato",
    when: "La settimana che arriva è quella di scarico del ciclo.",
    effect: "Volume giù del 40% e carico giù del 10%: è lì che il progresso si consolida.",
  },
  "skip-hold": {
    name: "Settimana saltata",
    when: "Nella settimana non è stato registrato nessun allenamento.",
    effect: "Nessuna progressione. Il carico resta l'ultimo che hai davvero usato.",
  },
  "first-time": {
    name: "Prima volta",
    when: "Non ho nessuno storico per questo esercizio.",
    effect: "Nessun carico proposto: parti leggero e tara tu il peso sulla prima serie.",
  },
  manual: {
    name: "Tua scelta",
    when: "Hai deciso tu il carico da questo foglio.",
    effect: "Il valore che hai indicato diventa la nuova base della progressione.",
  },
};

/** Ordine di lettura nel registro e nei filtri: dalla piu' frequente alla piu' rara. */
export const PROGRESSION_RULE_ORDER: readonly ProgressionRule[] = [
  "double-progression",
  "reps-first",
  "rpe-cap",
  "hold-on-miss",
  "deload-on-miss",
  "planned-deload",
  "skip-hold",
  "first-time",
  "manual",
];

export interface PerformedSet {
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface SessionPerformance {
  sessionId: ID;
  date: ISODate;
  /** solo le serie allenanti completate */
  sets: PerformedSet[];
  /** quante ne erano previste dal programma */
  setsPlanned: number;
}

export interface DecideInput {
  /** l'esercizio **come era prescritto** nella settimana appena chiusa */
  planned: TrainerExercise;
  /** le sedute di questo esercizio dentro il programma, dalla piu' recente */
  performances: readonly SessionPerformance[];
  /** il tipo della settimana **per cui** si decide, cioe' la prossima */
  nextWeekKind: TrainerWeek["kind"];
  /** incremento minimo dell'attrezzo (§9.5: e' un'impostazione, non una costante) */
  stepKg: number;
  /** il piu' piccolo incremento davvero caricabile: 1,25 kg su un bilanciere */
  fineStepKg: number;
  rpeCap: number;
  decidedAt: ISODate;
  /** la settimana e' passata senza nemmeno un allenamento */
  weekSkipped?: boolean;
  /** «Non sono d'accordo»: l'override entra nel registro come ogni altra decisione */
  manual?: { weightKg: number; note?: string };
}

export type DecisionDraft = Pick<
  ProgressionDecision,
  | "rule"
  | "direction"
  | "fromWeightKg"
  | "toWeightKg"
  | "fromReps"
  | "toReps"
  | "evidence"
  | "humanReason"
  | "nextStepHint"
>;

const DELOAD_FACTOR = 0.9;

export function decideProgression(input: DecideInput): DecisionDraft {
  const { planned, performances, stepKg, fineStepKg, rpeCap } = input;
  const last = performances[0];
  const previous = performances[1];

  const range: [number, number] = [planned.repsMin, planned.repsMax];
  const base = workingWeight(last) ?? planned.suggestedWeightKg;
  const evidence = evidenceOf(planned, performances.slice(0, 2));

  // 1 — la scelta dell'utente vince su tutto, anche sullo scarico programmato.
  if (input.manual) {
    const note = input.manual.note?.trim();
    return {
      rule: "manual",
      direction: "manual",
      fromWeightKg: base,
      toWeightKg: input.manual.weightKg,
      fromReps: range,
      toReps: range,
      evidence,
      humanReason: note
        ? `Carico scelto da te: ${note}`
        : `Carico scelto da te il ${shortDate(input.decidedAt)}`,
      nextStepHint: `Riparto da ${formatKg(
        input.manual.weightKg,
      )}: completa ${planned.sets}×${planned.repsMax} a RPE ≤ ${formatRpe(planned.rpeTarget)} e torno a salire.`,
    };
  }

  // 2 — settimana senza nemmeno un allenamento: non si tocca niente.
  if (input.weekSkipped || performances.length === 0) {
    if (base == null) {
      return {
        rule: "first-time",
        direction: "hold",
        fromWeightKg: null,
        toWeightKg: null,
        fromReps: null,
        toReps: range,
        evidence,
        humanReason: "Prima volta — parti leggero e tara il carico",
        nextStepHint: `Scegli un peso che ti lasci due ripetizioni di margine a fine serie: da ${planned.sets}×${planned.repsMax} in poi comincio a proporti io il carico.`,
      };
    }
    if (input.weekSkipped) {
      return {
        rule: "skip-hold",
        direction: "hold",
        fromWeightKg: base,
        toWeightKg: base,
        fromReps: range,
        toReps: range,
        evidence,
        humanReason: "Nessun allenamento registrato nella settimana",
        nextStepHint: `Riprendi da ${formatKg(base)}: completa ${planned.sets}×${planned.repsMax} a RPE ≤ ${formatRpe(planned.rpeTarget)} e riparto a salire.`,
      };
    }
  }

  // 3 — lo scarico e' programmato: scatta prima di qualunque lettura della prestazione.
  if (input.nextWeekKind === "scarico" && base != null) {
    const to = roundToStep(base * DELOAD_FACTOR, stepKg);
    return {
      rule: "planned-deload",
      direction: "deload",
      fromWeightKg: base,
      toWeightKg: to,
      fromReps: range,
      toReps: range,
      evidence,
      humanReason: "Scarico — settimana di scarico prevista dal ciclo",
      nextStepHint: `Fai questa settimana a ${formatKg(to)} senza cercare il massimo: la settimana dopo si riparte da ${formatKg(base)}.`,
    };
  }

  if (base == null) {
    return {
      rule: "first-time",
      direction: "hold",
      fromWeightKg: null,
      toWeightKg: null,
      fromReps: null,
      toReps: range,
      evidence,
      humanReason: "Prima volta — parti leggero e tara il carico",
      nextStepHint: `Scegli un peso che ti lasci due ripetizioni di margine a fine serie: da ${planned.sets}×${planned.repsMax} in poi comincio a proporti io il carico.`,
    };
  }

  const missed = (performance: SessionPerformance | undefined) =>
    performance != null && belowFloor(performance, planned);

  // 4 — due sedute di fila sotto il fondo: si scende.
  if (missed(last) && missed(previous)) {
    const to = roundToStep(base * DELOAD_FACTOR, stepKg);
    return {
      rule: "deload-on-miss",
      direction: "down",
      fromWeightKg: base,
      toWeightKg: to,
      fromReps: range,
      toReps: range,
      evidence,
      humanReason: `−10% — due sedute sotto le ${planned.repsMin} ripetizioni`,
      nextStepHint: `A ${formatKg(to)} completa ${planned.sets}×${planned.repsMin} pulite: da lì ricomincio a salire.`,
    };
  }

  // 5 — una sola seduta sotto il fondo: si tiene.
  if (missed(last)) {
    return {
      rule: "hold-on-miss",
      direction: "hold",
      fromWeightKg: base,
      toWeightKg: base,
      fromReps: range,
      toReps: range,
      evidence,
      humanReason: `Stesso carico — ${describeSets(last, planned)}`,
      nextStepHint: `Completa ${planned.sets}×${planned.repsMin} a ${formatKg(base)} e la volta dopo torno a proporti un aumento.`,
    };
  }

  const atTop = allAtTop(last, planned);
  const meanRpe = averageRpe(last);
  const peakRpe = peak(last);

  // 6 — tutte al tetto e RPE sotto controllo: si sale.
  if (atTop && (meanRpe == null || meanRpe <= planned.rpeTarget)) {
    const capped = peakRpe != null && peakRpe >= rpeCap;

    if (capped) {
      const half = Math.floor(stepKg / 2 / fineStepKg) * fineStepKg;
      const loadable = round2(half);
      if (loadable <= 0) {
        return {
          rule: "rpe-cap",
          direction: "hold",
          fromWeightKg: base,
          toWeightKg: base,
          fromReps: range,
          toReps: range,
          evidence,
          humanReason: `Una serie a RPE ${formatRpe(peakRpe!)} — e con questo attrezzo mezzo incremento non esiste, quindi tengo il carico`,
          nextStepHint: `Rifai ${planned.sets}×${planned.repsMax} a ${formatKg(base)} restando sotto RPE ${formatRpe(rpeCap)} e salgo a ${formatKg(round2(base + stepKg))}.`,
        };
      }
      const to = round2(base + loadable);
      return {
        rule: "rpe-cap",
        direction: "up",
        fromWeightKg: base,
        toWeightKg: to,
        fromReps: range,
        toReps: range,
        evidence,
        humanReason: `+${formatKg(loadable)} invece di ${formatKg(stepKg)} — una serie a RPE ${formatRpe(peakRpe!)}`,
        nextStepHint: `Completa ${planned.sets}×${planned.repsMax} a ${formatKg(to)} restando sotto RPE ${formatRpe(rpeCap)} e torno all'incremento pieno.`,
      };
    }

    const to = round2(base + stepKg);
    return {
      rule: "double-progression",
      direction: "up",
      fromWeightKg: base,
      toWeightKg: to,
      fromReps: range,
      toReps: range,
      evidence,
      humanReason: `${last.sets.length} serie su ${planned.sets} al tetto, RPE medio ${formatRpe(meanRpe ?? planned.rpeTarget)}`,
      nextStepHint: `Completa ${planned.sets}×${planned.repsMax} a ${formatKg(to)} con RPE ≤ ${formatRpe(planned.rpeTarget)} e la prossima volta salgo a ${formatKg(round2(to + stepKg))}.`,
    };
  }

  // 7 — dentro l'intervallo ma non in cima: prima le ripetizioni.
  const worst = lowestReps(last);
  const target = Math.min(planned.repsMax, worst + 1);
  return {
    rule: "reps-first",
    direction: "hold",
    fromWeightKg: base,
    toWeightKg: base,
    fromReps: range,
    toReps: range,
    evidence,
    humanReason:
      meanRpe != null && meanRpe > planned.rpeTarget
        ? `Stesso carico — RPE medio ${formatRpe(meanRpe)}, sopra l'obiettivo ${formatRpe(planned.rpeTarget)}`
        : `Stesso carico — ${describeSets(last, planned)}`,
    nextStepHint: `Porta la serie da ${worst} a ${target} ripetizioni a ${formatKg(base)}: quando tutte arrivano a ${planned.repsMax}, salgo a ${formatKg(round2(base + stepKg))}.`,
  };
}

/** Il carico di lavoro di una seduta: la serie completata piu' pesante. */
export function workingWeight(performance: SessionPerformance | undefined): number | null {
  if (!performance) return null;
  let max: number | null = null;
  for (const set of performance.sets) {
    if (!set.completed || set.weightKg == null) continue;
    if (max == null || set.weightKg > max) max = set.weightKg;
  }
  return max;
}

function belowFloor(performance: SessionPerformance, planned: TrainerExercise): boolean {
  if (performance.sets.length < planned.sets) return true;
  return performance.sets.some((set) => (set.reps ?? 0) < planned.repsMin);
}

function allAtTop(performance: SessionPerformance, planned: TrainerExercise): boolean {
  if (performance.sets.length < planned.sets) return false;
  return performance.sets.every((set) => (set.reps ?? 0) >= planned.repsMax);
}

function averageRpe(performance: SessionPerformance): number | null {
  const values = performance.sets
    .map((set) => set.rpe)
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function peak(performance: SessionPerformance): number | null {
  let max: number | null = null;
  for (const set of performance.sets) {
    if (set.rpe == null) continue;
    if (max == null || set.rpe > max) max = set.rpe;
  }
  return max;
}

function lowestReps(performance: SessionPerformance): number {
  let min = Number.POSITIVE_INFINITY;
  for (const set of performance.sets) min = Math.min(min, set.reps ?? 0);
  return Number.isFinite(min) ? min : 0;
}

function describeSets(
  performance: SessionPerformance,
  planned: TrainerExercise,
): string {
  const done = performance.sets.length;
  if (done < planned.sets) return `${done} serie su ${planned.sets}`;
  return `ripetizioni ${performance.sets.map((set) => set.reps ?? 0).join(", ")}`;
}

function evidenceOf(
  planned: TrainerExercise,
  performances: readonly SessionPerformance[],
): ProgressionDecision["evidence"] {
  const first = performances[0];
  return {
    sessionIds: performances.map((item) => item.sessionId),
    setsCompleted: first?.sets.length ?? 0,
    setsPlanned: first?.setsPlanned ?? planned.sets,
    repsAchieved: first?.sets.map((set) => set.reps ?? 0) ?? [],
    rpeObserved: first?.sets.map((set) => set.rpe ?? null) ?? [],
  };
}

/** Arrotonda all'incremento caricabile piu' vicino, mai sotto un incremento. */
export function roundToStep(value: number, stepKg: number): number {
  if (stepKg <= 0) return round2(value);
  return round2(Math.max(stepKg, Math.round(value / stepKg) * stepKg));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `7,5` — l'RPE si scrive con la virgola come ogni altro numero (§11.4). */
export function formatRpe(value: number): string {
  return formatKgValue(value);
}

function shortDate(iso: ISODate): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(
    new Date(iso),
  );
}
