"""La Nota: da rule_id a oggetto Note numerato per risposta. Il chip di fonte è una join, mai una generazione."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Citation, Rule
from app.schemas.common import CitationOut, Note

GRADE_LABELS = {
    "A": "A: più meta-analisi concordi",
    "B": "B: una meta-analisi, un consenso o un RCT",
    "C": "C: evidenza indiretta o prassi delle linee guida",
    None: "Nota nostra, non uno studio",
}

_RULE_MARK = re.compile(r"\[\[rule:([a-z0-9_.]+)\]\]")


class KnowledgeIndex:
    """Regole e citazioni caricate una volta per richiesta."""

    def __init__(self, rules: dict[str, Rule], citations: dict[str, Citation]):
        self.rules = rules
        self.citations = citations

    @classmethod
    async def load(cls, db: AsyncSession) -> KnowledgeIndex:
        rules = {r.id: r for r in (await db.execute(select(Rule))).scalars().all()}
        cits = {c.id: c for c in (await db.execute(select(Citation))).scalars().all()}
        return cls(rules, cits)

    def citation_out(self, cid: str) -> CitationOut | None:
        c = self.citations.get(cid)
        if c is None:
            return None
        return CitationOut(
            authors=c.authors, year=c.year, title=c.title, journal=c.journal, doi=c.doi, url=c.url, open_access=c.open_access, type=c.type
        )


class NoteBook:
    """Assegna numeri locali (1…) ai rule_id nell'ordine in cui compaiono in una risposta."""

    def __init__(self, index: KnowledgeIndex):
        self.index = index
        self._order: list[str] = []

    def n(self, rule_id: str | None) -> int | None:
        if rule_id is None or rule_id not in self.index.rules:
            return None
        if rule_id not in self._order:
            self._order.append(rule_id)
        return self._order.index(rule_id) + 1

    def mark(self, text: str) -> str:
        """Converte i marcatori del motore [[rule:ID]] nei [[n]] del contratto."""

        def repl(m: re.Match) -> str:
            n = self.n(m.group(1))
            return f"[[{n}]]" if n else ""

        return _RULE_MARK.sub(repl, text)

    def notes(self) -> list[Note]:
        out: list[Note] = []
        for i, rid in enumerate(self._order, start=1):
            r = self.index.rules[rid]
            cits = [c for c in (self.index.citation_out(cid) for cid in (r.citation_ids or [])) if c is not None]
            out.append(
                Note(
                    n=i,
                    rule_id=r.id,
                    rule_version=r.version,
                    updated_at=r.updated_at,
                    title_it=r.title_it,
                    summary_it=r.summary_it,
                    not_says_it=r.not_says_it,
                    grade=r.grade,
                    grade_label_it=GRADE_LABELS.get(r.grade, GRADE_LABELS[None]),
                    is_own_note=r.is_own_note,
                    rationale_it=r.rationale_it,
                    citations=cits,
                )
            )
        return out


def note_for_rule(index: KnowledgeIndex, rule_id: str, n: int = 1) -> Note:
    nb = NoteBook(index)
    nb.n(rule_id)
    note = nb.notes()[0]
    note.n = n
    return note
