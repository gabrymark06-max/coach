"""RAG sul corpus (strato 3): pgvector se ci sono embedding reali, altrimenti full-text italiano."""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import Embedder
from app.models import CorpusChunk


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    kind: str
    title_it: str
    text_it: str
    rule_ids: list[str]
    citation_ids: list[str]


_WORD_RE = re.compile(r"[^\W\d_]{4,}", re.UNICODE)


def _fallback_words(query: str) -> list[str]:
    """Solo lettere (accenti inclusi), almeno 4 caratteri, massimo 6 parole: niente operatori, niente numeri."""
    return _WORD_RE.findall(query.lower())[:6]


def _out(c: CorpusChunk) -> RetrievedChunk:
    return RetrievedChunk(id=c.id, kind=c.kind, title_it=c.title_it, text_it=c.text_it, rule_ids=list(c.rule_ids or []), citation_ids=list(c.citation_ids or []))


async def search_corpus(db: AsyncSession, embedder: Embedder, query: str, *, limit: int = 4) -> list[RetrievedChunk]:
    rows: list[CorpusChunk] = []
    if embedder.name != "fake":
        vec = (await embedder.embed([query]))[0]
        q = select(CorpusChunk).where(CorpusChunk.embedding.is_not(None)).order_by(CorpusChunk.embedding.cosine_distance(vec)).limit(limit)
        rows = list((await db.execute(q)).scalars().all())
    if not rows:
        ts = func.to_tsvector("italian", CorpusChunk.title_it + " " + CorpusChunk.text_it)
        tq = func.plainto_tsquery("italian", query)
        q = select(CorpusChunk).where(ts.op("@@")(tq)).order_by(func.ts_rank(ts, tq).desc()).limit(limit)
        rows = list((await db.execute(q)).scalars().all())
    if not rows:
        # ultima spiaggia: parole singole in OR. Mai `to_tsquery` con testo grezzo: `!`, `:`, `&`, `<`, `(`
        # sono operatori tsquery e mandano la transazione in errore (QA B1). `websearch_to_tsquery` con
        # "or" tra le parole è la forma sicura: il parser tratta tutto il resto come testo.
        words = _fallback_words(query)
        if words:
            tq = func.websearch_to_tsquery("italian", " or ".join(words))
            ts = func.to_tsvector("italian", CorpusChunk.title_it + " " + CorpusChunk.text_it)
            q = select(CorpusChunk).where(ts.op("@@")(tq)).order_by(func.ts_rank(ts, tq).desc()).limit(limit)
            rows = list((await db.execute(q)).scalars().all())
    return [_out(c) for c in rows]
