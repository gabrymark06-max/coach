import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { applyOp, buildCloseSets, countDone, draftStore } from "./store";
import type { Session } from "@/lib/api/types";

function session(): Session {
  return {
    id: "s1",
    name: "Full Body A",
    date: "2026-09-16",
    week: 1,
    index_in_week: 0,
    sessions_in_week: 3,
    status: "planned",
    short_version: false,
    est_minutes: 45,
    updated_at: "2026-09-16T10:00:00Z",
    readiness_done: true,
    exercises: [
      {
        id: "ex1",
        exercise_id: "leg_press",
        name_it: "Pressa 45°",
        pattern: "squat",
        order: 0,
        media: { gif_url: null, poster_url: null, attribution: null },
        prescription: {
          sets: { value: 2, note_n: 1 },
          reps: { range: [8, 12], note_n: 2 },
          rest_s: { value: 120, unit: "s", note_n: 3 },
          rir_target: { value: 4, note_n: 4 },
        },
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

beforeEach(() => {
  indexedDB = new IDBFactory();
  draftStore.reset();
});

describe("bozza in IndexedDB (design-system §3.3)", () => {
  it("salva e riprende la bozza per session_id", async () => {
    await draftStore.save({ session_id: "s1", session: session(), updated_at: "2026-09-16T10:05:00Z", saved_at: Date.now() });
    const d = await draftStore.load("s1");
    expect(d?.session.name).toBe("Full Body A");
    expect(d?.updated_at).toBe("2026-09-16T10:05:00Z");
    expect(await draftStore.load("altra")).toBeNull();
  });

  it("le bozze più vecchie di 7 giorni si cancellano", async () => {
    const eightDays = 8 * 24 * 3600 * 1000;
    await draftStore.save({ session_id: "old", session: session(), updated_at: "2026-09-01T10:00:00Z", saved_at: Date.now() - eightDays });
    await draftStore.save({ session_id: "s1", session: session(), updated_at: "2026-09-16T10:05:00Z", saved_at: Date.now() });
    await draftStore.purgeOlderThan(7 * 24 * 3600 * 1000);
    expect(await draftStore.load("old")).toBeNull();
    expect(await draftStore.load("s1")).not.toBeNull();
  });

  it("la coda delle operazioni conserva l'ordine di creazione e si svuota per id", async () => {
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "a", client_updated_at: "t1", set_id: "set1", status: "done" });
    await draftStore.enqueue({ session_id: "s1", op: "patch_set", client_op_id: "b", client_updated_at: "t2", set_id: "set2", status: "done" });
    const ops = await draftStore.pendingOps("s1");
    expect(ops.map((o) => o.client_op_id)).toEqual(["a", "b"]);
    await draftStore.removeOps(["a"]);
    expect((await draftStore.pendingOps("s1")).map((o) => o.client_op_id)).toEqual(["b"]);
  });

  it("QA N1: elenca le sedute con operazioni in coda, nell'ordine in cui sono entrate, senza doppioni", async () => {
    expect(await draftStore.pendingSessionIds()).toEqual([]);
    await draftStore.enqueue({ session_id: "s2", op: "patch_set", client_op_id: "a", client_updated_at: "t1", set_id: "set1", status: "done" });
    await draftStore.enqueue({ session_id: "s1", op: "close", client_op_id: "b", client_updated_at: "t2", sets: [] });
    await draftStore.enqueue({ session_id: "s2", op: "close", client_op_id: "c", client_updated_at: "t3", sets: [] });
    expect(await draftStore.pendingSessionIds()).toEqual(["s2", "s1"]);
    await draftStore.removeOps(["a", "c"]);
    expect(await draftStore.pendingSessionIds()).toEqual(["s1"]);
  });
});

describe("applyOp: la bozza si aggiorna prima della rete", () => {
  it("patch_set scrive i valori loggati e lo stato", () => {
    const s = applyOp(session(), { op: "patch_set", client_op_id: "a", client_updated_at: "t", set_id: "set1", weight_kg: 60, reps: 8, rir: 3, status: "done" });
    expect(s.exercises[0]?.sets[0]?.logged).toEqual({ weight_kg: 60, reps: 8, rir: 3, status: "done", done_at: "t" });
    expect(s.updated_at).toBe("t");
  });
  it("skip segna tutte le serie dell'esercizio come saltate; restore le riporta a todo", () => {
    const skipped = applyOp(session(), { op: "skip", client_op_id: "a", client_updated_at: "t", exercise_id: "ex1" });
    expect(skipped.exercises[0]?.skipped).toBe(true);
    expect(skipped.exercises[0]?.sets.every((x) => x.logged?.status === "skipped")).toBe(true);
    const back = applyOp(skipped, { op: "restore", client_op_id: "b", client_updated_at: "t2", exercise_id: "ex1" });
    expect(back.exercises[0]?.skipped).toBe(false);
    expect(back.exercises[0]?.sets.every((x) => x.logged?.status === "todo")).toBe(true);
  });
});

describe("buildCloseSets", () => {
  it("manda la bozza intera: le serie senza stato vanno come todo, i valori loggati come sono", () => {
    const s = applyOp(session(), { op: "patch_set", client_op_id: "a", client_updated_at: "t", set_id: "set1", weight_kg: 60, reps: 8, rir: 3, status: "done" });
    expect(buildCloseSets(s)).toEqual([
      { set_id: "set1", weight_kg: 60, reps: 8, rir: 3, status: "done" },
      { set_id: "set2", weight_kg: null, reps: null, rir: null, status: "todo" },
    ]);
  });
});

describe("countDone (QA N1: la vista 'chiusa sul telefono' dice quante serie sono in coda)", () => {
  it("conta solo le serie fatte, non quelle saltate o da fare", () => {
    let s = applyOp(session(), { op: "patch_set", client_op_id: "a", client_updated_at: "t", set_id: "set1", weight_kg: 60, reps: 8, status: "done" });
    expect(countDone(s)).toBe(1);
    s = applyOp(s, { op: "patch_set", client_op_id: "b", client_updated_at: "t2", set_id: "set2", status: "skipped" });
    expect(countDone(s)).toBe(1);
    expect(countDone(session())).toBe(0);
  });
});
