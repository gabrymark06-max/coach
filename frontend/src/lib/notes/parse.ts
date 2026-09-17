// I testi del coach marcano gli apici con [[n]] (contratto §0). Qui si segmentano; il rendering sta in NotedText.
export type NotedSegment = { kind: "text"; text: string } | { kind: "note"; n: number };

const MARK = /\[\[(\d+)\]\]/g;

export function parseNoted(text: string): NotedSegment[] {
  const out: NotedSegment[] = [];
  if (!text) return out;
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: text.slice(last, idx) });
    out.push({ kind: "note", n: Number(m[1]) });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function stripNoted(text: string): string {
  return text.replace(MARK, "");
}
