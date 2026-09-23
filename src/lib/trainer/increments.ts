import { EQUIPMENT_STEP_KG, type Exercise, type Settings } from "@/lib/db/schema";
import { patternOf } from "./patterns";

/**
 * Di quanto si sale, attrezzo per attrezzo — §4.25, «Incrementi minimi».
 *
 * Sono **impostazioni**, non costanti nel codice: chi si allena in una palestra con i
 * manubri da 2,5 kg deve poterlo dire, e chi ha i micro-dischi da mezzo chilo pure.
 * Quello che resta fisso e' la mappa fra attrezzo e impostazione, perche' dipende da
 * come e' fatto l'attrezzo e non da chi lo usa.
 *
 * `stepKgOverride` sull'esercizio vince (§4.25) — ma **solo quando dice qualcosa in
 * piu'** del generico. Le voci di libreria ereditano `stepKgOverride` da
 * `EQUIPMENT_STEP_KG`, che e' la stessa tabella per attrezzo che c'e' gia' qui: se la
 * si lasciasse vincere comunque, le sei impostazioni del Trainer non avrebbero effetto
 * su nessun esercizio precaricato — cioe' su tutti — e «chi ha i manubri da 2,5 kg deve
 * poterlo dire» resterebbe una frase nel documento. Vince quando **diverge** dal
 * default dell'attrezzo: li' e' un fatto dell'esercizio (una pila di pesi a tacche da
 * 7 kg), non un valore di ripiego.
 */

export type TrainerIncrements = Pick<
  Settings,
  | "trainerIncrementUpperKg"
  | "trainerIncrementLowerKg"
  | "trainerIncrementDumbbellKg"
  | "trainerIncrementMachineKg"
  | "stepKgFine"
>;

const BARBELL_LIKE = new Set(["barbell", "ez-bar", "smith", "trap-bar"]);
const STACK_LIKE = new Set(["machine", "cable", "assisted-machine"]);
const DUMBBELL_LIKE = new Set(["dumbbell", "kettlebell"]);

export interface StepPair {
  /** l'incremento normale della progressione */
  stepKg: number;
  /** il piu' piccolo incremento davvero caricabile: sotto questo non si arrotonda */
  fineStepKg: number;
}

export function incrementFor(exercise: Exercise, settings: TrainerIncrements): StepPair {
  const equipment = exercise.equipment;
  const override = exercise.stepKgOverride;
  if (override != null && override > 0 && override !== EQUIPMENT_STEP_KG[equipment]) {
    return { stepKg: override, fineStepKg: override };
  }

  if (DUMBBELL_LIKE.has(equipment)) {
    const step = settings.trainerIncrementDumbbellKg;
    // Un manubrio da 22 non diventa da 23: fra una taglia e l'altra non c'e' niente.
    return { stepKg: step, fineStepKg: step };
  }

  if (STACK_LIKE.has(equipment)) {
    const step = settings.trainerIncrementMachineKg;
    return { stepKg: step, fineStepKg: step };
  }

  if (BARBELL_LIKE.has(equipment)) {
    /*
      Il bilanciere sale di 5 kg sulle alzate della parte bassa e di 2,5 su quelle
      della parte alta: sono due dischi da 2,5 e due da 1,25, e un +5 in panca e' un
      salto che quasi nessuno fa due settimane di fila.
    */
    const pattern = patternOf(exercise);
    const lower =
      exercise.muscleGroup === "legs" || pattern === "femorali" || pattern === "quadricipiti";
    return {
      stepKg: lower ? settings.trainerIncrementLowerKg : settings.trainerIncrementUpperKg,
      fineStepKg: settings.stepKgFine,
    };
  }

  // Corpo libero zavorrato, bande, dischi, palla medica: si sale con quello che si ha.
  const step = settings.trainerIncrementUpperKg;
  return { stepKg: step, fineStepKg: step };
}
