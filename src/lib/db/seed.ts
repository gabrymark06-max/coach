import type { LiftedDB } from "./db";
import { nowIso } from "./db";
import {
  LIBRARY,
  LIBRARY_META_KEY,
  LIBRARY_VERSION,
  libraryKey,
  type LibraryExercise,
} from "./library";
import { LATEST_SCHEMA_VERSION } from "./migrations";
import { DEFAULT_SETTINGS, exerciseKey, type Exercise } from "./schema";

export interface SeedResult {
  /** esercizi aggiunti ora */
  added: number;
  /** voci di libreria gia' presenti, aggiornate con i campi nuovi */
  updated: number;
  /** voci gia' presenti e gia' allineate: non toccate */
  skipped: number;
  /** voci saltate perche' l'utente ha gia' un esercizio con quel nome e quell'attrezzo */
  conflicts: string[];
}

/**
 * Carica la libreria precaricata — ~270 voci, una per combinazione movimento x attrezzo.
 *
 * **Idempotente, e per identita' non per nome.** Una voce si riconosce dalla sua chiave
 * di libreria `famiglia | variante | attrezzo`, che non cambia quando cambia il nome.
 * E' quello che permette di passare dagli 81 esercizi della v1 («Panca piana con
 * bilanciere») ai 269 della v2 («Panca piana (Bilanciere)») **aggiornando** le voci
 * esistenti invece di affiancarne una copia: lo storico dell'utente resta attaccato
 * all'esercizio che ha sempre usato.
 *
 * Tre regole che non si negoziano:
 *  1. gli esercizi con `isCustom: true` **non si toccano mai** (spec-v2 §3), nemmeno per
 *     aggiungere `family`;
 *  2. se il nome nuovo collide con un esercizio dell'utente, **vince il suo**: la voce
 *     di libreria tiene il vecchio nome e finisce in `conflicts`;
 *  3. nessuna voce viene mai cancellata. Un esercizio di libreria che non esiste piu'
 *     nella lista resta dov'e': potrebbe essere dentro una routine o dentro uno storico.
 *
 * La chiave di libreria e' `famiglia + variante + attrezzo`, non `famiglia + attrezzo`
 * come dice §9.4: senza la variante, `Lat pulldown presa larga (Cavi)` e
 * `Lat pulldown presa stretta (Cavi)` avrebbero la stessa chiave e il seed ne perderebbe
 * tre su quattro.
 */
export async function seedLibrary(db: LiftedDB): Promise<SeedResult> {
  const createdAt = nowIso();

  return db.transaction("rw", db.exercises, async () => {
    const existing = await db.exercises.toArray();

    const byLibraryKey = new Map<string, Exercise>();
    const nameKeyOwner = new Map<string, Exercise>();
    for (const exercise of existing) {
      nameKeyOwner.set(exercise.nameKey, exercise);
      if (exercise.isCustom || !exercise.family) continue;
      byLibraryKey.set(libraryKey(exercise), exercise);
    }

    const toAdd: Exercise[] = [];
    const toUpdate: Exercise[] = [];
    const conflicts: string[] = [];
    let skipped = 0;

    for (const row of LIBRARY) {
      const current = byLibraryKey.get(libraryKey(row));

      if (!current) {
        const nameKey = exerciseKey(row.name, row.equipment);
        const owner = nameKeyOwner.get(nameKey);
        if (owner) {
          // Un esercizio dell'utente occupa gia' questo nome con questo attrezzo.
          conflicts.push(row.name);
          continue;
        }
        nameKeyOwner.set(nameKey, { id: row.id } as Exercise);
        toAdd.push(fromLibrary(row, nameKey, createdAt));
        continue;
      }

      const next = merge(current, row, nameKeyOwner, conflicts);
      if (next) toUpdate.push(next);
      else skipped += 1;
    }

    if (toAdd.length > 0) await db.exercises.bulkAdd(toAdd);
    if (toUpdate.length > 0) await db.exercises.bulkPut(toUpdate);

    return { added: toAdd.length, updated: toUpdate.length, skipped, conflicts };
  });
}

function fromLibrary(
  row: LibraryExercise,
  nameKey: string,
  createdAt: string,
): Exercise {
  return {
    id: row.id,
    name: row.name,
    nameKey,
    muscleGroup: row.muscleGroup,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment,
    isCustom: false,
    isBodyweight: row.isBodyweight,
    createdAt,
    family: row.family,
    variant: row.variant,
    mechanics: row.mechanics,
    unilateral: row.unilateral,
    loadMode: row.loadMode,
    stepKgOverride: row.stepKgOverride,
    popularity: row.popularity,
  };
}

/**
 * Allinea una voce gia' presente. Ritorna `null` se non c'era niente da cambiare —
 * cosi' una seconda passata del seed non riscrive 269 righe per niente.
 *
 * `notes`, `defaultRestSec` e `archivedAt` non si toccano: sono dell'utente anche su una
 * voce di libreria. Il nome si cambia solo se il nuovo e' libero.
 */
function merge(
  current: Exercise,
  row: LibraryExercise,
  nameKeyOwner: Map<string, Exercise>,
  conflicts: string[],
): Exercise | null {
  const wantedKey = exerciseKey(row.name, row.equipment);
  const owner = nameKeyOwner.get(wantedKey);
  const canRename = !owner || owner.id === current.id;
  if (!canRename) conflicts.push(row.name);

  const next: Exercise = {
    ...current,
    name: canRename ? row.name : current.name,
    nameKey: canRename ? wantedKey : current.nameKey,
    muscleGroup: row.muscleGroup,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment,
    isBodyweight: row.isBodyweight,
    family: row.family,
    variant: row.variant,
    mechanics: row.mechanics,
    unilateral: row.unilateral,
    loadMode: row.loadMode,
    stepKgOverride: row.stepKgOverride,
    popularity: row.popularity,
  };

  if (same(current, next)) return null;

  if (canRename) {
    nameKeyOwner.delete(current.nameKey);
    nameKeyOwner.set(wantedKey, next);
  }
  return next;
}

function same(a: Exercise, b: Exercise): boolean {
  return (
    a.name === b.name &&
    a.nameKey === b.nameKey &&
    a.muscleGroup === b.muscleGroup &&
    a.equipment === b.equipment &&
    a.isBodyweight === b.isBodyweight &&
    a.family === b.family &&
    a.variant === b.variant &&
    a.mechanics === b.mechanics &&
    a.unilateral === b.unilateral &&
    a.loadMode === b.loadMode &&
    a.stepKgOverride === b.stepKgOverride &&
    a.popularity === b.popularity &&
    a.secondaryMuscles.join(",") === b.secondaryMuscles.join(",")
  );
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

/**
 * Le impostazioni esistono sempre. Non si sovrascrivono mai se gia' presenti, ma i
 * campi aggiunti da una versione nuova si riempiono: un'impostazione mancante diventa
 * `undefined` dentro un controllo, e `undefined` a schermo e' un bug.
 */
export async function ensureSettings(db: LiftedDB) {
  const existing = await db.settings.get("singleton");
  if (existing) {
    const merged = { ...DEFAULT_SETTINGS, ...existing, id: "singleton" as const };
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      await db.settings.put(merged);
      return merged;
    }
    return existing;
  }
  const settings = { ...DEFAULT_SETTINGS, schemaVersion: LATEST_SCHEMA_VERSION };
  await db.settings.put(settings);
  return settings;
}
