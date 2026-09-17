"""GET /health (liveness, senza DB) e GET /health/db (readiness): pubblici, senza rate limit."""

from __future__ import annotations

from app.db import to_async_url


async def test_health_ok(client):
    r = await client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok" and body["version"] and "db" not in body
    # header di sicurezza anche qui (middleware ASGI più esterno)
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_health_db_ok(client):
    r = await client.get("/health/db")
    assert r.status_code == 200, r.text
    assert r.json()["db"] == "ok"


async def test_health_not_rate_limited(client):
    # 120/min di default per IP: 130 richieste devono passare tutte
    for _ in range(130):
        assert (await client.get("/health")).status_code == 200


async def test_health_not_in_openapi(client):
    paths = (await client.get("/openapi.json")).json()["paths"]
    assert "/health" not in paths and "/health/db" not in paths


def test_to_async_url_translates_libpq_params():
    # URL come li danno Neon e Render: asyncpg non accetta `sslmode` né `channel_binding` come kwarg
    assert to_async_url("postgresql://u:p@h/db?sslmode=require&channel_binding=require") == "postgresql+asyncpg://u:p@h/db?ssl=require"
    assert to_async_url("postgres://u:p@h:5432/db") == "postgresql+asyncpg://u:p@h:5432/db"
    assert to_async_url("postgresql+asyncpg://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"


def test_cors_origins_from_real_env_var(monkeypatch):
    # Su Render/Railway CORS_ORIGINS arriva come env var "a,b" (non JSON): deve diventare una lista
    from app.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", "https://fitcoach.vercel.app, https://www.fitcoach.example")
    assert Settings().cors_origins == ["https://fitcoach.vercel.app", "https://www.fitcoach.example"]
