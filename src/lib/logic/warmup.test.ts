import { describe, expect, it } from "vitest";
import { buildWarmupPlan, DEFAULT_WARMUP_PERCENTS } from "./warmup";

describe("buildWarmupPlan — la tabella del design system (§6.3)", () => {
  it("su 100 kg con bilanciere da 20 produce bilanciere / 50% / 70% / 87,5%", () => {
    const plan = buildWarmupPlan({
      targetKg: 100,
      barWeightKg: 20,
      percents: DEFAULT_WARMUP_PERCENTS,
      stepKg: 2.5,
      includeBar: true,
    });

    expect(plan.status).toBe("ok");
    expect(plan.sets).toEqual([
      { label: "Bilanciere", percent: null, weightKg: 20, exactKg: 20, reps: 10, restSec: 30 },
      { label: "50%", percent: 0.5, weightKg: 50, exactKg: 50, reps: 8, restSec: 45 },
      { label: "70%", percent: 0.7, weightKg: 70, exactKg: 70, reps: 5, restSec: 60 },
      { label: "87,5%", percent: 0.875, weightKg: 87.5, exactKg: 87.5, reps: 2, restSec: 90 },
    ]);
  });
});

describe("buildWarmupPlan — arrotondamento al disco piu' piccolo", () => {
  it("arrotonda al passo e conserva il valore teorico", () => {
    const plan = buildWarmupPlan({
      targetKg: 102.5,
      barWeightKg: 20,
      percents: [0.7],
      stepKg: 2.5,
      includeBar: false,
    });

    expect(plan.sets[0].exactKg).toBe(71.75);
    expect(plan.sets[0].weightKg).toBe(72.5);
  });

  it("con dischi da 1,25 per lato il passo fine da' un peso piu' vicino", () => {
    const plan = buildWarmupPlan({
      targetKg: 102.5,
      barWeightKg: 20,
      percents: [0.7],
      stepKg: 1.25,
      includeBar: false,
    });

    expect(plan.sets[0].weightKg).toBe(71.25);
  });
});

describe("buildWarmupPlan — senza bilanciere (manubri, macchine)", () => {
  it("le percentuali partono dal 50% e la riga del bilanciere non esiste", () => {
    const plan = buildWarmupPlan({
      targetKg: 40,
      barWeightKg: 20,
      percents: DEFAULT_WARMUP_PERCENTS,
      stepKg: 2.5,
      includeBar: false,
    });

    expect(plan.sets.map((s) => s.label)).toEqual(["50%", "70%", "87,5%"]);
    expect(plan.sets[0].weightKg).toBe(20);
  });
});

describe("buildWarmupPlan — casi che non producono una tabella", () => {
  it("un target sotto il bilanciere non si riscalda", () => {
    const plan = buildWarmupPlan({
      targetKg: 15,
      barWeightKg: 20,
      percents: DEFAULT_WARMUP_PERCENTS,
      stepKg: 2.5,
      includeBar: true,
    });

    expect(plan.status).toBe("below-bar");
    expect(plan.sets).toEqual([]);
  });

  it("senza peso target non c'e' tabella", () => {
    const plan = buildWarmupPlan({
      targetKg: null,
      barWeightKg: 20,
      percents: DEFAULT_WARMUP_PERCENTS,
      stepKg: 2.5,
      includeBar: true,
    });

    expect(plan.status).toBe("no-target");
    expect(plan.sets).toEqual([]);
  });

  it("le percentuali che finiscono sul peso del bilanciere non si ripetono", () => {
    // 40 kg target: il 50% e' 20 kg, cioe' il bilanciere gia' presente in tabella
    const plan = buildWarmupPlan({
      targetKg: 40,
      barWeightKg: 20,
      percents: DEFAULT_WARMUP_PERCENTS,
      stepKg: 2.5,
      includeBar: true,
    });

    expect(plan.sets.map((s) => s.weightKg)).toEqual([20, 27.5, 35]);
  });
});
