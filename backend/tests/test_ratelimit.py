"""Seam: il rate limiting in-process risponde con l'errore uniforme (i test lo disattivano altrove)."""

import pytest_asyncio

from app.ratelimit import limiter


@pytest_asyncio.fixture
async def limited():
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = False


async def test_login_is_rate_limited_with_uniform_error(client, limited):
    last = None
    for _ in range(11):
        last = await client.post("/auth/login", json={"email": "x@example.org", "password": "sbagliata-123"})
    assert last.status_code == 429
    assert last.json() == {"code": "rate_limited", "detail": "Troppe richieste in poco tempo. Aspetta un attimo e riprova."}


async def test_register_works_with_limiter_on(client, limited):
    r = await client.post("/auth/register", json={"email": "rl@example.org", "password": "Password-forte-1", "accept_terms": True})
    assert r.status_code == 201, r.text
