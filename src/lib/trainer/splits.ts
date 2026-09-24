import type { MuscleGroup } from "@/lib/db/schema";
import type { TrainerLevel } from "@/lib/db/trainer-schema";
import { PATTERNS_BY_MUSCLE, PATTERN_MUSCLE, type Pattern } from "./patterns";
import type { Role } from "./prescription";

/**
 * Gli split — quanti giorni fanno quale forma di settimana.
 *
 * Un giorno non e' un elenco di esercizi: e' un elenco di **slot**, cioe' di posti da
 * riempire, ciascuno con un pattern e un ruolo. Il generatore poi ci mette dentro
 * quello che l'attrezzatura dell'utente permette. Scritto cosi', «4 giorni →
 * Upper/Lower x2» e' un dato che si puo' mostrare nel questionario prima ancora di
 * generare (§4.23 passo 5), e non una conseguenza nascosta di un algoritmo.
 *
 * Gli slot stanno **in ordine di importanza**: quando la seduta e' corta si taglia
 * dalla coda, mai dalla testa. E' per questo che a 45 minuti resta il fondamentale e
 * sparisce il curl, e non il contrario.
 */

export interface DaySlot {
  /** i pattern accettabili, in ordine di preferenza: il primo che ha candidati vince */
  patterns: Pattern[];
  role: Role;
}

export interface DayTemplate {
  key: string;
  /** la parte dopo il punto mediano: «Giorno B · **Spinta**» */
  label: string;
  slots: DaySlot[];
}

const slot = (role: Role, ...patterns: Pattern[]): DaySlot => ({ patterns, role });

const TEMPLATES: Record<string, DayTemplate> = {
  "full-a": {
    key: "full-a",
    label: "Full body A",
    slots: [
      slot("primario", "quadricipiti"),
      slot("primario", "spinta-orizzontale"),
      slot("primario", "trazione-orizzontale", "trazione-verticale"),
      slot("secondario", "spinta-verticale"),
      slot("secondario", "femorali"),
      slot("complementare", "core"),
      slot("complementare", "bicipiti"),
    ],
  },
  "full-b": {
    key: "full-b",
    label: "Full body B",
    slots: [
      slot("primario", "femorali"),
      slot("primario", "trazione-verticale", "trazione-orizzontale"),
      slot("primario", "spinta-verticale"),
      slot("secondario", "quadricipiti"),
      slot("secondario", "petto-iso", "spinta-orizzontale"),
      slot("complementare", "tricipiti"),
      slot("complementare", "core"),
    ],
  },
  "full-c": {
    key: "full-c",
    label: "Full body C",
    slots: [
      slot("primario", "spinta-orizzontale"),
      slot("primario", "quadricipiti"),
      slot("primario", "trazione-verticale", "trazione-orizzontale"),
      slot("secondario", "glutei", "femorali"),
      slot("secondario", "spalle-iso"),
      slot("complementare", "core"),
      slot("complementare", "bicipiti"),
    ],
  },
  "upper-a": {
    key: "upper-a",
    label: "Parte alta A",
    slots: [
      slot("primario", "spinta-orizzontale"),
      slot("primario", "trazione-verticale"),
      slot("secondario", "spinta-verticale"),
      slot("secondario", "trazione-orizzontale"),
      slot("complementare", "spalle-iso"),
      slot("complementare", "bicipiti"),
      slot("complementare", "tricipiti"),
    ],
  },
  "upper-b": {
    key: "upper-b",
    label: "Parte alta B",
    slots: [
      slot("primario", "spinta-verticale"),
      slot("primario", "trazione-orizzontale"),
      slot("secondario", "spinta-orizzontale"),
      slot("secondario", "trazione-verticale"),
      slot("complementare", "petto-iso"),
      slot("complementare", "tricipiti"),
      slot("complementare", "bicipiti"),
    ],
  },
  "lower-a": {
    key: "lower-a",
    label: "Parte bassa A",
    slots: [
      slot("primario", "quadricipiti"),
      slot("primario", "femorali"),
      slot("secondario", "glutei", "femorali"),
      slot("secondario", "quadricipiti"),
      slot("complementare", "polpacci"),
      slot("complementare", "core"),
    ],
  },
  "lower-b": {
    key: "lower-b",
    label: "Parte bassa B",
    slots: [
      slot("primario", "femorali"),
      slot("primario", "quadricipiti"),
      slot("secondario", "quadricipiti"),
      slot("secondario", "femorali", "glutei"),
      slot("complementare", "core"),
      slot("complementare", "polpacci"),
    ],
  },
  "spinta-a": {
    key: "spinta-a",
    label: "Spinta A",
    slots: [
      slot("primario", "spinta-orizzontale"),
      slot("primario", "spinta-verticale"),
      slot("secondario", "spinta-orizzontale"),
      slot("secondario", "petto-iso"),
      slot("complementare", "spalle-iso"),
      slot("complementare", "tricipiti"),
      slot("complementare", "tricipiti"),
    ],
  },
  "spinta-b": {
    key: "spinta-b",
    label: "Spinta B",
    slots: [
      slot("primario", "spinta-verticale"),
      slot("primario", "spinta-orizzontale"),
      slot("secondario", "petto-iso", "spinta-orizzontale"),
      slot("secondario", "spalle-iso"),
      slot("complementare", "tricipiti"),
      slot("complementare", "spalle-iso"),
      slot("complementare", "core"),
    ],
  },
  "trazione-a": {
    key: "trazione-a",
    label: "Trazione A",
    slots: [
      slot("primario", "trazione-verticale"),
      slot("primario", "trazione-orizzontale"),
      slot("secondario", "trazione-orizzontale"),
      slot("secondario", "spalle-iso"),
      slot("complementare", "bicipiti"),
      slot("complementare", "bicipiti"),
      slot("complementare", "trapezi"),
    ],
  },
  "trazione-b": {
    key: "trazione-b",
    label: "Trazione B",
    slots: [
      slot("primario", "trazione-orizzontale"),
      slot("primario", "trazione-verticale"),
      slot("secondario", "dorso-iso", "trazione-orizzontale"),
      slot("secondario", "spalle-iso"),
      slot("complementare", "trapezi"),
      slot("complementare", "bicipiti"),
      slot("complementare", "core"),
    ],
  },
  "gambe-a": {
    key: "gambe-a",
    label: "Gambe A",
    slots: [
      slot("primario", "quadricipiti"),
      slot("primario", "femorali"),
      slot("secondario", "quadricipiti"),
      slot("secondario", "femorali"),
      slot("complementare", "glutei"),
      slot("complementare", "polpacci"),
    ],
  },
  "gambe-b": {
    key: "gambe-b",
    label: "Gambe B",
    slots: [
      slot("primario", "femorali"),
      slot("primario", "quadricipiti"),
      slot("secondario", "glutei", "femorali"),
      slot("secondario", "quadricipiti"),
      slot("complementare", "polpacci"),
      slot("complementare", "core"),
    ],
  },
};

export type DaysPerWeek = 2 | 3 | 4 | 5 | 6;

export interface Split {
  /** come si chiama a parole: «Upper/Lower ×2» */
  label: string;
  days: DayTemplate[];
}

/**
 * Lo split, dato il numero di giorni **e il livello**.
 *
 * L'unico punto in cui il livello cambia la forma della settimana e' a tre giorni: un
 * principiante a tre giorni guadagna di piu' allenando tutto tre volte che spezzando
 * in push/pull/legs, dove ogni muscolo vedrebbe un solo stimolo a settimana. Da
 * intermedio in su il volume per seduta diventa il vincolo, e lo split conviene.
 */
export function splitFor(days: DaysPerWeek, level: TrainerLevel): Split {
  const t = (key: string) => TEMPLATES[key];

  switch (days) {
    case 2:
      return { label: "Full body ×2", days: [t("full-a"), t("full-b")] };
    case 3:
      return level === "beginner"
        ? { label: "Full body ×3", days: [t("full-a"), t("full-b"), t("full-c")] }
        : {
            label: "Push/Pull/Legs",
            days: [t("spinta-a"), t("trazione-a"), t("gambe-a")],
          };
    case 4:
      return {
        label: "Upper/Lower ×2",
        days: [t("upper-a"), t("lower-a"), t("upper-b"), t("lower-b")],
      };
    case 5:
      return {
        label: "Push/Pull/Legs + Upper/Lower",
        days: [
          t("spinta-a"),
          t("trazione-a"),
          t("gambe-a"),
          t("upper-b"),
          t("lower-b"),
        ],
      };
    case 6:
      return {
        label: "Push/Pull/Legs ×2",
        days: [
          t("spinta-a"),
          t("trazione-a"),
          t("gambe-a"),
          t("spinta-b"),
          t("trazione-b"),
          t("gambe-b"),
        ],
      };
  }
}

/**
 * I giorni della settimana su cui cadono le sedute, come scarto in giorni dall'inizio
 * della settimana. Non e' un obbligo (`plannedFor` e' «la data suggerita»), ma un
 * calendario che propone quattro allenamenti di fila e poi tre giorni di niente e'
 * un calendario che nessuno segue.
 */
const OFFSETS: Record<DaysPerWeek, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export function dayOffsets(days: DaysPerWeek): number[] {
  return OFFSETS[days];
}

/**
 * Quanti esercizi entrano in una seduta di N minuti.
 *
 * Un esercizio costa, in media, le sue serie per il recupero piu' il tempo di lavoro.
 * Qui si parte da una stima per durata e la si corregge col livello: il principiante
 * ne fa uno in meno perche' fa meno serie ma piu' lentamente, e perche' sei esercizi
 * nuovi in una volta sono sei tecniche da imparare insieme.
 */
export function exerciseCountFor(
  sessionMinutes: 45 | 60 | 75 | 90,
  level: TrainerLevel,
): number {
  const base = { 45: 4, 60: 5, 75: 6, 90: 7 }[sessionMinutes];
  // Il principiante ne fa uno in meno **solo dove ce n'e' da togliere**: a 45 minuti
  // scendere a tre esercizi non e' prudenza, e' mezza seduta.
  return Math.max(4, base + (level === "beginner" && base >= 5 ? -1 : 0));
}

/**
 * Gli slot del giorno, nell'ordine definitivo: i muscoli privilegiati salgono
 * **dentro il proprio ruolo** e guadagnano un posto in piu'.
 *
 * Privilegiare il petto non vuol dire fare tre panche e nessuno squat: vuol dire che,
 * a parita' di posto, il posto va al petto. Due effetti, entrambi limitati:
 *
 *  1. **riordino dentro il ruolo** — il taglio per durata toglie il curl prima delle
 *     alzate laterali, se le spalle sono la priorita';
 *  2. **uno slot in piu' fra i secondari**, ma **solo nei giorni che quel muscolo lo
 *     allenano gia'**. Aggiungere il petto al giorno delle gambe non sarebbe una
 *     preferenza: sarebbe rompere lo split che l'utente ha appena scelto.
 */
export function orderedSlots(
  template: DayTemplate,
  priorityMuscles: readonly MuscleGroup[],
): DaySlot[] {
  if (priorityMuscles.length === 0) return template.slots;
  const priority = new Set(priorityMuscles);
  const isPriority = (item: DaySlot) =>
    item.patterns.some((pattern) => priority.has(PATTERN_MUSCLE[pattern]));

  const extra: DaySlot[] = [];
  for (const muscle of priority) {
    const patterns = PATTERNS_BY_MUSCLE[muscle];
    const trainedHere = template.slots.some((item) =>
      item.patterns.some((pattern) => patterns.includes(pattern)),
    );
    if (trainedHere) extra.push({ patterns: [...patterns], role: "secondario" });
  }

  const roles: Role[] = ["primario", "secondario", "complementare"];
  const out: DaySlot[] = [];
  for (const role of roles) {
    const ofRole = [
      ...template.slots.filter((item) => item.role === role),
      ...(role === "secondario" ? extra : []),
    ];
    out.push(...ofRole.filter(isPriority), ...ofRole.filter((item) => !isPriority(item)));
  }
  return out;
}

/**
 * Lo split di ripiego quando l'attrezzatura non regge quello scelto.
 *
 * Con il solo corpo libero un giorno di «Trazione» esiste sul foglio e non in palestra:
 * non ci sono rematori, non ci sono curl, e il giorno uscirebbe con un esercizio.
 * Invece di consegnarlo mezzo vuoto o di rifiutare tutto, il generatore ripiega sul
 * full body, che ha slot piu' larghi e sopporta un catalogo stretto. E' un
 * adattamento, **e viene detto prima**: `resolveSplit` (`generator.ts`) risolve il
 * ripiego e il questionario mostra lo split che uscira' davvero, con la riga che
 * spiega perche' non e' quello previsto per quel numero di giorni.
 */
export function fallbackSplit(days: DaysPerWeek): Split {
  const rotation = [TEMPLATES["full-a"], TEMPLATES["full-b"], TEMPLATES["full-c"]];
  return {
    label: `Full body ×${days}`,
    days: Array.from({ length: days }, (_, i) => rotation[i % rotation.length]),
  };
}

export { TEMPLATES as DAY_TEMPLATES };
