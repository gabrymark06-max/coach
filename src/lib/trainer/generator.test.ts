import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/db/library";
import { DEFAULT_SETTINGS, type Equipment, type Exercise } from "@/lib/db/schema";
import type { TrainerProfile, TrainerProgram } from "@/lib/db/trainer-schema";
import { generateProgram, resolveSplit, type GenerateInput } from "./generator";
import { patternOf } from "./patterns";
import { fallbackSplit, splitFor } from "./splits";

/**
 * La libreria vera, tradotta in `Exercise` come la legge il database. Il generatore
 * deve funzionare su quello che l'utente ha davvero, non su un finto catalogo di sei
 * voci che non incontra mai un buco di attrezzatura.
 */
const CATALOGO: Exercise[] = LIBRARY.map((row) => ({
  id: row.id,
  name: row.name,
  nameKey: `${row.family}|${row.equipment}`,
  muscleGroup: row.muscleGroup,
  secondaryMuscles: row.secondaryMuscles,
  equipment: row.equipment,
  isCustom: false,
  isBodyweight: row.isBodyweight,
  createdAt: "2026-01-01T00:00:00.000Z",
  family: row.family,
  variant: row.variant,
  mechanics: row.mechanics,
  unilateral: row.unilateral,
  loadMode: row.loadMode,
  stepKgOverride: row.stepKgOverride,
  popularity: row.popularity,
}));

const PALESTRA: Equipment[] = [
  "barbell",
  "ez-bar",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "bodyweight",
  "weighted",
  "assisted-machine",
  "kettlebell",
  "band",
  "trap-bar",
  "medicine-ball",
  "plate",
];

function profilo(patch: Partial<TrainerProfile> = {}): TrainerProfile {
  return {
    id: "singleton",
    goal: "hypertrophy",
    priorityMuscles: [],
    equipment: PALESTRA,
    level: "intermediate",
    daysPerWeek: 4,
    sessionMinutes: 60,
    ...patch,
  };
}

function genera(patch: Partial<TrainerProfile> = {}, input: Partial<GenerateInput> = {}) {
  const result = generateProgram({
    profile: profilo(patch),
    library: CATALOGO,
    settings: DEFAULT_SETTINGS,
    now: "2026-09-23T08:00:00.000Z",
    ...input,
  });
  if (!result.ok) throw new Error(`generazione fallita: ${result.reason}`);
  return result.program;
}

function ogniEsercizio(program: TrainerProgram) {
  return program.weeks.flatMap((week) =>
    week.days.flatMap((day) => day.exercises.map((exercise) => ({ week, day, exercise }))),
  );
}

function serieSettimanali(program: TrainerProgram, weekIndex = 1): number {
  const week = program.weeks.find((item) => item.index === weekIndex);
  if (!week) throw new Error(`manca la settimana ${weekIndex}`);
  return week.days.reduce(
    (total, day) => total + day.exercises.reduce((n, e) => n + e.sets, 0),
    0,
  );
}

describe("generateProgram — la forma del programma", () => {
  it("genera un giorno per ogni giorno dichiarato, per ogni settimana", () => {
    const program = genera({ daysPerWeek: 4 });
    expect(program.weeksTotal).toBe(8);
    expect(program.weeks).toHaveLength(8);
    for (const week of program.weeks) expect(week.days).toHaveLength(4);
  });

  it("dichiara lo split nel nome, cosi' come il questionario lo ha promesso", () => {
    expect(genera({ daysPerWeek: 4 }).name).toBe("Ipertrofia · 4 giorni · 8 settimane");
    expect(genera({ daysPerWeek: 4 }).weeks[0].days[0].name).toMatch(
      /^Giorno A · Parte alta A$/,
    );
    expect(genera({ daysPerWeek: 6 }).weeks[0].days[3].name).toBe("Giorno D · Spinta B");
  });

  it("mette la prima settimana in corso e le altre nel futuro", () => {
    const program = genera();
    expect(program.weeks[0].status).toBe("in-corso");
    expect(program.weeks.slice(1).every((week) => week.status === "futura")).toBe(true);
    expect(program.currentWeek).toBe(1);
    expect(program.status).toBe("active");
  });

  it("propone una data per ogni giorno, senza mai due sedute nello stesso giorno", () => {
    const program = genera({ daysPerWeek: 4 });
    for (const week of program.weeks) {
      const giorni = week.days.map((day) => day.plannedFor?.slice(0, 10));
      expect(giorni.every(Boolean)).toBe(true);
      expect(new Set(giorni).size).toBe(giorni.length);
    }
  });
});

describe("generateProgram — l'attrezzatura dichiarata e' un vincolo, non un suggerimento", () => {
  it("non propone mai un attrezzo che l'utente non ha", () => {
    const soloManubri: Equipment[] = ["dumbbell", "bodyweight"];
    const program = genera({ equipment: soloManubri });
    const fuori = ogniEsercizio(program)
      .map(({ exercise }) => CATALOGO.find((row) => row.id === exercise.exerciseId)!)
      .filter((row) => !soloManubri.includes(row.equipment));
    expect(fuori.map((row) => row.name)).toEqual([]);
  });

  it("genera un programma a corpo libero senza inventare un bilanciere", () => {
    const program = genera({ equipment: ["bodyweight"], daysPerWeek: 3 });
    const attrezzi = new Set(
      ogniEsercizio(program).map(
        ({ exercise }) => CATALOGO.find((row) => row.id === exercise.exerciseId)!.equipment,
      ),
    );
    expect([...attrezzi]).toEqual(["bodyweight"]);
  });

  it("rifiuta con un motivo leggibile quando l'attrezzatura non copre un giorno", () => {
    // La palla medica da sola non copre nemmeno un giorno: la generazione deve dirlo,
    // non consegnare un giorno da un esercizio (§4.23, error — generazione).
    const result = generateProgram({
      profile: profilo({ equipment: ["medicine-ball"], daysPerWeek: 4 }),
      library: CATALOGO,
      settings: DEFAULT_SETTINGS,
      now: "2026-09-23T08:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/palla medica/i);
  });
});

describe("generateProgram — nessun doppione", () => {
  it("non ripete lo stesso esercizio dentro un giorno", () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      const program = genera({ daysPerWeek: days });
      for (const week of program.weeks) {
        for (const day of week.days) {
          const ids = day.exercises.map((exercise) => exercise.exerciseId);
          expect(new Set(ids).size, `${day.name}`).toBe(ids.length);
        }
      }
    }
  });

  it("non ripete la stessa famiglia dentro un giorno", () => {
    // Panca piana (Bilanciere) e Panca piana (Manubri) sono due esercizi con due id,
    // ma nello stesso giorno sono lo stesso allenamento fatto due volte.
    const program = genera({ daysPerWeek: 3, sessionMinutes: 90 });
    for (const day of program.weeks[0].days) {
      const famiglie = day.exercises.map(
        (exercise) => CATALOGO.find((row) => row.id === exercise.exerciseId)!.family,
      );
      expect(new Set(famiglie).size, day.name).toBe(famiglie.length);
    }
  });

  it("dà due giorni diversi quando lo split ne ha due dello stesso tipo", () => {
    const program = genera({ daysPerWeek: 4 });
    const [upperA, , upperB] = program.weeks[0].days;
    const a = new Set(upperA.exercises.map((e) => e.exerciseId));
    const b = upperB.exercises.map((e) => e.exerciseId);
    expect(b.some((id) => !a.has(id))).toBe(true);
  });
});

describe("generateProgram — il volume segue il livello", () => {
  it("dà meno serie al principiante e più all'avanzato, a parità di tutto il resto", () => {
    const principiante = serieSettimanali(genera({ level: "beginner" }));
    const intermedio = serieSettimanali(genera({ level: "intermediate" }));
    const avanzato = serieSettimanali(genera({ level: "advanced" }));
    expect(principiante).toBeLessThan(intermedio);
    expect(intermedio).toBeLessThan(avanzato);
  });

  it("dà meno esercizi a una seduta da 45 minuti che a una da 90", () => {
    const corta = genera({ sessionMinutes: 45 }).weeks[0].days[0].exercises.length;
    const lunga = genera({ sessionMinutes: 90 }).weeks[0].days[0].exercises.length;
    expect(corta).toBeLessThan(lunga);
    expect(corta).toBeGreaterThanOrEqual(3);
  });

  it("stima i minuti del giorno e li tiene vicini a quelli chiesti", () => {
    for (const minuti of [45, 60, 75, 90] as const) {
      const day = genera({ sessionMinutes: minuti }).weeks[0].days[0];
      expect(day.estimatedMinutes).toBeGreaterThan(minuti * 0.6);
      expect(day.estimatedMinutes).toBeLessThan(minuti * 1.4);
    }
  });
});

describe("generateProgram — la settimana di scarico", () => {
  it("mette uno scarico ogni quattro settimane e gli taglia il volume", () => {
    const program = genera();
    const kinds = program.weeks.map((week) => week.kind);
    expect(kinds[3]).toBe("scarico");
    expect(kinds[7]).toBe("scarico");
    expect(kinds[0]).toBe("accumulo");

    expect(serieSettimanali(program, 4)).toBeLessThan(serieSettimanali(program, 3));
  });

  it("rispetta l'impostazione «scarico ogni N settimane»", () => {
    const program = genera(
      {},
      { settings: { ...DEFAULT_SETTINGS, trainerDeloadEveryWeeks: 3 } },
    );
    expect(program.weeks.map((week) => week.kind === "scarico")).toEqual([
      false, false, true, false, false, true, false, false,
    ]);
  });
});

describe("generateProgram — i muscoli privilegiati", () => {
  it("dà più spazio al muscolo scelto, senza togliere i fondamentali", () => {
    const neutro = genera({ daysPerWeek: 4, sessionMinutes: 60 });
    const conPetto = genera({
      daysPerWeek: 4,
      sessionMinutes: 60,
      priorityMuscles: ["chest"],
    });

    const pettoIn = (program: TrainerProgram) =>
      ogniEsercizio(program).filter(({ week, exercise }) => {
        if (week.index !== 1) return false;
        const row = CATALOGO.find((item) => item.id === exercise.exerciseId)!;
        const pattern = patternOf(row);
        return pattern === "spinta-orizzontale" || pattern === "petto-iso";
      }).length;

    expect(pettoIn(conPetto)).toBeGreaterThan(pettoIn(neutro));

    // e le gambe non spariscono
    const gambe = ogniEsercizio(conPetto).filter(({ week, exercise }) => {
      if (week.index !== 1) return false;
      return CATALOGO.find((item) => item.id === exercise.exerciseId)!.muscleGroup === "legs";
    });
    expect(gambe.length).toBeGreaterThan(0);
  });
});

describe("generateProgram — il carico della prima settimana", () => {
  it("lascia il campo vuoto quando non c'è storico: «prima volta»", () => {
    const program = genera();
    const week1 = program.weeks[0];
    for (const day of week1.days) {
      for (const exercise of day.exercises) {
        expect(exercise.suggestedWeightKg).toBeNull();
      }
    }
  });

  it("parte dal carico che l'utente ha già usato, quando lo storico c'è", () => {
    const program = genera(
      {},
      {
        history: new Map([
          ["lib-panca-piana-barbell", { lastWeightKg: 80, lastReps: 8, lastAt: "2026-09-10T08:00:00.000Z", sessionId: "s1" }],
        ]),
      },
    );
    const panca = ogniEsercizio(program).find(
      ({ week, exercise }) =>
        week.index === 1 && exercise.exerciseId === "lib-panca-piana-barbell",
    );
    expect(panca?.exercise.suggestedWeightKg).toBe(80);
  });

  it("lascia le settimane successive senza carico: lo deciderà la progressione", () => {
    const program = genera();
    const dopo = ogniEsercizio(program).filter(({ week }) => week.index > 1);
    expect(dopo.every(({ exercise }) => exercise.suggestedWeightKg === null)).toBe(true);
  });
});

/*
  DIFETTO 1 del secondo audit: il questionario prometteva «Push/Pull/Legs» e il
  generatore, con il solo corpo libero, costruiva un «Full body». La promessa e la
  costruzione devono uscire dalla **stessa** funzione.
*/
describe("resolveSplit — quello che si promette e' quello che si costruisce", () => {
  const risolvi = (patch: Partial<TrainerProfile> = {}) =>
    resolveSplit({ profile: profilo(patch), library: CATALOGO });

  it("in palestra completa lo split e' quello della tabella", () => {
    const esito = risolvi({ daysPerWeek: 3, level: "intermediate" });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.label).toBe("Push/Pull/Legs");
    expect(esito.fellBack).toBe(false);
  });

  it("a corpo libero dice «Full body ×3», che e' quello che esce davvero", () => {
    const esito = risolvi({
      daysPerWeek: 3,
      level: "intermediate",
      equipment: ["bodyweight"],
    });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.label).toBe("Full body ×3");
    expect(esito.intendedLabel).toBe("Push/Pull/Legs");
    expect(esito.fellBack).toBe(true);
  });

  it("l'etichetta risolta corrisponde ai giorni che il programma costruisce", () => {
    for (const equipment of [["bodyweight"], PALESTRA] as Equipment[][]) {
      for (const daysPerWeek of [2, 3, 4, 5, 6] as const) {
        const contesto = `${equipment.length} attrezzi / ${daysPerWeek} giorni`;
        const esito = risolvi({ daysPerWeek, equipment, level: "intermediate" });
        expect(esito.ok, contesto).toBe(true);
        if (!esito.ok) continue;

        const atteso = esito.fellBack
          ? fallbackSplit(daysPerWeek)
          : splitFor(daysPerWeek, "intermediate");
        expect(esito.label, contesto).toBe(atteso.label);

        const program = genera({ daysPerWeek, equipment, level: "intermediate" });
        const giorni = program.weeks[0].days.map((day) => day.name.split(" · ")[1]);
        expect(giorni, contesto).toEqual(atteso.days.map((template) => template.label));
      }
    }
  });

  it("quando l'attrezzatura non basta lo dice subito, con la stessa frase della generazione", () => {
    const esito = risolvi({ daysPerWeek: 4, equipment: ["medicine-ball"] });
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    const generato = generateProgram({
      profile: profilo({ daysPerWeek: 4, equipment: ["medicine-ball"] }),
      library: CATALOGO,
      settings: DEFAULT_SETTINGS,
      now: "2026-09-23T08:00:00.000Z",
    });
    expect(generato.ok).toBe(false);
    if (generato.ok) return;
    expect(esito.reason).toBe(generato.reason);
  });
});
