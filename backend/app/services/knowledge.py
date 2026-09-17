"""Seed della base di conoscenza: citazioni (solo verificate), regole, esercizi, corpus con embedding.

Tutto o niente: se un DOI non verifica, nessuna riga viene scritta.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import structlog
import yaml
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine import load_catalog, load_citations, load_rules
from app.engine.rules import KNOWLEDGE_DIR
from app.knowledge.crossref import Verifier
from app.llm.base import Embedder
from app.models import Citation, CorpusChunk, Exercise, Rule

log = structlog.get_logger()


@dataclass
class SeedReport:
    citations: int
    rules: int
    exercises: int
    chunks: int


def load_corpus(path: Path | None = None) -> dict:
    return yaml.safe_load((path or KNOWLEDGE_DIR / "corpus.yaml").read_text(encoding="utf-8"))


async def seed_knowledge(db: AsyncSession, verifier: Verifier, embedder: Embedder | None) -> SeedReport:
    citations = load_citations()
    rules = load_rules()
    catalog = load_catalog()
    corpus = load_corpus()

    # 1) verifica di tutti i DOI PRIMA di scrivere qualunque cosa
    verified = []
    for c in citations:
        v = await verifier.verify(c["doi"], c["title"], int(c["year"]))
        verified.append((c, v))
        log.info("citation_verified", id=c["id"], doi=c["doi"])

    cit_ids = {c["id"] for c in citations}
    for r in rules.values():
        missing = [x for x in r.citations if x not in cit_ids]
        if missing:
            raise ValueError(f"la regola {r.id} cita id inesistenti: {missing}")

    # 2) scrittura in una transazione sola
    for c, v in verified:
        stmt = pg_insert(Citation).values(
            id=c["id"],
            doi=c["doi"],
            authors=c["authors"],
            year=int(c["year"]),
            title=c["title"],
            journal=c["journal"],
            type=c["type"],
            open_access=bool(c.get("open_access", False)),
            url=f"https://doi.org/{c['doi']}",
            verified_at=v.verified_at,
            verified_title=v.verified_title,
            verified_via=v.via,
        )
        stmt = stmt.on_conflict_do_update(index_elements=[Citation.id], set_={k: stmt.excluded[k] for k in ("doi", "authors", "year", "title", "journal", "type", "open_access", "url", "verified_at", "verified_title", "verified_via")})
        await db.execute(stmt)

    for r in rules.values():
        stmt = pg_insert(Rule).values(
            id=r.id,
            version=r.version,
            governs=r.governs,
            applies_to=r.applies_to,
            value=r.value,
            grade=r.grade,
            citation_ids=r.citations,
            title_it=r.title_it,
            summary_it=r.summary_it,
            not_says_it=r.not_says_it,
            is_own_note=r.is_own_note,
            rationale_it=r.rationale_it,
            updated_at=r.updated_at,
        )
        stmt = stmt.on_conflict_do_update(index_elements=[Rule.id], set_={k: stmt.excluded[k] for k in ("version", "governs", "applies_to", "value", "grade", "citation_ids", "title_it", "summary_it", "not_says_it", "is_own_note", "rationale_it", "updated_at")})
        await db.execute(stmt)

    for e in catalog:
        stmt = pg_insert(Exercise).values(
            id=e.id,
            name_it=e.name_it,
            name_en=e.name_en,
            pattern=e.pattern,
            primary_muscle=e.primary_muscle,
            secondary_muscles=e.secondary,
            equipment=e.equipment,
            mechanic=e.mechanic,
            spinal_load=e.spinal_load,
            min_tier=e.min_tier,
            requires=e.requires,
            instructions_it=e.instructions_it,
            gif_url=None,
            poster_url=None,
            attribution=("Istruzioni: hasaneyldrm/exercises-dataset (MIT)" if e.ds_id else "Istruzioni: fitcoach"),
            source=f"exercises-dataset:{e.ds_id}" if e.ds_id else "own",
        )
        stmt = stmt.on_conflict_do_update(index_elements=[Exercise.id], set_={k: stmt.excluded[k] for k in ("name_it", "name_en", "pattern", "primary_muscle", "secondary_muscles", "equipment", "mechanic", "spinal_load", "min_tier", "requires", "instructions_it", "attribution", "source")})
        await db.execute(stmt)

    # 3) corpus: riassunti delle regole, schede esercizio, protocolli, sicurezza
    chunks: list[dict] = []
    for r in rules.values():
        chunks.append(
            dict(
                id=f"rule.{r.id}",
                doc_id=f"rule.{r.id}",
                kind="citation_summary",
                title_it=r.title_it,
                text_it=f"{r.summary_it} Cosa non dice: {r.not_says_it}" + (f" Perché: {r.rationale_it}" if r.rationale_it else ""),
                citation_ids=list(r.citations),
                rule_ids=[r.id],
            )
        )
    for e in catalog:
        chunks.append(
            dict(
                id=f"exercise.{e.id}",
                doc_id=f"exercise.{e.id}",
                kind="exercise",
                title_it=e.name_it,
                text_it=f"{e.name_it} ({e.name_en}). Schema: {e.pattern}, muscolo principale: {e.primary_muscle}, attrezzatura: {e.equipment}. "
                + " ".join(e.instructions_it),
                citation_ids=[],
                rule_ids=["selection.substitute.same_pattern"],
            )
        )
    for p in corpus.get("protocols", []):
        chunks.append(dict(id=p["id"], doc_id=p["id"], kind="protocol", title_it=p["title_it"], text_it=p["text_it"].strip(), citation_ids=[], rule_ids=[]))
    for s in corpus.get("safety", []):
        chunks.append(dict(id=s["id"], doc_id=s["id"], kind="safety", title_it=s["title_it"], text_it=s["text_it"].strip(), citation_ids=[], rule_ids=[]))

    embeddings: list[list[float] | None] = [None] * len(chunks)
    if embedder is not None:
        texts = [f"{c['title_it']}\n{c['text_it']}" for c in chunks]
        vecs = []
        for i in range(0, len(texts), 64):
            vecs.extend(await embedder.embed(texts[i : i + 64]))
        embeddings = vecs

    for c, vec in zip(chunks, embeddings, strict=True):
        stmt = pg_insert(CorpusChunk).values(**c, embedding=vec)
        stmt = stmt.on_conflict_do_update(index_elements=[CorpusChunk.id], set_={k: stmt.excluded[k] for k in ("doc_id", "kind", "title_it", "text_it", "citation_ids", "rule_ids", "embedding")})
        await db.execute(stmt)

    await db.commit()
    return SeedReport(citations=len(verified), rules=len(rules), exercises=len(catalog), chunks=len(chunks))


async def knowledge_is_seeded(db: AsyncSession) -> bool:
    return (await db.execute(select(Rule.id).limit(1))).first() is not None


def now_utc() -> datetime:
    return datetime.now(UTC)
