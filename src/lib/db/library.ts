import {
  EQUIPMENT_LABEL,
  EQUIPMENT_LOAD_MODE,
  EQUIPMENT_STEP_KG,
  exerciseKey,
  type Equipment,
  type LoadMode,
  type Mechanics,
  type MuscleGroup,
} from "./schema";

/**
 * La libreria precaricata — `docs/esercizi-hevy.md`, ~270 voci.
 *
 * **Ogni combinazione movimento x attrezzo e' un esercizio distinto** (spec-v2 §3):
 * `Panca piana (Bilanciere)`, `(Manubri)`, `(Smith machine)` e `(Macchina)` sono
 * quattro voci, non una con un menu a tendina. E' la scelta del riferimento, ed e'
 * quella giusta: il carico di una panca ai manubri non ha niente a che vedere con
 * quello al bilanciere, e tenerli insieme rovinerebbe sia lo storico sia i record.
 *
 * Convenzione di nome, vincolante (§9.4): `Nome del movimento (Attrezzo)`, con la
 * qualifica di presa o di angolo **prima** della parentesi —
 * `Lat pulldown presa inversa (Cavi)`. Maiuscola solo sulla prima parola (§11.10).
 *
 * La tabella si scrive per **famiglia**, non per voce: una riga elenca gli attrezzi con
 * cui quel movimento si fa, e l'espansione produce un esercizio per ognuno. Scritta
 * voce per voce sarebbe tre volte piu' lunga e si contraddirebbe da sola alla prima
 * modifica.
 */

export interface LibraryExercise {
  /** id stabile: `lib-<famiglia>[-<variante>]-<attrezzo>` */
  id: string;
  name: string;
  family: string;
  variant?: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  secondaryMuscles: MuscleGroup[];
  mechanics: Mechanics;
  unilateral: boolean;
  loadMode: LoadMode;
  stepKgOverride?: number;
  popularity: number;
  isBodyweight: boolean;
}

/** Un attrezzo, o un attrezzo con la sua qualifica. */
type Item = Equipment | [equipment: Equipment, variant: string];

interface Family {
  family: string;
  /** nome del movimento, senza attrezzo e senza qualifica */
  movement: string;
  muscleGroup: MuscleGroup;
  mechanics: Mechanics;
  items: Item[];
  secondary?: MuscleGroup[];
  unilateral?: boolean;
  /** 0-100: piu' alto = piu' in alto nella libreria senza filtri */
  popularity?: number;
  /** forza l'incremento minimo su tutta la famiglia, qualunque sia l'attrezzo */
  stepKgOverride?: number;
  /** forza il modo di carico (Farmer's walk con manubri resta carico esterno) */
  loadMode?: LoadMode;
}

const FAMILIES: Family[] = [
  // ══════════════════════════════════════════════════════════════════ PETTO
  {
    family: "panca-piana",
    movement: "Panca piana",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 100,
    items: ["barbell", "dumbbell", "smith", "machine"],
  },
  {
    family: "chest-press",
    movement: "Chest press",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 80,
    items: ["cable", "machine"],
  },
  {
    family: "spoto-press",
    movement: "Spoto press",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 20,
    items: ["barbell"],
  },
  {
    family: "floor-press",
    movement: "Floor press",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 30,
    items: ["barbell", "dumbbell"],
  },
  {
    family: "panca-inclinata",
    movement: "Panca inclinata",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 95,
    items: ["barbell", "dumbbell", "smith", "machine"],
  },
  {
    family: "chest-press-inclinata",
    movement: "Chest press inclinata",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 60,
    items: ["cable"],
  },
  {
    family: "panca-declinata",
    movement: "Panca declinata",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 55,
    items: ["barbell", "dumbbell", "smith", "machine"],
  },
  {
    family: "croci-panca-piana",
    movement: "Croci su panca piana",
    muscleGroup: "chest",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 75,
    items: ["dumbbell", "cable"],
  },
  {
    family: "croci-panca-inclinata",
    movement: "Croci su panca inclinata",
    muscleGroup: "chest",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 70,
    items: ["dumbbell", "cable"],
  },
  {
    family: "croci-panca-declinata",
    movement: "Croci su panca declinata",
    muscleGroup: "chest",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 40,
    items: ["dumbbell", "cable"],
  },
  {
    family: "pec-deck",
    movement: "Pec deck",
    muscleGroup: "chest",
    mechanics: "isolation",
    popularity: 80,
    items: ["machine"],
  },
  {
    family: "croci-in-piedi",
    movement: "Croci in piedi",
    muscleGroup: "chest",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 65,
    items: ["cable", "band"],
  },
  {
    family: "pullover",
    movement: "Pullover",
    muscleGroup: "chest",
    mechanics: "isolation",
    secondary: ["back"],
    popularity: 50,
    items: ["dumbbell", "barbell", "cable"],
  },
  {
    family: "push-up",
    movement: "Push up",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms", "core"],
    popularity: 85,
    items: ["bodyweight", "weighted", "band", "medicine-ball"],
  },
  {
    family: "push-up-declinati",
    movement: "Push up declinati",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 45,
    items: ["bodyweight"],
  },
  {
    family: "push-up-inclinati",
    movement: "Push up inclinati",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 45,
    items: ["bodyweight"],
  },
  {
    family: "dip-petto",
    movement: "Dip per il petto",
    muscleGroup: "chest",
    mechanics: "compound",
    secondary: ["arms", "shoulders"],
    popularity: 75,
    items: ["bodyweight", "weighted", "assisted-machine"],
  },

  // ══════════════════════════════════════════════════════════════════ DORSO
  {
    family: "pull-up",
    movement: "Pull up",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 95,
    items: ["bodyweight", "weighted", "assisted-machine"],
  },
  {
    family: "chin-up",
    movement: "Chin up",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 80,
    items: ["bodyweight", "weighted", "assisted-machine"],
  },
  {
    family: "pull-up-presa-neutra",
    movement: "Pull up presa neutra",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 60,
    items: ["bodyweight", "weighted"],
  },
  {
    family: "lat-pulldown",
    movement: "Lat pulldown",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 95,
    items: [
      ["cable", "presa larga"],
      ["cable", "presa stretta"],
      ["cable", "presa inversa"],
      ["cable", "presa neutra"],
      "machine",
    ],
  },
  {
    family: "lat-pulldown-braccio-singolo",
    movement: "Lat pulldown a braccio singolo",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    unilateral: true,
    popularity: 45,
    items: ["cable"],
  },
  {
    family: "rematore-bilanciere",
    movement: "Rematore con bilanciere",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 90,
    items: ["barbell", ["barbell", "presa inversa"]],
  },
  {
    family: "rematore-manubrio-un-braccio",
    movement: "Rematore con manubrio a un braccio",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    unilateral: true,
    popularity: 85,
    items: ["dumbbell"],
  },
  {
    family: "rematore-manubri",
    movement: "Rematore con manubri a busto flesso",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms", "shoulders"],
    popularity: 70,
    items: ["dumbbell"],
  },
  {
    family: "pulley",
    movement: "Pulley seduto",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 90,
    items: [
      ["cable", "presa larga"],
      ["cable", "presa stretta"],
      ["cable", "a braccio singolo"],
    ],
  },
  {
    family: "rematore-panca-inclinata",
    movement: "Rematore su panca inclinata",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 55,
    items: ["dumbbell", "barbell"],
  },
  {
    family: "t-bar-row",
    movement: "T-bar row",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 70,
    items: ["barbell", "machine"],
  },
  {
    family: "rematore-pendlay",
    movement: "Rematore Pendlay",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 40,
    items: ["barbell"],
  },
  {
    family: "rematore-meadows",
    movement: "Rematore Meadows",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    unilateral: true,
    popularity: 30,
    items: ["barbell"],
  },
  {
    family: "rematore",
    movement: "Rematore",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 65,
    items: ["smith", "machine"],
  },
  {
    family: "stacco",
    movement: "Stacco da terra",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["legs", "core"],
    popularity: 100,
    items: ["barbell", "dumbbell", "trap-bar"],
  },
  {
    family: "rack-pull",
    movement: "Rack pull",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["legs", "traps"],
    popularity: 40,
    items: ["barbell"],
  },
  {
    family: "iperestensioni",
    movement: "Iperestensioni",
    muscleGroup: "back",
    mechanics: "isolation",
    secondary: ["legs", "core"],
    popularity: 70,
    items: ["bodyweight", "weighted", "machine"],
  },
  {
    family: "good-morning",
    movement: "Good morning",
    muscleGroup: "back",
    mechanics: "compound",
    secondary: ["legs"],
    popularity: 40,
    items: ["barbell", "smith"],
  },
  {
    family: "superman",
    movement: "Superman",
    muscleGroup: "back",
    mechanics: "isolation",
    secondary: ["core"],
    popularity: 30,
    items: ["bodyweight"],
  },

  // ═══════════════════════════════════════════════════ SPALLE E TRAPEZI
  {
    family: "overhead-press",
    movement: "Lento avanti",
    muscleGroup: "shoulders",
    mechanics: "compound",
    secondary: ["arms", "core"],
    popularity: 95,
    items: ["barbell", ["barbell", "seduto"]],
  },
  {
    family: "shoulder-press",
    movement: "Shoulder press",
    muscleGroup: "shoulders",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 90,
    items: ["dumbbell", ["dumbbell", "in piedi"], "smith", "machine"],
  },
  {
    family: "arnold-press",
    movement: "Arnold press",
    muscleGroup: "shoulders",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 65,
    items: ["dumbbell"],
  },
  {
    family: "push-press",
    movement: "Push press",
    muscleGroup: "shoulders",
    mechanics: "compound",
    secondary: ["arms", "legs"],
    popularity: 45,
    items: ["barbell", "dumbbell"],
  },
  {
    family: "lento-dietro",
    movement: "Lento dietro",
    muscleGroup: "shoulders",
    mechanics: "compound",
    secondary: ["arms"],
    popularity: 35,
    items: ["barbell", "smith"],
  },
  {
    family: "alzate-laterali",
    movement: "Alzate laterali",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    popularity: 95,
    items: ["dumbbell", "cable", "machine", "band"],
  },
  {
    family: "alzate-frontali",
    movement: "Alzate frontali",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    popularity: 70,
    items: ["dumbbell", "barbell", "cable", "plate", "band"],
  },
  {
    family: "alzate-laterali-inclinate",
    movement: "Alzate laterali inclinate",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    unilateral: true,
    popularity: 45,
    items: ["cable", "dumbbell"],
  },
  {
    family: "lu-raises",
    movement: "Lu raises",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    popularity: 20,
    items: ["dumbbell"],
  },
  {
    family: "reverse-fly",
    movement: "Croci inverse",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    secondary: ["back"],
    popularity: 75,
    items: ["dumbbell", ["dumbbell", "su panca inclinata"]],
  },
  {
    family: "reverse-pec-deck",
    movement: "Reverse pec deck",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    secondary: ["back"],
    popularity: 70,
    items: ["machine"],
  },
  {
    family: "face-pull",
    movement: "Face pull",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    secondary: ["back", "traps"],
    popularity: 80,
    items: ["cable", "band"],
  },
  {
    family: "alzate-90",
    movement: "Alzate a 90 gradi",
    muscleGroup: "shoulders",
    mechanics: "isolation",
    secondary: ["back"],
    popularity: 40,
    items: ["dumbbell", "cable"],
  },
  {
    family: "scrollate",
    movement: "Scrollate",
    muscleGroup: "traps",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 80,
    items: ["barbell", "dumbbell", "smith", "machine", "cable"],
  },
  {
    family: "upright-row",
    movement: "Tirate al mento",
    muscleGroup: "traps",
    mechanics: "compound",
    secondary: ["shoulders", "arms"],
    popularity: 55,
    items: ["barbell", "dumbbell", "cable", "smith"],
  },

  // ════════════════════════════════════════════════════════════════ BRACCIA
  {
    family: "bicep-curl",
    movement: "Curl bicipiti",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 100,
    items: ["barbell", "ez-bar", "dumbbell", "cable", "machine"],
  },
  {
    family: "hammer-curl",
    movement: "Curl a martello",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 90,
    items: ["dumbbell", "cable"],
  },
  {
    family: "preacher-curl",
    movement: "Curl alla panca Scott",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 75,
    items: ["ez-bar", "barbell", "dumbbell", "machine", "cable"],
  },
  {
    family: "incline-curl",
    movement: "Curl su panca inclinata",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 60,
    items: ["dumbbell"],
  },
  {
    family: "concentration-curl",
    movement: "Curl concentrato",
    muscleGroup: "arms",
    mechanics: "isolation",
    unilateral: true,
    popularity: 55,
    items: ["dumbbell"],
  },
  {
    family: "spider-curl",
    movement: "Spider curl",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 40,
    items: ["dumbbell", "ez-bar"],
  },
  {
    family: "reverse-curl",
    movement: "Curl a presa inversa",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 50,
    items: ["barbell", "cable"],
  },
  {
    family: "tricep-pushdown",
    movement: "Push down per tricipiti",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 95,
    items: [
      ["cable", "con corda"],
      ["cable", "con barra dritta"],
      ["cable", "con barra a V"],
    ],
  },
  {
    family: "overhead-extension",
    movement: "Estensioni sopra la testa",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 75,
    items: ["dumbbell", "cable", "ez-bar"],
  },
  {
    family: "skullcrusher",
    movement: "Skullcrusher",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 80,
    items: ["ez-bar", "dumbbell", "cable"],
  },
  {
    family: "close-grip-bench",
    movement: "Panca a presa stretta",
    muscleGroup: "arms",
    mechanics: "compound",
    secondary: ["chest", "shoulders"],
    popularity: 70,
    items: ["barbell", "smith"],
  },
  {
    family: "dip-tricipiti",
    movement: "Dip per tricipiti",
    muscleGroup: "arms",
    mechanics: "compound",
    secondary: ["chest", "shoulders"],
    popularity: 75,
    items: ["bodyweight", "weighted", "assisted-machine"],
  },
  {
    family: "bench-dip",
    movement: "Dip su panca",
    muscleGroup: "arms",
    mechanics: "compound",
    secondary: ["chest", "shoulders"],
    popularity: 50,
    items: ["bodyweight", "weighted"],
  },
  {
    family: "tricep-kickback",
    movement: "Kickback per tricipiti",
    muscleGroup: "arms",
    mechanics: "isolation",
    unilateral: true,
    popularity: 45,
    items: ["dumbbell", "cable"],
  },
  {
    family: "wrist-curl",
    movement: "Wrist curl in flessione",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 25,
    items: ["barbell", "dumbbell", "cable"],
  },
  {
    family: "wrist-curl-inverso",
    movement: "Wrist curl in estensione",
    muscleGroup: "arms",
    mechanics: "isolation",
    popularity: 20,
    items: ["barbell", "dumbbell", "cable"],
  },
  {
    family: "farmers-walk",
    movement: "Camminata del contadino",
    muscleGroup: "arms",
    mechanics: "compound",
    secondary: ["traps", "core"],
    loadMode: "external",
    popularity: 35,
    items: ["dumbbell", "kettlebell", "trap-bar"],
  },

  // ══════════════════════════════════════════════════════════════════ GAMBE
  {
    family: "squat",
    movement: "Squat",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core", "back"],
    popularity: 100,
    items: ["barbell", "bodyweight", "smith", "machine", "band"],
  },
  {
    family: "front-squat",
    movement: "Front squat",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    popularity: 65,
    items: ["barbell", "dumbbell"],
  },
  {
    family: "goblet-squat",
    movement: "Goblet squat",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    popularity: 70,
    items: ["dumbbell", "kettlebell"],
  },
  {
    family: "leg-press",
    movement: "Leg press",
    muscleGroup: "legs",
    mechanics: "compound",
    popularity: 95,
    items: ["machine"],
  },
  {
    family: "hack-squat",
    movement: "Hack squat",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    popularity: 75,
    items: ["machine", "barbell"],
  },
  {
    family: "leg-extension",
    movement: "Leg extension",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 90,
    items: ["machine"],
  },
  {
    family: "sissy-squat",
    movement: "Sissy squat",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 30,
    items: ["bodyweight", "machine", "weighted"],
  },
  {
    family: "bulgarian-split-squat",
    movement: "Squat bulgaro",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    unilateral: true,
    popularity: 80,
    items: ["dumbbell", "barbell", "bodyweight", "smith"],
  },
  {
    family: "affondi",
    movement: "Affondi in avanti",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    unilateral: true,
    popularity: 80,
    items: ["dumbbell", "barbell", "bodyweight"],
  },
  {
    family: "affondi-indietro",
    movement: "Affondi all'indietro",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    unilateral: true,
    popularity: 70,
    items: ["dumbbell", "barbell", "bodyweight"],
  },
  {
    family: "affondi-camminati",
    movement: "Affondi camminati",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    unilateral: true,
    popularity: 65,
    items: ["dumbbell", "barbell", "bodyweight"],
  },
  {
    family: "step-up",
    movement: "Step up",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    unilateral: true,
    popularity: 55,
    items: ["dumbbell", "barbell", "bodyweight"],
  },
  {
    family: "stacco-rumeno",
    movement: "Stacco rumeno",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["back"],
    popularity: 90,
    items: ["barbell", "dumbbell", "smith"],
  },
  {
    family: "stacco-gambe-tese",
    movement: "Stacco a gambe tese",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["back"],
    popularity: 70,
    items: ["barbell", "dumbbell"],
  },
  {
    family: "leg-curl-sdraiato",
    movement: "Leg curl sdraiato",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 85,
    items: ["machine"],
  },
  {
    family: "leg-curl-seduto",
    movement: "Leg curl seduto",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 85,
    items: ["machine"],
  },
  {
    family: "leg-curl-in-piedi",
    movement: "Leg curl in piedi a gamba singola",
    muscleGroup: "legs",
    mechanics: "isolation",
    unilateral: true,
    popularity: 40,
    items: ["machine"],
  },
  {
    family: "glute-ham-raise",
    movement: "Nordic hamstring curl",
    muscleGroup: "legs",
    mechanics: "compound",
    popularity: 35,
    items: ["bodyweight", "machine"],
  },
  {
    family: "hip-thrust",
    movement: "Hip thrust",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    popularity: 85,
    items: ["barbell", "machine", "smith", "bodyweight"],
  },
  {
    family: "glute-bridge",
    movement: "Ponte per glutei",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["core"],
    popularity: 50,
    items: ["barbell", "bodyweight"],
  },
  {
    family: "slanci-posteriori",
    movement: "Slanci posteriori",
    muscleGroup: "legs",
    mechanics: "isolation",
    unilateral: true,
    popularity: 45,
    items: ["cable"],
  },
  {
    family: "abductor",
    movement: "Abduzioni",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 65,
    items: ["machine", "cable", "band"],
  },
  {
    family: "kettlebell-swing",
    movement: "Kettlebell swing",
    muscleGroup: "legs",
    mechanics: "compound",
    secondary: ["back", "core"],
    popularity: 50,
    items: ["kettlebell"],
  },
  {
    family: "calf-raise-in-piedi",
    movement: "Calf raise in piedi",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 80,
    items: ["machine", "dumbbell", "bodyweight", "smith"],
  },
  {
    family: "calf-raise-seduto",
    movement: "Calf raise seduto",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 75,
    items: ["machine", "barbell"],
  },
  {
    family: "calf-raise-leg-press",
    movement: "Calf raise alla leg press",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 55,
    items: ["machine"],
  },
  {
    family: "donkey-calf-raise",
    movement: "Donkey calf raise",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 30,
    items: ["machine", "bodyweight"],
  },
  {
    family: "adductor",
    movement: "Adduzioni",
    muscleGroup: "legs",
    mechanics: "isolation",
    popularity: 60,
    items: ["machine", "cable"],
  },
  {
    family: "copenhagen-plank",
    movement: "Copenhagen plank",
    muscleGroup: "legs",
    mechanics: "isolation",
    secondary: ["core"],
    unilateral: true,
    popularity: 20,
    items: ["bodyweight"],
  },

  // ══════════════════════════════════════════════════════ ADDOMINALI E CORE
  {
    family: "crunch",
    movement: "Crunch",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 85,
    items: [
      "bodyweight",
      "cable",
      "machine",
      "medicine-ball",
      ["bodyweight", "su panca declinata"],
    ],
  },
  {
    family: "sit-up",
    movement: "Sit up",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 70,
    items: ["bodyweight", "weighted", ["bodyweight", "su panca declinata"]],
  },
  {
    family: "ab-roller",
    movement: "Ruota per addominali",
    muscleGroup: "core",
    mechanics: "compound",
    secondary: ["shoulders"],
    popularity: 55,
    items: ["other"],
  },
  {
    family: "leg-raise",
    movement: "Sollevamento gambe",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 80,
    items: [
      ["bodyweight", "a terra"],
      ["bodyweight", "appeso alla sbarra"],
      ["bodyweight", "alle parallele"],
    ],
  },
  {
    family: "knee-raise",
    movement: "Sollevamento ginocchia",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 60,
    items: [
      ["bodyweight", "appeso alla sbarra"],
      ["bodyweight", "alle parallele"],
    ],
  },
  {
    family: "v-up",
    movement: "V-up",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 40,
    items: ["bodyweight"],
  },
  {
    family: "dead-bug",
    movement: "Dead bug",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 40,
    items: ["bodyweight"],
  },
  {
    family: "russian-twist",
    movement: "Russian twist",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 60,
    items: ["bodyweight", "medicine-ball", "plate", "dumbbell"],
  },
  {
    family: "woodchopper",
    movement: "Woodchopper",
    muscleGroup: "core",
    mechanics: "isolation",
    unilateral: true,
    popularity: 45,
    items: ["cable", "band"],
  },
  {
    family: "bicycle-crunch",
    movement: "Bicycle crunch",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 50,
    items: ["bodyweight"],
  },
  {
    family: "side-bend",
    movement: "Flessioni laterali",
    muscleGroup: "core",
    mechanics: "isolation",
    unilateral: true,
    popularity: 35,
    items: ["dumbbell", "cable"],
  },
  {
    family: "plank",
    movement: "Plank",
    muscleGroup: "core",
    mechanics: "isolation",
    secondary: ["shoulders"],
    popularity: 85,
    items: ["bodyweight", "weighted"],
  },
  {
    family: "side-plank",
    movement: "Plank laterale",
    muscleGroup: "core",
    mechanics: "isolation",
    unilateral: true,
    popularity: 65,
    items: ["bodyweight", "weighted"],
  },
  {
    family: "hollow-hold",
    movement: "Hollow body hold",
    muscleGroup: "core",
    mechanics: "isolation",
    popularity: 40,
    items: ["bodyweight"],
  },
  {
    family: "mountain-climber",
    movement: "Mountain climber",
    muscleGroup: "core",
    mechanics: "compound",
    secondary: ["legs", "shoulders"],
    popularity: 45,
    items: ["bodyweight"],
  },

  // ═══════════════════════════════════════════ FULL BODY E OLIMPICO
  {
    family: "clean-and-jerk",
    movement: "Clean and jerk",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "shoulders", "back"],
    popularity: 35,
    items: ["barbell"],
  },
  {
    family: "snatch",
    movement: "Strappo",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "shoulders", "back"],
    popularity: 30,
    items: ["barbell"],
  },
  {
    family: "power-clean",
    movement: "Girata",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "back", "traps"],
    popularity: 40,
    items: ["barbell"],
  },
  {
    family: "power-snatch",
    movement: "Power snatch",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "shoulders", "back"],
    popularity: 25,
    items: ["barbell"],
  },
  {
    family: "hang-clean",
    movement: "Hang clean",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "back", "traps"],
    popularity: 25,
    items: ["barbell"],
  },
  {
    family: "thruster",
    movement: "Thruster",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "shoulders"],
    popularity: 45,
    items: ["barbell", "dumbbell", "kettlebell"],
  },
  {
    family: "burpee",
    movement: "Burpee",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["legs", "chest", "core"],
    popularity: 55,
    items: ["bodyweight"],
  },
  {
    family: "muscle-up",
    movement: "Muscle up",
    muscleGroup: "fullbody",
    mechanics: "compound",
    secondary: ["back", "arms", "chest"],
    popularity: 25,
    items: [
      ["bodyweight", "alla sbarra"],
      ["bodyweight", "agli anelli"],
    ],
  },
];

export function slug(value: string): string {
  return value
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function expand(row: Family): LibraryExercise[] {
  return row.items.map((item, index) => {
    const equipment = Array.isArray(item) ? item[0] : item;
    const variant = Array.isArray(item) ? item[1] : undefined;
    const loadMode = row.loadMode ?? EQUIPMENT_LOAD_MODE[equipment] ?? "external";

    return {
      id: `lib-${row.family}${variant ? `-${slug(variant)}` : ""}-${equipment}`,
      // §9.4: la qualifica sta **prima** della parentesi.
      name: `${row.movement}${variant ? ` ${variant}` : ""} (${EQUIPMENT_LABEL[equipment]})`,
      family: row.family,
      variant,
      muscleGroup: row.muscleGroup,
      equipment,
      secondaryMuscles: row.secondary ?? [],
      mechanics: row.mechanics,
      unilateral: row.unilateral ?? false,
      loadMode,
      stepKgOverride: row.stepKgOverride ?? EQUIPMENT_STEP_KG[equipment],
      // l'attrezzo piu' comune di una famiglia sta per primo, e perde un punto per posto
      popularity: Math.max(1, (row.popularity ?? 50) - index),
      isBodyweight: loadMode !== "external",
    };
  });
}

export const LIBRARY: LibraryExercise[] = FAMILIES.flatMap(expand);

/** Quanti esercizi porta la libreria: usato dai test e dal messaggio del seed. */
export const LIBRARY_SIZE = LIBRARY.length;

/** `family|variant|equipment` — l'identita' di una voce, indipendente dal nome. */
export function libraryKey(row: {
  family: string;
  variant?: string;
  equipment: Equipment;
}): string {
  return `${row.family}|${row.variant ?? ""}|${row.equipment}`;
}

/** La chiave dell'indice unico, per la voce di libreria. */
export function libraryNameKey(row: LibraryExercise): string {
  return exerciseKey(row.name, row.equipment);
}

/**
 * Gli 81 esercizi della v1, mappati sulla famiglia e sull'attrezzo che occupano nella
 * libreria nuova.
 *
 * Serve alla migrazione, e serve a una cosa sola: **non duplicare**. Gli esercizi della
 * v1 hanno nomi estesi («Panca piana con bilanciere») e id derivati da quei nomi; la
 * libreria nuova li chiama «Panca piana (Bilanciere)». Senza questa tabella il seed non
 * li riconoscerebbe, ne aggiungerebbe una seconda copia, e lo storico dell'utente
 * resterebbe attaccato a una voce diventata invisibile in mezzo al doppione.
 *
 * Chiave: l'id v1 (`lib-<slug del nome v1>`). Valore: la chiave di libreria nuova.
 */
export const LEGACY_LIBRARY_MAP: Record<string, string> = {
  // petto
  "lib-panca-piana-con-bilanciere": "panca-piana||barbell",
  "lib-panca-inclinata-con-bilanciere": "panca-inclinata||barbell",
  "lib-panca-declinata-con-bilanciere": "panca-declinata||barbell",
  "lib-panca-stretta-con-bilanciere": "close-grip-bench||barbell",
  "lib-panca-piana-con-manubri": "panca-piana||dumbbell",
  "lib-panca-inclinata-con-manubri": "panca-inclinata||dumbbell",
  "lib-croci-su-panca-piana-con-manubri": "croci-panca-piana||dumbbell",
  "lib-croci-su-panca-inclinata-con-manubri": "croci-panca-inclinata||dumbbell",
  "lib-croci-ai-cavi": "croci-in-piedi||cable",
  "lib-spinte-ai-cavi-in-piedi": "chest-press||cable",
  "lib-chest-press-alla-macchina": "chest-press||machine",
  "lib-pectoral-machine": "pec-deck||machine",
  "lib-piegamenti-sulle-braccia": "push-up||bodyweight",
  "lib-dip-alle-parallele": "dip-petto||bodyweight",

  // dorso
  "lib-stacco-da-terra": "stacco||barbell",
  "lib-rematore-con-bilanciere": "rematore-bilanciere||barbell",
  "lib-rematore-con-bilanciere-presa-inversa": "rematore-bilanciere|presa inversa|barbell",
  "lib-rematore-con-manubrio-a-un-braccio": "rematore-manubrio-un-braccio||dumbbell",
  "lib-rematore-con-manubri-a-busto-flesso": "rematore-manubri||dumbbell",
  "lib-trazioni-alla-sbarra": "pull-up||bodyweight",
  "lib-trazioni-presa-supina": "chin-up||bodyweight",
  "lib-lat-machine-avanti": "lat-pulldown|presa larga|cable",
  "lib-lat-machine-presa-stretta": "lat-pulldown|presa stretta|cable",
  "lib-pulley-basso": "pulley|presa stretta|cable",
  "lib-pullover-ai-cavi": "pullover||cable",
  "lib-rematore-alla-macchina": "rematore||machine",
  "lib-iperestensioni": "iperestensioni||bodyweight",
  "lib-scrollate-con-bilanciere": "scrollate||barbell",
  "lib-scrollate-con-manubri": "scrollate||dumbbell",

  // spalle
  "lib-military-press-con-bilanciere": "overhead-press||barbell",
  "lib-lento-avanti-con-manubri": "shoulder-press||dumbbell",
  "lib-arnold-press": "arnold-press||dumbbell",
  "lib-alzate-laterali-con-manubri": "alzate-laterali||dumbbell",
  "lib-alzate-laterali-ai-cavi": "alzate-laterali||cable",
  "lib-alzate-frontali-con-manubri": "alzate-frontali||dumbbell",
  "lib-alzate-posteriori-con-manubri": "reverse-fly||dumbbell",
  "lib-rear-delt-ai-cavi": "alzate-90||cable",
  "lib-face-pull-ai-cavi": "face-pull||cable",
  "lib-tirate-al-mento-con-bilanciere": "upright-row||barbell",
  "lib-shoulder-press-alla-macchina": "shoulder-press||machine",

  // gambe
  "lib-squat-con-bilanciere": "squat||barbell",
  "lib-front-squat": "front-squat||barbell",
  "lib-goblet-squat": "goblet-squat||dumbbell",
  "lib-squat-bulgaro-con-manubri": "bulgarian-split-squat||dumbbell",
  "lib-affondi-con-manubri": "affondi||dumbbell",
  "lib-step-up-con-manubri": "step-up||dumbbell",
  "lib-stacco-rumeno-con-bilanciere": "stacco-rumeno||barbell",
  "lib-stacco-a-gambe-tese-con-manubri": "stacco-gambe-tese||dumbbell",
  "lib-hip-thrust-con-bilanciere": "hip-thrust||barbell",
  "lib-pressa-per-gambe": "leg-press||machine",
  "lib-hack-squat": "hack-squat||machine",
  "lib-leg-extension": "leg-extension||machine",
  "lib-leg-curl-sdraiato": "leg-curl-sdraiato||machine",
  "lib-leg-curl-seduto": "leg-curl-seduto||machine",
  "lib-abduzioni-alla-macchina": "abductor||machine",
  "lib-adduzioni-alla-macchina": "adductor||machine",
  "lib-calf-raise-in-piedi": "calf-raise-in-piedi||machine",
  "lib-calf-raise-seduto": "calf-raise-seduto||machine",

  // braccia
  "lib-curl-con-bilanciere": "bicep-curl||barbell",
  "lib-curl-con-bilanciere-ez": "bicep-curl||ez-bar",
  "lib-curl-con-manubri": "bicep-curl||dumbbell",
  "lib-curl-a-martello": "hammer-curl||dumbbell",
  "lib-curl-concentrato": "concentration-curl||dumbbell",
  "lib-curl-alla-panca-scott": "preacher-curl||barbell",
  "lib-curl-ai-cavi": "bicep-curl||cable",
  "lib-french-press-con-bilanciere-ez": "skullcrusher||ez-bar",
  "lib-estensioni-sopra-la-testa-con-manubrio": "overhead-extension||dumbbell",
  "lib-push-down-ai-cavi": "tricep-pushdown|con barra dritta|cable",
  "lib-push-down-con-corda": "tricep-pushdown|con corda|cable",
  "lib-kickback-ai-cavi": "tricep-kickback||cable",
  "lib-dip-alla-panca": "bench-dip||bodyweight",

  // core
  "lib-crunch-a-terra": "crunch||bodyweight",
  "lib-sit-up": "sit-up||bodyweight",
  "lib-crunch-ai-cavi": "crunch||cable",
  "lib-plank": "plank||bodyweight",
  "lib-plank-laterale": "side-plank||bodyweight",
  "lib-sollevamento-gambe-alla-sbarra": "leg-raise|appeso alla sbarra|bodyweight",
  "lib-russian-twist": "russian-twist||bodyweight",
  "lib-hollow-hold": "hollow-hold||bodyweight",
  "lib-mountain-climber": "mountain-climber||bodyweight",
  "lib-ab-wheel": "ab-roller||other",
};

/**
 * Si alza quando la libreria cambia: solo allora il seed torna a girare.
 * 1 = gli 81 esercizi della v1. 2 = le ~270 voci di v2.
 */
export const LIBRARY_VERSION = 2;
export const LIBRARY_META_KEY = "seed.libraryVersion";
