// Note di sistema e regole pubbliche (GET /knowledge/rules/{rule_id}): il frontend non scrive nessuna nota.
import { API_URL } from "@/lib/api/client";
import type { Note } from "@/lib/api/types";
import { SERVER_FETCH_TIMEOUT_MS } from "@/lib/prices";

/** Lato server (landing, prezzi): cache 1 h; se l'API non risponde, la nota manca e l'apice non si disegna (regola 3). */
export async function getRules(ids: string[]): Promise<Note[]> {
  const out: Note[] = [];
  await Promise.all(
    ids.map(async (id, i) => {
      try {
        const res = await fetch(`${API_URL}/knowledge/rules/${encodeURIComponent(id)}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS) });
        if (!res.ok) return;
        const note = (await res.json()) as Note;
        out[i] = { ...note, n: i + 1 };
      } catch {
        // nessuna nota: nessun apice
      }
    }),
  );
  return out.filter(Boolean);
}
