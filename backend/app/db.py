"""Engine async, sessione, e Postgres embedded per dev/test."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings, get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None
_embedded = None


def resolve_database_url(settings: Settings) -> str:
    """Se DATABASE_URL manca (dev/test), avvia un Postgres embedded con pgvector."""
    global _embedded
    if settings.database_url:
        return to_async_url(settings.database_url)
    if settings.is_prod:
        raise RuntimeError("DATABASE_URL obbligatoria in produzione")
    import pgserver  # import locale: dipendenza solo di sviluppo

    data_dir = Path(settings.embedded_pg_dir).resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    _embedded = pgserver.get_server(str(data_dir))
    _embedded.psql("create extension if not exists vector;")
    uri = _embedded.get_uri()
    os.environ["FITCOACH_RESOLVED_DATABASE_URL"] = uri
    return to_async_url(uri)


# Parametri libpq che asyncpg non accetta come kwarg (SQLAlchemy passa la query string a `asyncpg.connect`):
# `sslmode` diventa `ssl` (asyncpg lo capisce con gli stessi valori), gli altri si tolgono. Senza questo un URL
# di Neon/Render (`?sslmode=require&channel_binding=require`) fallisce con TypeError prima ancora di connettersi.
_SSL_KEYS = {"sslmode": "ssl"}
_DROP_KEYS = {"channel_binding", "options", "application_name", "connect_timeout", "sslrootcert"}


def to_async_url(url: str) -> str:
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix) :]
            break
    else:
        return url
    return _normalize_query(url)


def _normalize_query(url: str) -> str:
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    parts = urlsplit(url)
    if not parts.query:
        return url
    query = []
    for k, v in parse_qsl(parts.query, keep_blank_values=True):
        if k in _DROP_KEYS:
            continue
        query.append((_SSL_KEYS.get(k, k), v))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def to_sync_url(url: str) -> str:
    """Per Alembic (psycopg non installato: usiamo asyncpg anche lì via run_sync)."""
    return to_async_url(url)


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        settings = get_settings()
        url = resolve_database_url(settings)
        _engine = create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    get_engine()
    assert _sessionmaker is not None
    return _sessionmaker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_sessionmaker()() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
