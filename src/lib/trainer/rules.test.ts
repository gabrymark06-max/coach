import { describe, expect, it } from "vitest";
import type { TrainerExercise } from "@/lib/db/trainer-schema";
import { decideProgression, PROGRESSION_RULES, type DecideInput, type SessionPerformance } from "./rules";

const PIANO: TrainerExercise = {
  exerciseId: "lib-panca-piana-barbell",
  exerciseName: "Panca piana (Bilanciere)",
  order: 0,
  sets: 3,
  repsMin: 6,
  repsMax: 8,
  rpeTarget: 8,
  restSec: 150,
  suggestedWeightKg: 80,
};

function seduta(
  reps: number[],
  rpe: (number | null)[] = reps.map(() => 7),
  weightKg = 80,
  id = "s1",
): SessionPerformance {
  return {
    sessionId: id,
    date: "2026-09-17T18:00:00.000Z",
    sets: reps.map((r, i) => ({ weightKg, reps: r, rpe: rpe[i] ?? null, completed: true })),
    setsPlanned: 3,
  };
}

function decidi(patch: Partial<DecideInput> = {}) {
  return decideProgression({
    planned: PIANO,
    performances: [seduta([8, 8, 8])],
    nextWeekKind: "accumulo",
    stepKg: 2.5,
    fineStepKg: 1.25,
    rpeCap: 9.5,
    decidedAt: "2026-09-22T18:00:00.000Z",
    ...patch,
  });
}

describe("le dieci regole sono dati, non `if` sparsi", () => {
  it("ha una voce di tabella per ognuna, con nome e spiegazione", () => {
    const nomi = Object.keys(PROGRESSION_RULES).sort();
    expect(nomi).toEqual(
      [
        "deload-on-miss",
        "double-progression",
        "first-time",
        "hold-on-miss",
        "manual",
        "planned-deload",
        "reps-first",
        "rpe-cap",
        "skip-hold",
        "carry-over",
      ].sort(),
    );
    for (const rule of Object.values(PROGRESSION_RULES)) {
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.when.length).toBeGreaterThan(0);
      expect(rule.effect.length).toBeGreaterThan(0);
    }
  });
});

describe("double-progression", () => {
  it("sale di un incremento quando tutte le serie sono al tetto e l'RPE tiene", () => {
    const d = decidi();
    expect(d.rule).toBe("double-progression");
    expect(d.direction).toBe("up");
    expect(d.fromWeightKg).toBe(80);
    expect(d.toWeightKg).toBe(82.5);
    // le ripetizioni tornano al fondo dell'intervallo
    expect(d.toReps).toEqual([6, 8]);
    expect(d.humanReason).toBe("3 serie su 3 al tetto, RPE medio 7");
    expect(d.nextStepHint).toContain("85");
  });

  it("cita la seduta che l'ha attivata, cosi' si puo' andare a verificare", () => {
    const d = decidi({ performances: [seduta([8, 8, 8], [7, 7, 8], 80, "sessione-x")] });
    expect(d.evidence.sessionIds).toEqual(["sessione-x"]);
    expect(d.evidence.repsAchieved).toEqual([8, 8, 8]);
    expect(d.evidence.rpeObserved).toEqual([7, 7, 8]);
    expect(d.evidence.setsCompleted).toBe(3);
    expect(d.evidence.setsPlanned).toBe(3);
  });

  it("non sale se l'RPE medio supera l'obiettivo", () => {
    const d = decidi({ performances: [seduta([8, 8, 8], [9, 9, 9])] });
    expect(d.rule).not.toBe("double-progression");
  });
});

describe("rpe-cap", () => {
  it("dimezza l'aumento quando una sola serie sfonda il tetto di RPE", () => {
    const d = decidi({ performances: [seduta([8, 8, 8], [7, 7, 9.5])] });
    expect(d.rule).toBe("rpe-cap");
    expect(d.direction).toBe("up");
    expect(d.toWeightKg).toBe(81.25);
    expect(d.humanReason).toContain("9,5");
  });

  it("tiene il carico quando l'attrezzo non ha mezzo incremento", () => {
    // Un manubrio sale di 2 kg per volta: +1 kg non esiste. Non si arrotonda in
    // silenzio (§4.25) — si dice che non si sale e perche'.
    const d = decidi({
      planned: { ...PIANO, exerciseName: "Panca piana (Manubri)", suggestedWeightKg: 24 },
      performances: [seduta([8, 8, 8], [7, 7, 10], 24)],
      stepKg: 2,
      fineStepKg: 2,
    });
    expect(d.rule).toBe("rpe-cap");
    expect(d.direction).toBe("hold");
    expect(d.toWeightKg).toBe(24);
    expect(d.humanReason).toMatch(/mezzo incremento|non esiste/i);
  });
});

describe("reps-first", () => {
  it("aggiunge una ripetizione invece di salire, quando il tetto non e' pieno", () => {
    const d = decidi({ performances: [seduta([8, 7, 6])] });
    expect(d.rule).toBe("reps-first");
    expect(d.direction).toBe("hold");
    expect(d.toWeightKg).toBe(80);
    expect(d.nextStepHint).toContain("8");
    expect(d.humanReason).toContain("7");
  });
});

describe("hold-on-miss", () => {
  it("tiene il carico dopo una seduta sotto il fondo dell'intervallo", () => {
    const d = decidi({ performances: [seduta([5, 5, 4])] });
    expect(d.rule).toBe("hold-on-miss");
    expect(d.direction).toBe("hold");
    expect(d.toWeightKg).toBe(80);
  });

  it("vale anche quando mancano delle serie", () => {
    const d = decidi({ performances: [{ ...seduta([8, 8]), setsPlanned: 3 }] });
    expect(d.rule).toBe("hold-on-miss");
    expect(d.evidence.setsCompleted).toBe(2);
    expect(d.evidence.setsPlanned).toBe(3);
  });
});

describe("deload-on-miss", () => {
  it("toglie il 10% dopo due sedute consecutive sotto il fondo", () => {
    const d = decidi({
      performances: [seduta([5, 4, 4], [9, 9, 9], 80, "s2"), seduta([5, 5, 4], [9, 9, 9], 80, "s1")],
    });
    expect(d.rule).toBe("deload-on-miss");
    expect(d.direction).toBe("down");
    // 80 − 10% = 72 → arrotondato all'incremento caricabile
    expect(d.toWeightKg).toBe(72.5);
    expect(d.evidence.sessionIds).toEqual(["s2", "s1"]);
  });
});

describe("planned-deload", () => {
  it("toglie il 10% quando la settimana dopo e' di scarico, qualunque cosa sia successa", () => {
    const d = decidi({ nextWeekKind: "scarico" });
    expect(d.rule).toBe("planned-deload");
    expect(d.direction).toBe("deload");
    expect(d.toWeightKg).toBe(72.5);
    expect(d.humanReason).toMatch(/scarico/i);
    expect(d.nextStepHint).toMatch(/settimana/i);
  });
});

describe("skip-hold", () => {
  it("non progredisce e lo dice, quando nella settimana non c'e' nessun allenamento", () => {
    const d = decidi({ weekSkipped: true, performances: [] });
    expect(d.rule).toBe("skip-hold");
    expect(d.direction).toBe("hold");
    expect(d.toWeightKg).toBe(80);
    expect(d.humanReason).toMatch(/nessun allenamento/i);
  });

  it("tiene l'ultimo carico davvero usato, non quello previsto", () => {
    const d = decidi({
      weekSkipped: true,
      planned: { ...PIANO, suggestedWeightKg: 85 },
      performances: [seduta([8, 8, 8], [7, 7, 7], 82.5)],
    });
    expect(d.toWeightKg).toBe(82.5);
  });
});

describe("first-time", () => {
  it("non propone niente quando non c'e' storico: il campo resta vuoto", () => {
    const d = decidi({
      planned: { ...PIANO, suggestedWeightKg: null },
      performances: [],
    });
    expect(d.rule).toBe("first-time");
    expect(d.toWeightKg).toBeNull();
    expect(d.humanReason).toMatch(/prima volta/i);
    expect(d.nextStepHint.length).toBeGreaterThan(0);
  });
});

describe("manual", () => {
  it("l'override dell'utente diventa la nuova base e finisce nel registro", () => {
    const d = decidi({ manual: { weightKg: 77.5, note: "spalla indolenzita" } });
    expect(d.rule).toBe("manual");
    expect(d.direction).toBe("manual");
    expect(d.toWeightKg).toBe(77.5);
    expect(d.humanReason).toContain("spalla indolenzita");
  });

  it("vince su tutto, anche su una settimana di scarico", () => {
    const d = decidi({ nextWeekKind: "scarico", manual: { weightKg: 90 } });
    expect(d.rule).toBe("manual");
    expect(d.toWeightKg).toBe(90);
  });
});

describe("ogni decisione dice che cosa serve per il passo dopo", () => {
  it("nessuna regola esce senza la frase del prossimo passo (§4.25)", () => {
    const casi: Partial<DecideInput>[] = [
      {},
      { performances: [seduta([8, 8, 8], [7, 7, 9.5])] },
      { performances: [seduta([8, 7, 6])] },
      { performances: [seduta([5, 5, 4])] },
      { performances: [seduta([5, 4, 4], [9, 9, 9], 80, "s2"), seduta([5, 5, 4], [9, 9, 9], 80, "s1")] },
      { nextWeekKind: "scarico" },
      { weekSkipped: true, performances: [] },
      { planned: { ...PIANO, suggestedWeightKg: null }, performances: [] },
      { manual: { weightKg: 77.5 } },
    ];
    for (const caso of casi) {
      const d = decidi(caso);
      expect(d.nextStepHint.trim(), d.rule).not.toBe("");
      expect(d.humanReason.trim(), d.rule).not.toBe("");
    }
  });
});

/*
  Il bloccante del secondo audit, in forma di test.

  «Nessuna prestazione da leggere» non e' un caso di bordo: e' la **prima settimana di
  ogni programma**, dove il carico arriva dallo storico fuori dal programma e dentro il
  programma non c'e' ancora nemmeno una serie. Tutta la coda di `decideProgression` che
  legge `performances[0]` non deve essere nemmeno raggiungibile da li'.
*/
describe("nessuna prestazione dentro il programma", () => {
  it("tiene il carico seminato dallo storico invece di rompersi", () => {
    const d = decidi({ performances: [] });
    expect(d.rule).toBe("carry-over");
    expect(d.direction).toBe("hold");
    expect(d.fromWeightKg).toBe(80);
    expect(d.toWeightKg).toBe(80);
    expect(d.humanReason).toMatch(/ultimo carico|dall'ultima volta/i);
    expect(d.nextStepHint).toContain("80");
  });

  it("l'evidenza e' vuota, e lo dice: nessuna seduta citata", () => {
    const d = decidi({ performances: [] });
    expect(d.evidence.sessionIds).toEqual([]);
    expect(d.evidence.setsCompleted).toBe(0);
    expect(d.evidence.repsAchieved).toEqual([]);
    expect(d.evidence.setsPlanned).toBe(3);
  });

  it("senza carico seminato resta «prima volta»", () => {
    const d = decidi({ planned: { ...PIANO, suggestedWeightKg: null }, performances: [] });
    expect(d.rule).toBe("first-time");
    expect(d.toWeightKg).toBeNull();
  });

  it("una settimana saltata resta «settimana saltata», non «carico ripreso»", () => {
    const d = decidi({ performances: [], weekSkipped: true });
    expect(d.rule).toBe("skip-hold");
  });

  it("lo scarico programmato scatta lo stesso, senza prestazioni", () => {
    const d = decidi({ performances: [], nextWeekKind: "scarico" });
    expect(d.rule).toBe("planned-deload");
    expect(d.toWeightKg).toBe(72.5);
  });

  it("l'override manuale vince anche qui", () => {
    const d = decidi({ performances: [], manual: { weightKg: 70 } });
    expect(d.rule).toBe("manual");
    expect(d.toWeightKg).toBe(70);
  });

  /*
    La prova strutturale: **nessuna** combinazione di ingressi senza prestazioni puo'
    finire su una regola che la prestazione la legge. Se un domani qualcuno aggiunge un
    ramo che dereferenzia `performances[0]`, e' questo test a cadere per primo.
  */
  it("non puo' uscire nessuna regola che legge una prestazione", () => {
    const leggonoLaPrestazione = [
      "double-progression",
      "reps-first",
      "rpe-cap",
      "hold-on-miss",
      "deload-on-miss",
    ];
    for (const nextWeekKind of ["accumulo", "intensificazione", "scarico"] as const) {
      for (const weekSkipped of [false, true]) {
        for (const suggestedWeightKg of [null, 80]) {
          const d = decidi({
            performances: [],
            nextWeekKind,
            weekSkipped,
            planned: { ...PIANO, suggestedWeightKg },
          });
          expect(leggonoLaPrestazione, `${nextWeekKind}/${weekSkipped}/${suggestedWeightKg}`).not.toContain(d.rule);
          expect(d.nextStepHint.trim()).not.toBe("");
          expect(d.humanReason.trim()).not.toBe("");
        }
      }
    }
  });
});
