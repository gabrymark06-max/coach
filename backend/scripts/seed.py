"""Seed della base di conoscenza con verifica DOI reale su Crossref.

Uso:  python -m scripts.seed
Richiede CROSSREF_MAILTO (polite pool). Senza rete fallisce in modo esplicito: nessun DOI non verificato entra.
"""

from __future__ import annotations

import asyncio
import sys

from app.config import get_settings
from app.db import dispose_engine, get_sessionmaker
from app.knowledge.crossref import CitationVerificationError, CrossrefVerifier
from app.llm import build_embedder
from app.services.knowledge import seed_knowledge


async def main() -> int:
    settings = get_settings()
    if not settings.crossref_mailto:
        print("ERRORE: CROSSREF_MAILTO non impostato (serve per il polite pool di Crossref).")
        return 2
    verifier = CrossrefVerifier(mailto=settings.crossref_mailto)
    embedder = build_embedder(settings)
    try:
        async with get_sessionmaker()() as db:
            report = await seed_knowledge(db, verifier, embedder)
    except CitationVerificationError as e:
        print(f"SEED INTERROTTO — DOI non verificato: {e}")
        return 1
    finally:
        await dispose_engine()
    print(
        f"Seed completato: {report.citations} citazioni verificate su Crossref, {report.rules} regole, "
        f"{report.exercises} esercizi, {report.chunks} chunk di corpus (embedding: {embedder.name})."
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
