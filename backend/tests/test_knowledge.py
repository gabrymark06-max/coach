"""Seam: validatore DOI (Crossref) e seed della base di conoscenza."""

import json

import httpx
import pytest
from sqlalchemy import func, select

from app.knowledge.crossref import CitationVerificationError, CrossrefVerifier
from app.models import Citation, CorpusChunk, Exercise, Rule


def _transport(handler):
    return httpx.MockTransport(handler)


def _ok(title, year=2017):
    def handler(request: httpx.Request):
        assert "mailto=" in str(request.url), "polite pool: manca mailto"
        return httpx.Response(
            200,
            json={"message": {"title": [title], "issued": {"date-parts": [[year - 1]]}, "published-print": {"date-parts": [[year]]}, "container-title": ["Sports Medicine"]}},
        )

    return handler


async def test_verifier_accepts_matching_title_and_year_within_tolerance():
    v = CrossrefVerifier(mailto="test@example.org", transport=_transport(_ok("The Effect of Weekly Set Volume on Strength Gain: A Meta-Analysis")))
    out = await v.verify("10.1007/s40279-017-0762-7", "The Effect of Weekly Set Volume on Strength Gain: A Meta-Analysis", 2017)
    assert out.verified_title.startswith("The Effect of Weekly Set Volume")
    assert out.doi == "10.1007/s40279-017-0762-7"


async def test_verifier_rejects_title_mismatch():
    v = CrossrefVerifier(mailto="test@example.org", transport=_transport(_ok("Something completely different about cats")))
    with pytest.raises(CitationVerificationError) as e:
        await v.verify("10.1007/s40279-017-0762-7", "The Effect of Weekly Set Volume on Strength Gain", 2017)
    assert "titolo" in str(e.value)


async def test_verifier_rejects_year_out_of_tolerance():
    v = CrossrefVerifier(mailto="test@example.org", transport=_transport(_ok("The Effect of Weekly Set Volume on Strength Gain", year=2010)))
    with pytest.raises(CitationVerificationError):
        await v.verify("10.1007/s40279-017-0762-7", "The Effect of Weekly Set Volume on Strength Gain", 2017)


async def test_verifier_fails_explicitly_without_network():
    def down(request):
        raise httpx.ConnectError("no network")

    v = CrossrefVerifier(mailto="test@example.org", transport=_transport(down))
    with pytest.raises(CitationVerificationError) as e:
        await v.verify("10.1007/s40279-017-0762-7", "x", 2017)
    assert "rete" in str(e.value).lower()


async def test_verifier_fails_on_404():
    v = CrossrefVerifier(mailto="test@example.org", transport=_transport(lambda r: httpx.Response(404, text="Resource not found.")))
    with pytest.raises(CitationVerificationError):
        await v.verify("10.0000/does-not-exist", "x", 2017)


async def test_seed_inserts_only_verified_citations_and_all_rules(db, app):
    """Il seed con un verificatore che accetta tutto (mock) popola citazioni, regole, esercizi e corpus."""
    from app.services.knowledge import seed_knowledge
    from tests.helpers import AcceptAllVerifier

    report = await seed_knowledge(db, AcceptAllVerifier(), app.state.embedder)
    assert report.citations == 22
    assert report.rules == 43
    assert report.exercises == 76
    assert report.chunks > 100
    n_cit = (await db.execute(select(func.count(Citation.id)))).scalar_one()
    n_rules = (await db.execute(select(func.count(Rule.id)))).scalar_one()
    n_ex = (await db.execute(select(func.count(Exercise.id)))).scalar_one()
    assert (n_cit, n_rules, n_ex) == (22, 43, 76)
    chunk = (await db.execute(select(CorpusChunk).where(CorpusChunk.id == "rule.rest.compound"))).scalar_one()
    assert chunk.embedding is not None and len(chunk.embedding) == 1536
    assert chunk.citation_ids == ["cit_0014", "cit_0015"]


async def test_seed_stops_when_a_doi_does_not_verify(db):
    from app.services.knowledge import seed_knowledge
    from tests.helpers import RejectOneVerifier

    with pytest.raises(CitationVerificationError):
        await seed_knowledge(db, RejectOneVerifier("10.1007/s40279-017-0762-7"), None)
    n_cit = (await db.execute(select(func.count(Citation.id)))).scalar_one()
    assert n_cit == 0, "il seed non deve inserire nulla se un DOI non verifica"


async def test_every_rule_citation_exists():
    from app.engine import load_citations, load_rules

    ids = {c["id"] for c in load_citations()}
    for r in load_rules().values():
        for c in r.citations:
            assert c in ids, f"{r.id} cita {c} che non esiste"


async def test_knowledge_endpoints_expose_rules_and_citations(client, db, app):
    from app.services.knowledge import seed_knowledge
    from tests.helpers import AcceptAllVerifier

    await seed_knowledge(db, AcceptAllVerifier(), app.state.embedder)
    r = await client.get("/knowledge/rules")
    assert r.status_code == 200
    rules = r.json()
    assert len(rules) == 43
    note = next(x for x in rules if x["rule_id"] == "rest.compound")
    assert note["grade"] == "B"
    assert note["citations"][0]["doi"] == "10.1007/s40279-017-0788-x"
    assert note["grade_label_it"].startswith("B:")
    r2 = await client.get("/knowledge/exercises")
    assert r2.status_code == 200 and len(r2.json()) == 76
    ex = next(x for x in r2.json() if x["exercise_id"] == "goblet_squat")
    assert ex["name_it"] == "Goblet squat con manubrio" and ex["instructions_it"]
    assert ex["media"]["gif_url"] is None
