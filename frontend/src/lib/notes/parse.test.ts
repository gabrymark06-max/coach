import { describe, expect, it } from "vitest";
import { parseNoted } from "./parse";

describe("parseNoted", () => {
  it("separa il testo dagli apici [[n]]", () => {
    expect(parseNoted("tolgo lo stacco[[1]] e riduco[[2]]. Fine")).toEqual([
      { kind: "text", text: "tolgo lo stacco" },
      { kind: "note", n: 1 },
      { kind: "text", text: " e riduco" },
      { kind: "note", n: 2 },
      { kind: "text", text: ". Fine" },
    ]);
  });
  it("testo senza apici resta intero", () => {
    expect(parseNoted("nessuna nota")).toEqual([{ kind: "text", text: "nessuna nota" }]);
  });
  it("stringa vuota → nessun segmento", () => {
    expect(parseNoted("")).toEqual([]);
  });
});
