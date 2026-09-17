// Invio della coda offline (QA N1): un solo posto che manda `op_queue` a POST /sessions/{id}/sync.
// Lo usano sia il hook della seduta (mentre /oggi/seduta è montata) sia il drain globale dell'AppShell (su qualunque
// rotta app: al mount, al ritorno della rete, al ritorno in primo piano). Una sola richiesta in volo per seduta: chi
// chiede mentre è in corso riceve la stessa promessa, così "online" che sveglia entrambi produce una POST sola.
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { Session, SyncOp, SyncOut } from "@/lib/api/types";
import { draftStore, type QueuedOp } from "./store";

export type SyncOutcome =
  | { kind: "empty" }
  | { kind: "synced"; out: SyncOut; sent: QueuedOp[] }
  /** Il server dice che la seduta è chiusa (o non esiste più): la coda locale non serve più ed è stata svuotata. */
  | { kind: "closed"; session: Session | null }
  | { kind: "offline" }
  | { kind: "error"; error: unknown };

export type DrainDeps = {
  sync: (sessionId: string, ops: SyncOp[]) => Promise<SyncOut>;
  online: () => boolean;
};

const defaultDeps: DrainDeps = {
  sync: (id, ops) => api.sessions.sync(id, ops),
  online: () => typeof navigator === "undefined" || navigator.onLine,
};

const inFlight = new Map<string, Promise<SyncOutcome>>();

/** Le op che si possono mandare: una serie aggiunta offline ha un id locale finché il server non risponde all'add_set. */
export function sendableOps(ops: QueuedOp[]): QueuedOp[] {
  return ops.filter((o) => !(o.set_id && o.set_id.startsWith("local-") && o.op !== "add_set"));
}

export function isClosedError(e: unknown): boolean {
  return isApiError(e) && e.status === 409 && e.code === "session_closed";
}

export function syncSession(sessionId: string, deps: DrainDeps = defaultDeps): Promise<SyncOutcome> {
  const running = inFlight.get(sessionId);
  if (running) return running;
  const p = run(sessionId, deps).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, p);
  return p;
}

async function purge(sessionId: string): Promise<void> {
  const ops = await draftStore.pendingOps(sessionId).catch(() => []);
  await draftStore.removeOps(ops.map((o) => o.client_op_id)).catch(() => {});
  await draftStore.remove(sessionId).catch(() => {});
}

async function run(sessionId: string, deps: DrainDeps): Promise<SyncOutcome> {
  const ops = await draftStore.pendingOps(sessionId);
  const sent = sendableOps(ops);
  if (sent.length === 0) return { kind: "empty" };
  if (!deps.online()) return { kind: "offline" };
  const body: SyncOp[] = sent.map((o) => {
    const { session_id: _s, seq: _q, ...rest } = o;
    void _s;
    void _q;
    return rest;
  });
  let out: SyncOut;
  try {
    out = await deps.sync(sessionId, body);
  } catch (e) {
    if (isClosedError(e) || (isApiError(e) && e.status === 404)) {
      await purge(sessionId);
      return { kind: "closed", session: null };
    }
    if (isApiError(e) && e.status === 0) return { kind: "offline" };
    return { kind: "error", error: e };
  }
  if (out.session.status !== "planned" || out.results.some((r) => r.status === "error" && r.code === "session_closed")) {
    await purge(sessionId);
    return { kind: "closed", session: out.session };
  }
  // le serie aggiunte offline: l'id locale delle patch in coda diventa quello che il server ha assegnato
  for (const r of out.results) {
    const op = sent.find((o) => o.client_op_id === r.client_op_id);
    if (op?.op === "add_set" && r.status !== "error") {
      const ex = out.session.exercises.find((e) => e.id === op.exercise_id);
      const last = ex?.sets[ex.sets.length - 1];
      if (last) await remapLocalSet(sessionId, `local-${op.client_op_id}`, last.id);
    }
  }
  await draftStore.removeOps(out.results.map((r) => r.client_op_id));
  return { kind: "synced", out, sent };
}

async function remapLocalSet(sessionId: string, localId: string, serverId: string): Promise<void> {
  const ops = await draftStore.pendingOps(sessionId);
  for (const o of ops) {
    if (o.set_id === localId) {
      await draftStore.removeOps([o.client_op_id]);
      await draftStore.enqueue({ ...o, set_id: serverId });
    }
  }
}

/** Manda tutta la coda, una seduta per volta. Si ferma alla prima seduta senza rete: le altre aspettano il prossimo giro. */
export async function drainAll(deps: DrainDeps = defaultDeps): Promise<Map<string, SyncOutcome>> {
  const results = new Map<string, SyncOutcome>();
  const ids = await draftStore.pendingSessionIds().catch(() => [] as string[]);
  for (const id of ids) {
    const r = await syncSession(id, deps);
    results.set(id, r);
    if (r.kind === "offline") break;
  }
  return results;
}
