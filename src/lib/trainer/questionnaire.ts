import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Equipment,
  type MuscleGroup,
} from "@/lib/db/schema";
import type { TrainerGoal, TrainerLevel, TrainerProfile } from "@/lib/db/trainer-schema";
import type { DaysPerWeek } from "./splits";

/**
 * Il questionario — §4.23. **Sei passi, una domanda per schermata.**
 *
 * Qui ci sono i *dati* delle sei domande e la validazione di ciascuna. La schermata li
 * disegna e non decide niente: cosi' «massimo 2 muscoli» e «almeno un attrezzo» sono
 * una riga di logica provata, non un `disabled` sparso in un componente.
 *
 * Il primario resta **sempre abilitato** (§11.8): si preme, e se la risposta manca
 * compare l'errore sotto la domanda. Un pulsante spento non dice mai perche' lo e'.
 */

export const TOTAL_STEPS = 6;
export type Step = 1 | 2 | 3 | 4 | 5 | 6;

export const GOALS: { value: TrainerGoal; title: string; line: string }[] = [
  {
    value: "strength",
    title: "Forza",
    line: "Poche ripetizioni, carichi alti, recuperi lunghi. Il numero sul bilanciere è l'obiettivo.",
  },
  {
    value: "hypertrophy",
    title: "Ipertrofia",
    line: "Serie da 6 a 15 ripetizioni e più volume: il lavoro è distribuito, non concentrato.",
  },
  {
    value: "recomp",
    title: "Ricomposizione",
    line: "Recuperi corti e ripetizioni medio-alte: si tiene il muscolo e si lavora sul dispendio.",
  },
  {
    value: "maintenance",
    title: "Mantenimento",
    line: "Meno serie e RPE più basso. Serve a non perdere terreno in un periodo pieno.",
  },
];

export const PRIORITY_MUSCLES: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "traps",
];

export const MAX_PRIORITY_MUSCLES = 2;

/** I quattordici attrezzi del passo 3, nell'ordine in cui compaiono. */
export const EQUIPMENT_CHOICES: Equipment[] = [
  "barbell",
  "ez-bar",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith",
  "bodyweight",
  "weighted",
  "assisted-machine",
  "band",
  "trap-bar",
  "medicine-ball",
  "plate",
];

/**
 * I quattro preset. Sono la risposta all'attrito misurato al passo 3 (§6.8):
 * quattordici caselle sono troppe da leggere in piedi, e quattro tocchi coprono il caso
 * di quasi tutti. Le caselle restano sotto, per chi vuole correggere.
 */
export const EQUIPMENT_PRESETS: {
  key: string;
  label: string;
  line: string;
  equipment: Equipment[];
}[] = [
  {
    key: "palestra",
    label: "Palestra completa",
    line: "Bilancieri, manubri, cavi, macchine",
    equipment: [
      "barbell",
      "ez-bar",
      "dumbbell",
      "kettlebell",
      "cable",
      "machine",
      "smith",
      "bodyweight",
      "weighted",
      "assisted-machine",
      "band",
      "trap-bar",
      "medicine-ball",
      "plate",
    ],
  },
  {
    key: "home-bilanciere",
    label: "Home gym con bilanciere",
    line: "Bilanciere, dischi, manubri, panca",
    equipment: ["barbell", "ez-bar", "dumbbell", "plate", "bodyweight", "weighted", "band"],
  },
  {
    key: "manubri",
    label: "Solo manubri",
    line: "Un paio di manubri e il corpo libero",
    equipment: ["dumbbell", "bodyweight"],
  },
  {
    key: "corpo-libero",
    label: "Corpo libero",
    line: "Nessun attrezzo, solo il tuo peso",
    equipment: ["bodyweight"],
  },
];

export const LEVELS: { value: TrainerLevel; title: string; line: string }[] = [
  {
    value: "beginner",
    title: "Principiante · meno di un anno",
    line: "Meno esercizi e meno serie, progressione a ogni seduta: c'è ancora tecnica da costruire.",
  },
  {
    value: "intermediate",
    title: "Intermedio · da 1 a 3 anni",
    line: "Volume pieno e progressione settimanale, con una settimana di scarico ogni quattro.",
  },
  {
    value: "advanced",
    title: "Avanzato · più di 3 anni",
    line: "Una serie in più sui fondamentali e RPE più alto: il margine di crescita è più stretto.",
  },
];

export const DAYS_CHOICES: DaysPerWeek[] = [2, 3, 4, 5, 6];
export const MINUTES_CHOICES: (45 | 60 | 75 | 90)[] = [45, 60, 75, 90];

/** I valori che il passo 5 mostra selezionati finche' l'utente non tocca niente. */
export const DEFAULT_DAYS: DaysPerWeek = 3;
export const DEFAULT_MINUTES: 45 | 60 | 75 | 90 = 60;

export type Draft = Partial<Omit<TrainerProfile, "id">>;

export const EMPTY_DRAFT: Draft = {
  priorityMuscles: [],
  equipment: [],
  daysPerWeek: 3,
  sessionMinutes: 60,
};

export interface StepMeta {
  step: Step;
  /** la domanda, come compare nel `<legend>` */
  question: string;
  /** la riga sotto la domanda; `null` dove la domanda basta da sola */
  hint: string | null;
}

export const STEPS: StepMeta[] = [
  { step: 1, question: "Qual è il tuo obiettivo?", hint: "Decide serie, ripetizioni e recuperi." },
  {
    step: 2,
    question: "Quali muscoli vuoi privilegiare?",
    hint: "Al massimo due. Puoi anche non sceglierne nessuno.",
  },
  {
    step: 3,
    question: "Che attrezzatura hai?",
    hint: "Parti da un preset e correggi quello che serve.",
  },
  { step: 4, question: "Da quanto ti alleni?", hint: "Ogni scelta cambia volume e progressione." },
  { step: 5, question: "Quanti giorni a settimana?", hint: "Il numero di giorni decide lo split." },
  { step: 6, question: "Ecco cosa ho capito", hint: null },
];

export interface StepError {
  message: string;
  /** l'uscita offerta dall'errore (§5.3): mai un vicolo cieco */
  escape?: { label: string; patch: Draft };
}

/** La validazione di un passo. `null` = si può proseguire. */
export function validateStep(step: Step, draft: Draft): StepError | null {
  switch (step) {
    case 1:
      return draft.goal ? null : { message: "Scegli un obiettivo per continuare." };
    case 2:
      return (draft.priorityMuscles?.length ?? 0) > MAX_PRIORITY_MUSCLES
        ? { message: `Puoi scegliere al massimo ${MAX_PRIORITY_MUSCLES} muscoli.` }
        : null;
    case 3:
      return (draft.equipment?.length ?? 0) > 0
        ? null
        : {
            message: "Senza attrezzi posso generare solo esercizi a corpo libero.",
            escape: { label: "Va bene, corpo libero", patch: { equipment: ["bodyweight"] } },
          };
    case 4:
      return draft.level ? null : { message: "Scegli da quanto ti alleni per continuare." };
    case 5:
      return draft.daysPerWeek && draft.sessionMinutes
        ? null
        : { message: "Scegli quanti giorni a settimana e quanto dura una seduta." };
    case 6:
      return null;
  }
}

/** Il primo passo ancora senza risposta: dove riprende una bozza. */
export function firstIncompleteStep(draft: Draft): Step {
  for (const step of [1, 2, 3, 4, 5] as Step[]) {
    if (validateStep(step, draft)) return step;
  }
  return 6;
}

/** Il profilo completo, se la bozza lo è. `null` finché manca una risposta. */
/**
 * Il profilo **provvisorio** del passo 5: quello che l'utente vede selezionato adesso,
 * anche se non ha ancora toccato giorni e durata. Serve a risolvere lo split mentre si
 * risponde — e i valori di ripiego sono gli stessi che la UI mostra, non altri.
 */
export function draftProfile(draft: Draft): TrainerProfile | null {
  if (!draft.goal || !draft.level) return null;
  if ((draft.equipment?.length ?? 0) === 0) return null;
  return {
    id: "singleton",
    goal: draft.goal,
    priorityMuscles: (draft.priorityMuscles ?? []).slice(0, MAX_PRIORITY_MUSCLES),
    equipment: draft.equipment ?? [],
    level: draft.level,
    daysPerWeek: draft.daysPerWeek ?? DEFAULT_DAYS,
    sessionMinutes: draft.sessionMinutes ?? DEFAULT_MINUTES,
  };
}

export function toProfile(draft: Draft): TrainerProfile | null {
  if (!draft.goal || !draft.level || !draft.daysPerWeek || !draft.sessionMinutes) return null;
  if ((draft.equipment?.length ?? 0) === 0) return null;
  return {
    id: "singleton",
    goal: draft.goal,
    priorityMuscles: (draft.priorityMuscles ?? []).slice(0, MAX_PRIORITY_MUSCLES),
    equipment: draft.equipment ?? [],
    level: draft.level,
    daysPerWeek: draft.daysPerWeek,
    sessionMinutes: draft.sessionMinutes,
  };
}

/**
 * Le risposte in chiaro, per il riepilogo del passo 6 (ognuna con il suo «Modifica»).
 *
 * `splitLabel` arriva **da fuori**, gia' risolto da `resolveSplit` sulla libreria vera:
 * il riepilogo non ha piu' modo di promettere uno split che il generatore non
 * costruira' (QA, secondo audit, DIFETTO 1).
 */
export function summaryRows(
  draft: Draft,
  splitLabel: string | null,
): { step: Step; label: string; value: string }[] {
  return [
    {
      step: 1,
      label: "Obiettivo",
      value: GOALS.find((goal) => goal.value === draft.goal)?.title ?? "—",
    },
    {
      step: 2,
      label: "Muscoli privilegiati",
      value:
        (draft.priorityMuscles ?? []).length === 0
          ? "Nessuna preferenza"
          : (draft.priorityMuscles ?? []).map((item) => MUSCLE_GROUP_LABEL[item]).join(", "),
    },
    {
      step: 3,
      label: "Attrezzatura",
      value: describeEquipment(draft.equipment ?? []),
    },
    {
      step: 4,
      label: "Livello",
      value: LEVELS.find((level) => level.value === draft.level)?.title ?? "—",
    },
    {
      step: 5,
      label: "Settimana",
      value:
        draft.daysPerWeek && draft.sessionMinutes && draft.level
          ? `${draft.daysPerWeek} giorni da ${draft.sessionMinutes} minuti${
              splitLabel ? ` · ${splitLabel}` : ""
            }`
          : "—",
    },
  ];
}

/** «14 attrezzi» non dice niente; «Palestra completa» sì, quando il preset combacia. */
export function describeEquipment(equipment: readonly Equipment[]): string {
  if (equipment.length === 0) return "—";
  const preset = EQUIPMENT_PRESETS.find(
    (item) =>
      item.equipment.length === equipment.length &&
      item.equipment.every((value) => equipment.includes(value)),
  );
  if (preset) return preset.label;
  if (equipment.length <= 3) {
    return equipment.map((item) => EQUIPMENT_LABEL[item]).join(", ");
  }
  return `${equipment.length} attrezzi: ${equipment
    .slice(0, 3)
    .map((item) => EQUIPMENT_LABEL[item])
    .join(", ")}…`;
}
