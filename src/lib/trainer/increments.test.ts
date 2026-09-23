import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/db/library";
import { DEFAULT_SETTINGS, type Exercise } from "@/lib/db/schema";
import { incrementFor } from "./increments";

function esercizio(id: string): Exercise {
  const row = LIBRARY.find((item) => item.id === id);
  if (!row) throw new Error(`manca ${id} in libreria`);
  return {
    id: row.id,
    name: row.name,
    nameKey: row.id,
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
  };
}

describe("incrementFor — di quanto si sale, attrezzo per attrezzo", () => {
  it("dà 2,5 kg al bilanciere della parte alta e 5 a quello della parte bassa", () => {
    // Un +5 in panca è un salto che quasi nessuno fa due settimane di fila; sullo
    // squat è il minimo che si nota.
    expect(incrementFor(esercizio("lib-panca-piana-barbell"), DEFAULT_SETTINGS).stepKg).toBe(2.5);
    expect(incrementFor(esercizio("lib-squat-barbell"), DEFAULT_SETTINGS).stepKg).toBe(5);
    expect(incrementFor(esercizio("lib-stacco-barbell"), DEFAULT_SETTINGS).stepKg).toBe(5);
  });

  it("dà al bilanciere un mezzo incremento caricabile, agli altri no", () => {
    // Sul bilanciere esistono i dischi da 1,25; fra un manubrio da 22 e uno da 24 non
    // c'è niente, ed è questo che impedisce al freno da RPE di dimezzare in silenzio.
    const bilanciere = incrementFor(esercizio("lib-panca-piana-barbell"), DEFAULT_SETTINGS);
    expect(bilanciere.fineStepKg).toBe(1.25);

    const manubri = incrementFor(esercizio("lib-panca-piana-dumbbell"), DEFAULT_SETTINGS);
    expect(manubri.fineStepKg).toBe(manubri.stepKg);
  });

  it("l'incremento dell'esercizio vince solo quando dice più del generico", () => {
    /*
      Le voci di libreria ereditano `stepKgOverride` dalla tabella per attrezzo: quello
      non è un fatto dell'esercizio, è un ripiego, e non deve zittire l'impostazione
      dell'utente. Un valore **diverso** dal default dell'attrezzo sì: quella è una pila
      di pesi con le sue tacche.
    */
    const cavi = esercizio("lib-lat-pulldown-presa-larga-cable");
    expect(cavi.stepKgOverride).toBe(2.5); // = il default dei cavi
    const suMisura = { ...DEFAULT_SETTINGS, trainerIncrementMachineKg: 10 };
    expect(incrementFor(cavi, suMisura).stepKg).toBe(10);

    const aTacche = { ...cavi, stepKgOverride: 7 };
    expect(incrementFor(aTacche, suMisura).stepKg).toBe(7);
  });

  it("legge le impostazioni, non delle costanti nel codice", () => {
    const suMisura = { ...DEFAULT_SETTINGS, trainerIncrementDumbbellKg: 1 };
    expect(incrementFor(esercizio("lib-panca-piana-dumbbell"), suMisura).stepKg).toBe(1);
  });

  it("non propone mai un incremento nullo o negativo, su nessuna voce di libreria", () => {
    for (const row of LIBRARY) {
      const { stepKg, fineStepKg } = incrementFor(esercizio(row.id), DEFAULT_SETTINGS);
      expect(stepKg, row.name).toBeGreaterThan(0);
      expect(fineStepKg, row.name).toBeGreaterThan(0);
      expect(fineStepKg, row.name).toBeLessThanOrEqual(stepKg);
    }
  });
});
