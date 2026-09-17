// Parser SSE minimo: eventi `data: {...}` separati da riga vuota; i chunk possono spezzare un evento.
export async function* parseSse<T = unknown>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let sep = buf.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const data = raw
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (data) yield JSON.parse(data) as T;
        sep = buf.indexOf("\n\n");
      }
    }
    const tail = buf.trim();
    if (tail.startsWith("data:")) yield JSON.parse(tail.slice(5).trim()) as T;
  } finally {
    reader.releaseLock();
  }
}
