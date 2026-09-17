// Bozza offline della seduta (design-system §3.3, contratto §12.1): IndexedDB via `idb`.
// Ogni cambio scrive la bozza PRIMA di tentare la rete; le operazioni in coda sono idempotenti per client_op_id.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CloseSetIn, Session, SyncOp } from "@/lib/api/types";

export type Draft = {
  session_id: string;
  session: Session; // con i valori loggati localmente già applicati
  updated_at: string; // ISO dell'ultimo cambio locale (client_updated_at della bozza)
  saved_at: number; // epoch ms, per la scadenza a 7 giorni
  resumed?: boolean;
};

export type QueuedOp = SyncOp & { session_id: string; seq?: number };

interface FitcoachDB extends DBSchema {
  session_drafts: { key: string; value: Draft };
  op_queue: { key: number; value: QueuedOp & { seq: number }; indexes: { by_session: string; by_op_id: string } };
  timers: { key: string; value: { session_id: string; end_at: number; total_s: number; rest_s: number; set_id: string; started_at: number } };
}

const DB_NAME = "fitcoach";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FitcoachDB>> | null = null;

function db(): Promise<IDBPDatabase<FitcoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FitcoachDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore("session_drafts", { keyPath: "session_id" });
        const q = d.createObjectStore("op_queue", { keyPath: "seq", autoIncrement: true });
        q.createIndex("by_session", "session_id");
        q.createIndex("by_op_id", "client_op_id");
        d.createObjectStore("timers", { keyPath: "session_id" });
      },
    });
  }
  return dbPromise;
}

export const draftStore = {
  reset() {
    dbPromise = null;
  },
  async load(sessionId: string): Promise<Draft | null> {
    return (await (await db()).get("session_drafts", sessionId)) ?? null;
  },
  async save(draft: Draft): Promise<void> {
    await (await db()).put("session_drafts", draft);
  },
  /** La bozza salvata più di recente: serve quando /today non risponde (senza rete) e la seduta va ripresa lo stesso. */
  async latest(): Promise<Draft | null> {
    const all = await (await db()).getAll("session_drafts");
    if (all.length === 0) return null;
    return all.reduce((a, b) => (b.saved_at > a.saved_at ? b : a));
  },
  async remove(sessionId: string): Promise<void> {
    const d = await db();
    await d.delete("session_drafts", sessionId);
    await d.delete("timers", sessionId);
  },
  async purgeOlderThan(ms: number, now: number = Date.now()): Promise<void> {
    const d = await db();
    const all = await d.getAll("session_drafts");
    for (const x of all) if (now - x.saved_at > ms) await d.delete("session_drafts", x.session_id);
  },
  async enqueue(op: QueuedOp): Promise<void> {
    const d = await db();
    const existing = await d.getFromIndex("op_queue", "by_op_id", op.client_op_id);
    if (existing) return;
    await d.add("op_queue", op as QueuedOp & { seq: number });
  },
  async pendingOps(sessionId: string): Promise<(QueuedOp & { seq: number })[]> {
    const d = await db();
    const ops = await d.getAllFromIndex("op_queue", "by_session", sessionId);
    return ops.sort((a, b) => a.seq - b.seq);
  },
  /** QA N1: le sedute che hanno ancora operazioni in coda, nell'ordine della prima op accodata. Le legge il drain globale. */
  async pendingSessionIds(): Promise<string[]> {
    const d = await db();
    const all = (await d.getAll("op_queue")).sort((a, b) => a.seq - b.seq);
    const ids: string[] = [];
    for (const o of all) if (!ids.includes(o.session_id)) ids.push(o.session_id);
    return ids;
  },
  async removeOps(clientOpIds: string[]): Promise<void> {
    const d = await db();
    for (const id of clientOpIds) {
      const row = await d.getFromIndex("op_queue", "by_op_id", id);
      if (row) await d.delete("op_queue", row.seq);
    }
  },
  async saveTimer(t: FitcoachDB["timers"]["value"]): Promise<void> {
    await (await db()).put("timers", t);
  },
  async loadTimer(sessionId: string) {
    return (await (await db()).get("timers", sessionId)) ?? null;
  },
  async clearTimer(sessionId: string): Promise<void> {
    await (await db()).delete("timers", sessionId);
  },
};

// ---- reducer puro: applica un'operazione alla seduta locale ----
export function applyOp(session: Session, op: SyncOp): Session {
  const next: Session = { ...session, updated_at: op.client_updated_at, exercises: session.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })) };
  switch (op.op) {
    case "patch_set": {
      for (const ex of next.exercises) {
        const set = ex.sets.find((s) => s.id === op.set_id);
        if (!set) continue;
        const prev = set.logged ?? { weight_kg: null, reps: null, rir: null, status: "todo" as const, done_at: null };
        set.logged = {
          weight_kg: op.weight_kg !== undefined ? op.weight_kg : prev.weight_kg,
          reps: op.reps !== undefined ? op.reps : prev.reps,
          rir: op.rir !== undefined ? op.rir : prev.rir,
          status: op.status ?? prev.status,
          done_at: (op.status ?? prev.status) === "done" ? op.client_updated_at : prev.done_at,
        };
      }
      return next;
    }
    case "skip":
    case "restore": {
      const ex = next.exercises.find((e) => e.id === op.exercise_id);
      if (!ex) return next;
      const skipped = op.op === "skip";
      ex.skipped = skipped;
      for (const s of ex.sets) {
        const prev = s.logged ?? { weight_kg: null, reps: null, rir: null, status: "todo" as const, done_at: null };
        s.logged = { ...prev, status: skipped ? "skipped" : "todo", done_at: skipped ? prev.done_at : null };
      }
      return next;
    }
    case "delete_set": {
      for (const ex of next.exercises) ex.sets = ex.sets.filter((s) => s.id !== op.set_id);
      return next;
    }
    case "add_set": {
      const ex = next.exercises.find((e) => e.id === op.exercise_id);
      if (!ex) return next;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: op.set_id ?? `local-${op.client_op_id}`,
        n: ex.sets.length + 1,
        target: last ? { ...last.target } : { weight_kg: null, reps: 8, rir: 2 },
        previous: last?.previous ?? null,
        logged: null,
      });
      return next;
    }
    default:
      return next;
  }
}

export function buildCloseSets(session: Session): CloseSetIn[] {
  const out: CloseSetIn[] = [];
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.id.startsWith("local-")) continue; // serie aggiunte offline non ancora sincronizzate: le porta la coda
      out.push({
        set_id: s.id,
        weight_kg: s.logged?.weight_kg ?? null,
        reps: s.logged?.reps ?? null,
        rir: s.logged?.rir ?? null,
        status: s.logged?.status ?? "todo",
      });
    }
  }
  return out;
}

/** Serie fatte nella bozza locale: la vista "chiusa sul telefono" le dice a parole (QA N1). */
export function countDone(session: Session): number {
  let n = 0;
  for (const ex of session.exercises) for (const s of ex.sets) if (s.logged?.status === "done") n += 1;
  return n;
}

export function countTodo(session: Session): number {
  let n = 0;
  for (const ex of session.exercises) {
    if (ex.removed_today) continue;
    for (const s of ex.sets) if (!s.logged || s.logged.status === "todo") n += 1;
  }
  return n;
}
