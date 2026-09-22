import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type MeasurementEntry, type Session } from "@/lib/db/schema";
import {
  BACKUP_FORMAT_VERSION,
  BackupError,
  buildBackup,
  parseBackup,
  serializeBackup,
  type BackupPayload,
} from "./format";
import { CSV_BOM, measurementsCsv, setsCsv, toCsv } from "./csv";

const SESSION: Session = {
  id: "sess-1",
  routineName: "Push A",
  startedAt: "2026-01-05T10:00:00.000Z",
  endedAt: "2026-01-05T11:00:00.000Z",
  status: "completed",
  pausedMs: 0,
  exercises: [
    {
      id: "se-1",
      exerciseId: "lib-panca",
      exerciseName: "Panca piana con bilanciere",
      equipment: "barbell",
      order: 0,
      restSec: 90,
      sets: [
        {
          id: "set-1",
          index: 1,
          type: "warmup",
          weightKg: 20,
          reps: 10,
          completed: true,
        },
        {
          id: "set-2",
          index: 2,
          type: "normal",
          weightKg: 82.5,
          reps: 8,
          rpe: 8,
          completed: true,
        },
      ],
    },
  ],
  totalVolumeKg: 860,
  totalSets: 2,
  durationSec: 3600,
  exerciseIds: ["lib-panca"],
};

const MEASURE: MeasurementEntry = {
  id: "m-1",
  metric: "bodyweight",
  value: 78.4,
  unit: "kg",
  date: "2026-01-05T08:00:00.000Z",
  note: "a digiuno; dopo la \"pesata\"",
};

function payload(): BackupPayload {
  return {
    exercises: [],
    routines: [],
    sessions: [SESSION],
    personalRecords: [],
    measurements: [MEASURE],
    settings: DEFAULT_SETTINGS,
  };
}

describe("buildBackup / serializeBackup", () => {
  it("scrive un formato versionato, con i conteggi in chiaro per l'anteprima", () => {
    const backup = buildBackup(payload(), {
      exportedAt: "2026-02-01T09:00:00.000Z",
      schemaVersion: 1,
    });

    expect(backup.app).toBe("lifted");
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.counts).toEqual({
      exercises: 0,
      routines: 0,
      sessions: 1,
      personalRecords: 0,
      measurements: 1,
    });
    expect(serializeBackup(backup)).toContain('"app": "lifted"');
  });
});

describe("parseBackup", () => {
  const testo = serializeBackup(
    buildBackup(payload(), { exportedAt: "2026-02-01T09:00:00.000Z", schemaVersion: 1 }),
  );

  it("rilegge quello che ha scritto, identico", () => {
    const riletto = parseBackup(testo);
    expect(riletto.data.sessions).toEqual([SESSION]);
    expect(riletto.data.measurements).toEqual([MEASURE]);
    expect(riletto.data.settings?.defaultRestSec).toBe(90);
  });

  it("rifiuta un file che non e' JSON", () => {
    expect(() => parseBackup("non sono un backup")).toThrow(BackupError);
    try {
      parseBackup("non sono un backup");
    } catch (error) {
      expect((error as BackupError).code).toBe("not-lifted");
      expect((error as BackupError).message).toBe("Questo file non è un backup di Lifted.");
    }
  });

  it("rifiuta un JSON valido che non e' un backup di Lifted", () => {
    expect(() => parseBackup('{"ciao":"mondo"}')).toThrow(
      "Questo file non è un backup di Lifted.",
    );
  });

  it("rifiuta un backup di una versione futura, dicendo cosa fare", () => {
    const futuro = JSON.parse(testo);
    futuro.formatVersion = BACKUP_FORMAT_VERSION + 1;
    try {
      parseBackup(JSON.stringify(futuro));
      throw new Error("doveva fallire");
    } catch (error) {
      expect((error as BackupError).code).toBe("future-version");
      expect((error as BackupError).message).toContain("versione più recente");
    }
  });

  it("rifiuta un backup con una tabella danneggiata, prima di toccare il database", () => {
    const rotto = JSON.parse(testo);
    rotto.data.sessions = "questa non e' una lista";
    try {
      parseBackup(JSON.stringify(rotto));
      throw new Error("doveva fallire");
    } catch (error) {
      expect((error as BackupError).code).toBe("malformed");
      expect((error as BackupError).detail).toContain("sessions");
    }
  });

  it("rifiuta una voce senza id: senza chiave primaria non si importa niente", () => {
    const rotto = JSON.parse(testo);
    delete rotto.data.sessions[0].id;
    try {
      parseBackup(JSON.stringify(rotto));
      throw new Error("doveva fallire");
    } catch (error) {
      expect((error as BackupError).code).toBe("malformed");
    }
  });

  it("ricostruisce i campi derivati di un backup vecchio invece di rifiutarlo", () => {
    const vecchio = JSON.parse(testo);
    vecchio.data.exercises = [
      {
        id: "custom-1",
        name: "Rematore Kroc",
        muscleGroup: "back",
        equipment: "dumbbell",
        isCustom: true,
        isBodyweight: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    delete vecchio.data.sessions[0].exerciseIds;

    const riletto = parseBackup(JSON.stringify(vecchio));
    expect(riletto.data.exercises[0].nameKey).toBe("rematore kroc");
    expect(riletto.data.exercises[0].secondaryMuscles).toEqual([]);
    expect(riletto.data.sessions[0].exerciseIds).toEqual(["lib-panca"]);
  });

  it("accetta un backup senza impostazioni: si riparte da quelle predefinite", () => {
    const senza = JSON.parse(testo);
    senza.data.settings = null;
    expect(parseBackup(JSON.stringify(senza)).data.settings).toBeNull();
  });
});

describe("toCsv", () => {
  it("usa il punto e virgola, perche' Excel italiano separa cosi'", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("a;b\r\n1;2");
  });

  it("protegge con le virgolette i campi che contengono separatore, virgolette o a capo", () => {
    expect(toCsv([["uno;due", 'vir"golette', "a\ncapo"]])).toBe(
      '"uno;due";"vir""golette";"a\ncapo"',
    );
  });
});

describe("setsCsv", () => {
  const csv = setsCsv([SESSION]);

  it("apre con il BOM, cosi' Excel non sbaglia gli accenti", () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true);
  });

  it("scrive i decimali con la virgola", () => {
    expect(csv).toContain(";82,5;");
  });

  it("scrive una riga per serie, riscaldamento compreso", () => {
    const righe = csv.trimEnd().split("\r\n");
    expect(righe).toHaveLength(3);
    expect(righe[0]).toContain("Esercizio");
    expect(righe[1]).toContain("Riscaldamento");
    expect(righe[2]).toContain("Normale");
  });

  it("riporta il volume della serie, cosi' il foglio non deve ricalcolarlo", () => {
    expect(csv).toContain(";660;");
  });
});

describe("measurementsCsv", () => {
  it("scrive metrica, valore con la virgola, unita' e nota protetta", () => {
    const csv = measurementsCsv([MEASURE]);
    const righe = csv.trimEnd().split("\r\n");
    expect(righe[1]).toContain(";Peso corporeo;78,4;kg;");
    expect(righe[1]).toContain('"a digiuno; dopo la ""pesata"""');
  });
});
