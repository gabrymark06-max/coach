import type { Equipment, Mechanics, MuscleGroup } from "@/lib/db/schema";

/**
 * I **pattern di movimento** — l'unita' con cui il generatore costruisce un giorno.
 *
 * Il gruppo muscolare non basta a scrivere un allenamento. `chest` tiene insieme la
 * panca e le croci, `back` tiene insieme lo stacco e il lat pulldown, `shoulders` tiene
 * insieme il lento avanti e le alzate laterali: un giorno costruito su quei tre nomi
 * puo' benissimo uscire con due panche piane, nessuna spinta sopra la testa e nessuna
 * cerniera d'anca. Il pattern dice **che cosa fa il corpo**, ed e' quello che si
 * bilancia.
 *
 * La mappa non e' una deduzione dal nome: passa da `muscleGroup` + `mechanics` +
 * famiglia, tre campi che la libreria ha gia' (§9.4). Le eccezioni — quelle in cui il
 * gruppo muscolare mente — stanno negli insiemi qui sotto, sono poche ed esplicite.
 */
export type Pattern =
  | "spinta-orizzontale"
  | "spinta-verticale"
  | "trazione-verticale"
  | "trazione-orizzontale"
  | "quadricipiti"
  | "femorali"
  | "glutei"
  | "polpacci"
  | "petto-iso"
  | "spalle-iso"
  | "dorso-iso"
  | "bicipiti"
  | "tricipiti"
  | "trapezi"
  | "core"
  | "fullbody";

export const PATTERNS: readonly Pattern[] = [
  "spinta-orizzontale",
  "spinta-verticale",
  "trazione-verticale",
  "trazione-orizzontale",
  "quadricipiti",
  "femorali",
  "glutei",
  "polpacci",
  "petto-iso",
  "spalle-iso",
  "dorso-iso",
  "bicipiti",
  "tricipiti",
  "trapezi",
  "core",
  "fullbody",
];

/** Come il pattern si chiama a schermo, nel nome del giorno e nel foglio del perche'. */
export const PATTERN_LABEL: Record<Pattern, string> = {
  "spinta-orizzontale": "Spinta orizzontale",
  "spinta-verticale": "Spinta verticale",
  "trazione-verticale": "Trazione verticale",
  "trazione-orizzontale": "Trazione orizzontale",
  quadricipiti: "Quadricipiti",
  femorali: "Femorali e cerniera d'anca",
  glutei: "Glutei",
  polpacci: "Polpacci",
  "petto-iso": "Petto di isolamento",
  "spalle-iso": "Spalle di isolamento",
  "dorso-iso": "Dorso di isolamento",
  bicipiti: "Bicipiti",
  tricipiti: "Tricipiti",
  trapezi: "Trapezi",
  core: "Core",
  fullbody: "Alzate olimpiche e full body",
};

/** Il gruppo muscolare che il pattern allena davvero: serve a `targetMuscles`. */
export const PATTERN_MUSCLE: Record<Pattern, MuscleGroup> = {
  "spinta-orizzontale": "chest",
  "spinta-verticale": "shoulders",
  "trazione-verticale": "back",
  "trazione-orizzontale": "back",
  quadricipiti: "legs",
  femorali: "legs",
  glutei: "legs",
  polpacci: "legs",
  "petto-iso": "chest",
  "spalle-iso": "shoulders",
  "dorso-iso": "back",
  bicipiti: "arms",
  tricipiti: "arms",
  trapezi: "traps",
  core: "core",
  fullbody: "fullbody",
};

/** I pattern che un muscolo privilegiato (§4.23 passo 2) fa salire di priorita'. */
export const PATTERNS_BY_MUSCLE: Record<MuscleGroup, Pattern[]> = {
  chest: ["spinta-orizzontale", "petto-iso"],
  back: ["trazione-verticale", "trazione-orizzontale", "dorso-iso"],
  shoulders: ["spinta-verticale", "spalle-iso"],
  arms: ["bicipiti", "tricipiti"],
  legs: ["quadricipiti", "femorali", "glutei", "polpacci"],
  core: ["core"],
  traps: ["trapezi"],
  fullbody: ["fullbody"],
};

/*
  Le eccezioni: i casi in cui il gruppo muscolare della libreria non coincide con il
  pattern. Sono elencate una per una perche' una regola che le indovinasse dal nome
  sbaglierebbe alla prima famiglia nuova.
*/

/** Dorso, ma il movimento e' una cerniera d'anca: lo slot e' quello dei femorali. */
const CERNIERA_ANCA = new Set([
  "stacco",
  "stacco-rumeno",
  "stacco-gambe-tese",
  "rack-pull",
  "good-morning",
]);

/** Dorso composto che tira **verso il basso**, non verso di se'. */
const TRAZIONE_VERTICALE = new Set([
  "pull-up",
  "chin-up",
  "pull-up-presa-neutra",
  "lat-pulldown",
  "lat-pulldown-braccio-singolo",
  "muscle-up",
]);

/** Braccia, lato tricipite. Il resto di `arms` e' bicipite o avambraccio. */
const TRICIPITI = new Set([
  "tricep-pushdown",
  "overhead-extension",
  "skullcrusher",
  "close-grip-bench",
  "dip-tricipiti",
  "bench-dip",
  "tricep-kickback",
]);

/** Braccia, ma non sono ne' bicipiti ne' tricipiti: restano fuori dagli slot. */
const AVAMBRACCI = new Set(["wrist-curl", "wrist-curl-inverso", "farmers-walk"]);

const FEMORALI = new Set([
  "leg-curl-sdraiato",
  "leg-curl-seduto",
  "leg-curl-in-piedi",
  "glute-ham-raise",
  "kettlebell-swing",
  "copenhagen-plank",
]);

const GLUTEI = new Set([
  "hip-thrust",
  "glute-bridge",
  "slanci-posteriori",
  "abductor",
  "adductor",
]);

const POLPACCI = new Set([
  "calf-raise-in-piedi",
  "calf-raise-seduto",
  "calf-raise-leg-press",
  "donkey-calf-raise",
]);

export interface PatternInput {
  family: string;
  muscleGroup: MuscleGroup;
  mechanics: Mechanics;
}

export function patternOf(exercise: PatternInput): Pattern {
  const { family, muscleGroup, mechanics } = exercise;

  if (CERNIERA_ANCA.has(family)) return "femorali";

  switch (muscleGroup) {
    case "core":
      return "core";
    case "fullbody":
      return "fullbody";
    case "traps":
      return "trapezi";
    case "arms":
      if (AVAMBRACCI.has(family)) return "bicipiti";
      return TRICIPITI.has(family) ? "tricipiti" : "bicipiti";
    case "chest":
      return mechanics === "isolation" ? "petto-iso" : "spinta-orizzontale";
    case "shoulders":
      return mechanics === "isolation" ? "spalle-iso" : "spinta-verticale";
    case "back":
      if (mechanics === "isolation") return "dorso-iso";
      return TRAZIONE_VERTICALE.has(family) ? "trazione-verticale" : "trazione-orizzontale";
    case "legs":
      if (FEMORALI.has(family)) return "femorali";
      if (GLUTEI.has(family)) return "glutei";
      if (POLPACCI.has(family)) return "polpacci";
      return "quadricipiti";
  }
}

/**
 * Gli avambracci non entrano in uno slot del programma: allenarli e' una scelta, non
 * un requisito di bilanciamento, e occupare un posto su cinque con un wrist curl
 * significa togliere una trazione. Restano nella libreria, e l'utente puo' aggiungerli
 * a mano in sessione.
 */
export function isSlotEligible(exercise: PatternInput): boolean {
  return !AVAMBRACCI.has(exercise.family);
}

/**
 * Gli attrezzi che un pattern richiede **almeno uno** per esistere: serve all'errore
 * di generazione, che deve dire il motivo esatto (§4.23).
 */
export function equipmentCovers(
  available: readonly Equipment[],
  candidates: readonly { equipment: Equipment }[],
): boolean {
  const set = new Set(available);
  return candidates.some((row) => set.has(row.equipment));
}
