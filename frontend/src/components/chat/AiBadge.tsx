"use client";

import { useChatTexts } from "@/lib/hooks/useApi";
import { NoteMark } from "@/components/note/NoteMark";

/** Badge AI (§2.4.1, AI Act art. 50): sempre visibile, role=note, con la nota di sistema 1.
 * Porta anche la riga non medica (QA M13), con le parole dei Termini: resta in vista per tutta la conversazione. */
export function AiBadge() {
  const { data } = useChatTexts();
  const text = data?.ai_badge_text ?? "Parli con un coach AI, non con una persona. Le regole dietro ai numeri le hanno scritte delle persone.";
  const m = /^(.*?)(\S+)$/s.exec(text);
  return (
    <p className="ai-badge t-nota" role="note">
      {m ? m[1] : text}
      <span style={{ whiteSpace: "nowrap" }}>
        {m ? m[2] : null}
        {data ? <NoteMark note={data.ai_badge_note} scope="badge" /> : null}
      </span>
      <span className="ai-badge-medical"> Non sostituisce un medico: per dolore, malattie o farmaci, senti il tuo.</span>
    </p>
  );
}
