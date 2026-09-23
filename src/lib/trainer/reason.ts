import { formatKg, formatKgValue } from "@/lib/format";
import type { ProgressionDecision, TrainerExercise } from "@/lib/db/trainer-schema";
import { PROGRESSION_RULES } from "./rules";

/**
 * La **riga del perche'** (§4.25), come testo.
 *
 * Non e' un componente: e' una funzione pura che, da un esercizio e dalla sua
 * decisione, produce il tono, la frase e la frase del prossimo passo. Il componente
 * ci mette sopra icona e colore, e quindi i tre canali di §8.2 sono garantiti per
 * costruzione: **la frase da sola basta**, icona e colore la ripetono.
 *
 * Tratta anche il caso in cui la decisione **non c'e'** — un giorno di una settimana
 * che il programma non ha ancora raggiunto. La risposta onesta li' non e' una riga
 * vuota ne' una decisione inventata: e' «prima volta», che e' esattamente cio' che
 * quell'esercizio e' per adesso.
 */

export type ReasonTone = "up" | "hold" | "down" | "deload" | "first" | "manual";

export interface ReasonView {
  tone: ReasonTone;
  /** la frase visibile sotto il carico */
  text: string;
  /** il nome della regola: «Doppia progressione» */
  ruleName: string;
  /** che cosa serve per il prossimo passo — obbligatoria su ogni esercizio */
  nextStepHint: string;
  /** il carico proposto, `null` quando il campo resta vuoto */
  weightKg: number | null;
}

const TONE_BY_DIRECTION: Record<ProgressionDecision["direction"], ReasonTone> = {
  up: "up",
  hold: "hold",
  down: "down",
  deload: "deload",
  manual: "manual",
};

export function reasonView(
  exercise: TrainerExercise,
  decision?: ProgressionDecision,
): ReasonView {
  if (!decision) {
    return {
      tone: exercise.suggestedWeightKg == null ? "first" : "hold",
      text:
        exercise.suggestedWeightKg == null
          ? "Prima volta — parti leggero e tara il carico"
          : `Stesso carico — ${formatKg(exercise.suggestedWeightKg)} dall'ultima volta`,
      ruleName: PROGRESSION_RULES[exercise.suggestedWeightKg == null ? "first-time" : "skip-hold"].name,
      nextStepHint:
        exercise.suggestedWeightKg == null
          ? `Scegli un peso che ti lasci due ripetizioni di margine: da ${exercise.sets}×${exercise.repsMax} in poi il carico te lo propongo io.`
          : `Completa ${exercise.sets}×${exercise.repsMax} a RPE ≤ ${formatKgValue(exercise.rpeTarget)} e alla prossima salgo.`,
      weightKg: exercise.suggestedWeightKg,
    };
  }

  const tone = decision.rule === "first-time" ? "first" : TONE_BY_DIRECTION[decision.direction];

  return {
    tone,
    text: withDelta(decision),
    ruleName: PROGRESSION_RULES[decision.rule].name,
    nextStepHint: decision.nextStepHint,
    weightKg: decision.toWeightKg,
  };
}

/** «+2,5 kg — 3 serie su 3 al tetto»: il delta davanti, il motivo dopo. */
function withDelta(decision: ProgressionDecision): string {
  const { fromWeightKg: from, toWeightKg: to } = decision;
  if (from == null || to == null || from === to) return decision.humanReason;
  const delta = Math.round((to - from) * 100) / 100;
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatKg(Math.abs(delta))} — ${decision.humanReason}`;
}

/** Il nome accessibile del pulsante che apre il foglio (§8.10). */
export function reasonButtonLabel(exercise: TrainerExercise, view: ReasonView): string {
  return view.weightKg == null
    ? `Perché nessun carico proposto su ${exercise.exerciseName}`
    : `Perché ${formatKg(view.weightKg)} su ${exercise.exerciseName}`;
}

/**
 * La riga del registro: nome della regola, poi il motivo.
 *
 * Il nome si omette quando la frase lo dice gia' da sola — «Prima volta: Prima volta —
 * parti leggero» e' la stessa parola detta due volte, e in un registro di venti righe
 * si nota subito.
 */
export function registerLine(decision: ProgressionDecision): string {
  const name = PROGRESSION_RULES[decision.rule].name;
  const reason = decision.humanReason;
  const inizia = reason
    .toLocaleLowerCase("it-IT")
    .startsWith(name.toLocaleLowerCase("it-IT"));
  return inizia ? reason : `${name}: ${reason}`;
}

/** Il conto, per il blocco 3 del foglio: «da 80 kg → 82,5 kg». */
export function reasonMath(decision: ProgressionDecision): string | null {
  const { fromWeightKg: from, toWeightKg: to } = decision;
  if (from == null || to == null) return null;
  if (from === to) return `${formatKg(from)}, invariato`;
  const delta = Math.round((to - from) * 100) / 100;
  return `da ${formatKg(from)} → ${formatKg(to)} (${delta > 0 ? "+" : "−"}${formatKg(
    Math.abs(delta),
  )})`;
}
