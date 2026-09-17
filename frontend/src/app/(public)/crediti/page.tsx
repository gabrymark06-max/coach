import type { Metadata } from "next";
import { API_URL } from "@/lib/api/client";
import type { KnowledgeExercise } from "@/lib/api/types";
import { SERVER_FETCH_TIMEOUT_MS } from "@/lib/prices";

export const metadata: Metadata = { title: "Crediti", alternates: { canonical: "/crediti" } };

async function getExercises(): Promise<KnowledgeExercise[] | null> {
  try {
    const res = await fetch(`${API_URL}/knowledge/exercises`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as KnowledgeExercise[];
  } catch {
    return null;
  }
}

/** Crediti (business §8): attribuzione per item; gli esercizi arrivano da GET /knowledge/exercises. */
export default async function Page() {
  const exercises = await getExercises();
  return (
    <article className="legal" style={{ padding: "var(--space-8) 0" }}>
      <h1 className="t-titolo">Crediti</h1>
      <h2 className="t-corpo-strong">Fonti scientifiche</h2>
      <p className="t-voce">Ogni nota cita studi con DOI verificato su Crossref. Le note in italiano sono nostre e non riproducono testo integrale.</p>
      <h2 className="t-corpo-strong">Esercizi</h2>
      <p className="t-voce">
        Le istruzioni in italiano vengono da hasaneyldrm/exercises-dataset (licenza MIT), solo i testi. Il catalogo degli esercizi si ispira a wger (CC BY-SA). Nessuna GIF di terzi.
      </p>
      <h2 className="t-corpo-strong">Caratteri</h2>
      <p className="t-voce">Archivo (Omnibus-Type) e Newsreader (Production Type), entrambi con licenza SIL Open Font License 1.1, serviti dal nostro dominio.</p>
      <h2 className="t-corpo-strong">Attribuzione per esercizio</h2>
      {exercises === null ? (
        <p className="t-voce">L&apos;elenco degli esercizi non è raggiungibile adesso. Riprova tra poco.</p>
      ) : exercises.length === 0 ? (
        <p className="t-voce">Nessun esercizio nel catalogo.</p>
      ) : (
        <ul className="t-nota" style={{ listStyle: "none" }}>
          {exercises.map((e) => (
            <li key={e.exercise_id}>
              <strong>{e.name_it}</strong> ({e.name_en}) — {e.media.attribution ?? "istruzioni: fitcoach"}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
