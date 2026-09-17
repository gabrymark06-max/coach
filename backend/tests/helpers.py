"""Doppi per i test: verificatore DOI che non tocca la rete."""

from __future__ import annotations

from datetime import UTC, datetime

from app.knowledge.crossref import CitationVerificationError, VerifiedCitation


class AcceptAllVerifier:
    async def verify(self, doi: str, expected_title: str, expected_year: int) -> VerifiedCitation:
        return VerifiedCitation(doi=doi, verified_title=expected_title, verified_year=expected_year, verified_at=datetime.now(UTC), via="fake")


class RejectOneVerifier(AcceptAllVerifier):
    def __init__(self, bad_doi: str):
        self.bad_doi = bad_doi

    async def verify(self, doi: str, expected_title: str, expected_year: int) -> VerifiedCitation:
        if doi == self.bad_doi:
            raise CitationVerificationError(f"{doi}: il titolo non coincide (test)")
        return await super().verify(doi, expected_title, expected_year)


async def seed(db, app):
    from app.services.knowledge import seed_knowledge

    return await seed_knowledge(db, AcceptAllVerifier(), app.state.embedder)
