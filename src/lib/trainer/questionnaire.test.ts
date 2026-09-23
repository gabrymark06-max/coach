import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_CHOICES,
  EQUIPMENT_PRESETS,
  MAX_PRIORITY_MUSCLES,
  describeEquipment,
  firstIncompleteStep,
  splitPreview,
  summaryRows,
  toProfile,
  validateStep,
  type Draft,
} from "./questionnaire";

const COMPLETA: Draft = {
  goal: "hypertrophy",
  priorityMuscles: ["chest"],
  equipment: ["barbell", "dumbbell"],
  level: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 60,
};

describe("validateStep", () => {
  it("chiede un obiettivo, e lo dice con una frase", () => {
    expect(validateStep(1, {})?.message).toBe("Scegli un obiettivo per continuare.");
    expect(validateStep(1, { goal: "strength" })).toBeNull();
  });

  it("accetta zero muscoli privilegiati e rifiuta il terzo", () => {
    expect(validateStep(2, { priorityMuscles: [] })).toBeNull();
    expect(validateStep(2, { priorityMuscles: ["chest", "back"] })).toBeNull();
    expect(validateStep(2, { priorityMuscles: ["chest", "back", "legs"] })?.message).toContain(
      String(MAX_PRIORITY_MUSCLES),
    );
  });

  it("l'errore sull'attrezzatura offre una via d'uscita, non un muro", () => {
    const error = validateStep(3, { equipment: [] });
    expect(error?.escape?.label).toBe("Va bene, corpo libero");
    expect(error?.escape?.patch.equipment).toEqual(["bodyweight"]);
  });
});

describe("firstIncompleteStep — la bozza riprende da dove si era fermata", () => {
  it("riparte dal primo passo senza risposta", () => {
    expect(firstIncompleteStep({})).toBe(1);
    expect(firstIncompleteStep({ goal: "strength" })).toBe(3);
    expect(firstIncompleteStep({ goal: "strength", equipment: ["barbell"] })).toBe(4);
    expect(firstIncompleteStep(COMPLETA)).toBe(6);
  });
});

describe("toProfile", () => {
  it("non produce un profilo finché manca una risposta", () => {
    expect(toProfile({ goal: "strength" })).toBeNull();
    expect(toProfile({ ...COMPLETA, equipment: [] })).toBeNull();
  });

  it("taglia i muscoli privilegiati al massimo consentito", () => {
    const profile = toProfile({ ...COMPLETA, priorityMuscles: ["chest", "back", "legs"] });
    expect(profile?.priorityMuscles).toHaveLength(MAX_PRIORITY_MUSCLES);
  });
});

describe("i preset coprono le caselle vere", () => {
  it("ogni attrezzo di ogni preset esiste fra le caselle", () => {
    for (const preset of EQUIPMENT_PRESETS) {
      for (const item of preset.equipment) {
        expect(EQUIPMENT_CHOICES, preset.label).toContain(item);
      }
    }
  });

  it("chiama il preset per nome invece di dire «14 attrezzi»", () => {
    expect(describeEquipment(EQUIPMENT_PRESETS[0].equipment)).toBe("Palestra completa");
    expect(describeEquipment(["dumbbell", "bodyweight"])).toBe("Solo manubri");
    expect(describeEquipment(["barbell"])).toBe("Bilanciere");
  });
});

describe("il riepilogo del passo 6", () => {
  it("mostra ogni risposta con il passo a cui tornare", () => {
    const rows = summaryRows(COMPLETA);
    expect(rows.map((row) => row.step)).toEqual([1, 2, 3, 4, 5]);
    expect(rows[1].value).toBe("Petto");
    expect(rows[4].value).toContain("Upper/Lower ×2");
  });

  it("dice «Nessuna preferenza» invece di lasciare il campo vuoto", () => {
    expect(summaryRows({ ...COMPLETA, priorityMuscles: [] })[1].value).toBe(
      "Nessuna preferenza",
    );
  });
});

describe("splitPreview — al passo 5 si vede già che settimana esce", () => {
  it("dice lo split prima di generare", () => {
    expect(splitPreview(4, "intermediate")).toBe("Upper/Lower ×2");
    expect(splitPreview(3, "beginner")).toBe("Full body ×3");
    expect(splitPreview(3, "advanced")).toBe("Push/Pull/Legs");
  });
});
