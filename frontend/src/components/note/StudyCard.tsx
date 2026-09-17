import type { Note } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { Glyph } from "@/components/ui/Glyph";

/** Scheda studio (§2.1.3): cosa dice / non dice / grado / citazioni / audit trail. Compatta nell'apparato. */
export function StudyCard({ note, compact, titleId }: { note: Note; compact?: boolean; titleId?: string }) {
  const body = compact ? "t-nota" : "t-voce";
  return (
    <div className="study">
      <div>
        <span className="t-etichetta muted">Nota {note.n}</span>{" "}
        <span className="t-corpo-strong" id={titleId}>
          {note.title_it}
        </span>
      </div>
      <p className={body}>{note.summary_it}</p>
      <p className={body}>
        Non dice <em>{note.not_says_it}</em>
      </p>
      {note.is_own_note ? (
        <>
          <p className={body}>Nota nostra, non uno studio.</p>
          {note.rationale_it && !compact ? <p className="t-nota muted">{note.rationale_it}</p> : null}
        </>
      ) : (
        <>
          {!compact ? (
            <p>
              <span className="t-etichetta">Evidenza {note.grade ?? "—"}</span>{" "}
              <span className="t-nota muted">{note.grade_label_it}</span>
            </p>
          ) : null}
          {note.citations.length > 0 ? (
            <ul className="t-nota" style={{ listStyle: "none" }}>
              {(compact ? note.citations.slice(0, 1) : note.citations).map((c) => (
                <li key={c.doi} className="study-citation">
                  <em>
                    {c.authors} ({c.year}). {c.title}. {c.journal}.
                  </em>{" "}
                  <a href={c.url || `https://doi.org/${c.doi}`} target="_blank" rel="noopener" aria-label="DOI, si apre in una nuova scheda">
                    DOI <Glyph name="external" size={12} />
                  </a>
                  {c.open_access ? <span className="pill-oa t-etichetta">open access</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {!compact ? (
        <p className="study-meta t-nota">
          Regola <code>{note.rule_id}</code>, versione {note.rule_version}, aggiornata il {formatDate(note.updated_at)}
        </p>
      ) : null}
    </div>
  );
}
