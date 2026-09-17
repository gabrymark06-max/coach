import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { draftStore } from "./store";
import { drainAll, syncSession, type DrainDeps } from "./drain";
import { ApiError } from "@/lib/api/client";
import type { Session, SyncOp, SyncOut } from "@/lib/api/types";

function session(id: string, status: Session["status"] = "planned"): Session {
  return {
    id,
    name: "Full Body A",
    date: "2026-09-17",
    week: 1,
    index_in_week: 0,
    sessions_in_week: 3,
    status,
    short_version: false,
    est_minutes: 45,
    updated_at: "2026-09-17T10:00:00Z",
    readiness_done: true,
    exercises: [
      {
        id: "ex1",
        exercise_id: "leg_press",
        name_it: "Pressa 45°",
        pattern: "squat",
        order: 0,
        media: { gif_url: null, poster_url: null, attribution: null },
        prescription: { sets: { value: 2, note_n: 1 }, reps: { range: [8, 12], note_n: 2 }, rest_s: { value: 120, unit: "s", note_n: 3 }, rir_target: { value: 4, note_n: 4 } },
        substitutes: [],
        instructions_it: [],
        removed_today: false,
        skipped: false,
        sets: [
          { id: "set1", n: 1, target: { weight_kg: null, reps: 8, rir: 4 }, previous: null, logged: null },
          { id: "set2", n: 2, target: { weight_kg: 60, reps: 8, rir: 4 }, previous: null, logged: null },
        ],
        notes: [],
      },
    ],
    notes: [],
    close_line: null,
  };
}

/** Un server finto: applica tutto, risponde con lo stato indicato per seduta. */
function fakeServer(statusFor: Record<string, Session["status"]> = {}) {
  const calls: { id: string; ops: SyncOp[] }[] = [];
  const sync = vi.fn(async (id: string, ops: SyncOp[]): Promise<SyncOut> => {
    calls.push({ id, ops });
    return { results: ops.map((o) => ({ client_op_id: o.client_op_id, status: "applied" as const })), session: session(id, statusFor[id] ?? "planned") };
  });
  return { sync, calls };
}

function deps(over: Partial<DrainDeps> = {}): DrainDeps {
  return { sync: fakeServer().sync, online: () => true, ...over };
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  draftStore.reset();
});

describe("drain globale della coda (QA N1)", () => {
  it("manda una POST /sync per seduta con le sue operazioni, nell'ordine, e svuota la coda", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "a", client_updated_at: "t1", set_id: "set1", status: "done" });
    await draftStore.enqueue({ session_id: "s2", op: "patch_set", client_op_id: "b", client_updated_at: "t2", set_id: "set1", status: "done" });
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "c", client_updated_at: "t3", sets: [] });
    const srv = fakeServer({ s1: "done" });
    const out = await drainAll(deps({ sync: srv.sync }));
    expect(srv.calls.map((c) => [c.id, c.ops.map((o) => o.client_op_id)])).toEqual([
      ["s1", ["a", "c"]],
      ["s2", ["b"]],
    ]);
    // il body non porta i campi locali della coda (session_id, seq)
    expect(srv.calls[0]!.ops[0]).not.toHaveProperty("session_id");
    expect(srv.calls[0]!.ops[0]).not.toHaveProperty("seq");
    expect(await draftStore.pendingSessionIds()).toEqual([]);
    expect(out.get("s1")?.kind).toBe("closed");
    expect(out.get("s2")?.kind).toBe("synced");
  });

  it("una sola richiesta in volo per seduta: chi chiede durante l'invio riceve lo stesso esito", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "a", client_updated_at: "t1", set_id: "set1", status: "done" });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: string[] = [];
    const sync = async (id: string, ops: SyncOp[]): Promise<SyncOut> => {
      calls.push(id);
      await gate;
      return { results: ops.map((o) => ({ client_op_id: o.client_op_id, status: "applied" as const })), session: session(id) };
    };
    const d = deps({ sync });
    const p1 = syncSession("s1", d); // il hook della seduta su "online"
    const p2 = drainAll(d); // l'AppShell sullo stesso evento
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(calls).toEqual(["s1"]);
    expect(r1.kind).toBe("synced");
    expect(r2.get("s1")).toBe(r1);
    // finita la prima, una seconda chiamata è una nuova richiesta (e trova la coda vuota)
    expect((await syncSession("s1", d)).kind).toBe("empty");
    expect(calls).toEqual(["s1"]);
  });

  it("senza rete non manda nulla e lascia la coda com'è", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "a", client_updated_at: "t1", sets: [] });
    const srv = fakeServer();
    const out = await drainAll(deps({ sync: srv.sync, online: () => false }));
    expect(srv.calls).toEqual([]);
    expect(out.get("s1")?.kind).toBe("offline");
    expect((await draftStore.pendingOps("s1")).map((o) => o.client_op_id)).toEqual(["a"]);
  });

  it("un errore di rete durante l'invio (fetch fallita) vale come offline: la coda resta", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "a", client_updated_at: "t1", sets: [] });
    const r = await syncSession("s1", deps({ sync: async () => Promise.reject(new ApiError(0, null)) }));
    expect(r.kind).toBe("offline");
    expect((await draftStore.pendingOps("s1")).length).toBe(1);
  });

  it("un 5xx lascia la coda per il prossimo giro e riporta l'errore", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "a", client_updated_at: "t1", sets: [] });
    const r = await syncSession("s1", deps({ sync: async () => Promise.reject(new ApiError(500, { code: "internal_error", detail: "boom" }, { requestId: "req-1" })) }));
    expect(r.kind).toBe("error");
    expect((await draftStore.pendingOps("s1")).length).toBe(1);
  });

  it("seduta già chiusa sul server (409 session_closed): coda e bozza locali si buttano", async () => {
    await draftStore.save({ session_id: "s1", session: session("s1"), updated_at: "t0", saved_at: Date.now() });
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "a", client_updated_at: "t1", set_id: "set1", status: "done" });
    const r = await syncSession("s1", deps({ sync: async () => Promise.reject(new ApiError(409, { code: "session_closed", detail: "La seduta è già chiusa." })) }));
    expect(r.kind).toBe("closed");
    expect(await draftStore.pendingOps("s1")).toEqual([]);
    expect(await draftStore.load("s1")).toBeNull();
  });

  it("dopo la chiusura applicata via sync la bozza locale non serve più", async () => {
    await draftStore.save({ session_id: "s1", session: session("s1"), updated_at: "t0", saved_at: Date.now() });
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "a", client_updated_at: "t1", sets: [] });
    const r = await syncSession("s1", deps({ sync: fakeServer({ s1: "short" }).sync }));
    expect(r.kind).toBe("closed");
    expect(r.kind === "closed" && r.session?.status).toBe("short");
    expect(await draftStore.load("s1")).toBeNull();
  });

  it("le serie aggiunte offline: prima parte l'add_set, poi le patch sull'id locale prendono l'id del server", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "add_set", client_op_id: "add", client_updated_at: "t1", exercise_id: "ex1" });
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "p", client_updated_at: "t2", set_id: "local-add", weight_kg: 50, reps: 9, status: "done" });
    const sync = vi.fn(async (id: string, ops: SyncOp[]): Promise<SyncOut> => {
      const s = session(id);
      s.exercises[0]!.sets.push({ id: "set3", n: 3, target: { weight_kg: 60, reps: 8, rir: 4 }, previous: null, logged: null });
      return { results: ops.map((o) => ({ client_op_id: o.client_op_id, status: "applied" as const })), session: s };
    });
    const r = await syncSession("s1", deps({ sync }));
    expect(r.kind).toBe("synced");
    expect(sync.mock.calls[0]![1].map((o) => o.client_op_id)).toEqual(["add"]);
    const left = await draftStore.pendingOps("s1");
    expect(left.map((o) => [o.client_op_id, o.set_id])).toEqual([["p", "set3"]]);
  });
});
