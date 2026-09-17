import { beforeEach, describe, expect, it } from "vitest";
import { clearTodayHint, localDate, readTodayHint, writeTodayHint } from "./todayHint";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("memoria della seduta di oggi (QA M1)", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
  });

  it("ricorda la seduta solo per il giorno in cui è stata scritta", () => {
    const today = new Date(2026, 8, 17, 18, 30);
    writeTodayHint("sess-1", localDate(today));
    expect(readTodayHint(today)).toBe("sess-1");
    expect(readTodayHint(new Date(2026, 8, 18, 0, 5))).toBeNull();
  });

  it("senza memoria o con memoria rotta risponde null", () => {
    expect(readTodayHint()).toBeNull();
    (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.setItem("fitcoach.today.v1", "{not json");
    expect(readTodayHint()).toBeNull();
  });

  it("si può cancellare", () => {
    const now = new Date();
    writeTodayHint("sess-2", localDate(now));
    clearTodayHint();
    expect(readTodayHint(now)).toBeNull();
  });

  it("la data locale ha la forma di TodayOut.date", () => {
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
