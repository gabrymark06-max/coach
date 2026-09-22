import type { LiftedDB } from "./db";
import { nowIso } from "./db";
import { LIBRARY, LIBRARY_META_KEY, LIBRARY_VERSION } from "./library";
import { LATEST_SCHEMA_VERSION } from "./migrations";
import { DEFAULT_SETTINGS, normalizeName, type Exercise } from "./schema";

export interface SeedResult {
  /** esercizi aggiunti ora */
  added: number;
  /** voci gia' presenti, lasciate come stanno */
  skipped: number;
  /** voci saltate perche' l'utente ha gia' un esercizio con quel nome */
  conflicts: string[];
}

/**
 * Carica la libreria precaricata.
 *
 * Idempotente per costruzione: ogni voce ha un id stabile (`lib-<slug>`), quindi il
 * seed *aggiunge solo cio' che manca* e non riscrive mai niente — nemmeno una voce di
 * libreria che l'utente ha modificato. Se l'utente ha creato un esercizio con lo stesso
 * nome, la voce di libreria si salta e lo si riporta in `conflicts`: il suo esercizio
 * vince sempre.
 */
export async function seedLibrary(db: LiftedDB): Promise<SeedResult> {
  const ids = LIBRARY.map((item) => item.id);
  const createdAt = nowIso();

  return db.transaction("rw", db.exercises, async () => {
    const existing = await db.exercises.bulkGet(ids);
    const takenNameKeys = new Set(
      (await db.exercises.toArray()).map((exercise) => exercise.nameKey),
    );

    const toAdd: Exercise[] = [];
    const conflicts: string[] = [];
    let skipped = 0;

    for (let i = 0; i < LIBRARY.length; i += 1) {
      if (existing[i]) {
        skipped += 1;
        continue;
      }
      const item = LIBRARY[i];
      const nameKey = normalizeName(item.name);
      if (takenNameKeys.has(nameKey)) {
        conflicts.push(item.name);
        continue;
      }
      takenNameKeys.add(nameKey);
      toAdd.push({
        id: item.id,
        name: item.name,
        nameKey,
        muscleGroup: item.muscleGroup,
        secondaryMuscles: item.secondaryMuscles,
        equipment: item.equipment,
        isCustom: false,
        isBodyweight: item.isBodyweight,
        createdAt,
      });
    }

    if (toAdd.length > 0) await db.exercises.bulkAdd(toAdd);
    return { added: toAdd.length, skipped, conflicts };
  });
}

/**
 * Primo avvio: impostazioni di default e libreria, una volta sola.
 * Restituisce `null` se non c'era niente da fare.
 */
export async function ensureSeeded(db: LiftedDB): Promise<SeedResult | null> {
  await ensureSettings(db);

  const meta = await db.appMeta.get(LIBRARY_META_KEY);
  if (meta?.value === LIBRARY_VERSION) return null;

  const result = await seedLibrary(db);
  await db.appMeta.put({ key: LIBRARY_META_KEY, value: LIBRARY_VERSION });
  return result;
}

/** Le impostazioni esistono sempre, e non si sovrascrivono mai se gia' presenti. */
export async function ensureSettings(db: LiftedDB) {
  const existing = await db.settings.get("singleton");
  if (existing) return existing;
  const settings = { ...DEFAULT_SETTINGS, schemaVersion: LATEST_SCHEMA_VERSION };
  await db.settings.put(settings);
  return settings;
}
