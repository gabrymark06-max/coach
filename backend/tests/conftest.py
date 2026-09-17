"""Harness: Postgres embedded (pgserver) per sessione, migrazioni Alembic vere, tabelle svuotate tra i test."""

from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

_PG_DIR = Path(tempfile.mkdtemp(prefix="fitcoach_pgtest_"))

os.environ.update(
    {
        "APP_ENV": "test",
        "EMBEDDED_PG_DIR": str(_PG_DIR),
        "DATABASE_URL": "",
        "LLM_PROVIDER": "fake",
        "EMBEDDING_PROVIDER": "fake",
        "EMAIL_PROVIDER": "fake",
        "RATE_LIMIT_ENABLED": "false",
        "MISSED_SESSION_JOB_ENABLED": "false",
        "STRIPE_SECRET_KEY": "sk_test_dummy_for_tests_only",
        "STRIPE_WEBHOOK_SECRET": "whsec_dummy_for_tests_only",
        "STRIPE_PRICE_MONTH": "price_month_test",
        "STRIPE_PRICE_YEAR": "price_year_test",
        "STRIPE_PRICE_YEAR_FOUNDERS": "price_founders_test",
        "JWT_SECRET": "test-secret-not-for-prod-0123456789",
        "CROSSREF_MAILTO": "test@example.org",
    }
)


@pytest.fixture(scope="session", autouse=True)
def _migrated_db():
    """Avvia il Postgres embedded in una cartella nuova e applica le migrazioni (mai create_all)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(cfg, "head")
    yield
    import app.db as dbm

    if dbm._embedded is not None:
        try:
            dbm._embedded.cleanup()
        except Exception:
            pass
    shutil.rmtree(_PG_DIR, ignore_errors=True)


@pytest_asyncio.fixture(scope="session")
async def app(_migrated_db):
    from app.main import create_app

    application = create_app()
    async with application.router.lifespan_context(application):
        yield application
    from app.db import dispose_engine

    await dispose_engine()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(app):
    from app.db import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, citations, rules, exercises, corpus_chunks, stripe_events, events, email_log "
                "RESTART IDENTITY CASCADE"
            )
        )
    app.state.mailer.sent.clear()
    yield


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def db(app):
    from app.db import get_sessionmaker

    async with get_sessionmaker()() as session:
        yield session


async def register(client, email="anna@example.org", password="Password-forte-1"):
    r = await client.post("/auth/register", json={"email": email, "password": password, "accept_terms": True})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


@pytest_asyncio.fixture
async def auth(client):
    headers, _ = await register(client)
    return headers
