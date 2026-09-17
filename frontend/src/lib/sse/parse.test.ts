import { describe, expect, it } from "vitest";
import { parseSse } from "./parse";

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("parseSse", () => {
  it("emette un evento per ogni blocco data:, anche se spezzato tra chunk", async () => {
    const s = stream(['data: {"type": "delta", "text": "Ri', 'posi "}\n\ndata: {"type": "done", "message": {"id": "m1"}}\n\n']);
    const out: unknown[] = [];
    for await (const ev of parseSse(s)) out.push(ev);
    expect(out).toEqual([
      { type: "delta", text: "Riposi " },
      { type: "done", message: { id: "m1" } },
    ]);
  });
  it("ignora righe vuote e commenti", async () => {
    const s = stream([': ping\n\n\ndata: {"type":"delta","text":"a"}\n\n']);
    const out: unknown[] = [];
    for await (const ev of parseSse(s)) out.push(ev);
    expect(out).toEqual([{ type: "delta", text: "a" }]);
  });
});
