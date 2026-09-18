"""CORS_ORIGINS: normalizzazione all'origine canonica.

Difetto trovato in produzione: su Render l'env var era `https://fitcoach.vercel.app/` (slash finale),
ma il browser manda `Origin: https://fitcoach.vercel.app` (senza) e il preflight tornava 400.
"""

from __future__ import annotations

import pytest
import structlog.testing
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings


@pytest.fixture
def _settings_cache():
    """get_settings è lru_cache: si svuota prima e dopo, così il resto della suite resta con l'env di conftest."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://a.app/", ["https://a.app"]),
        (" https://a.app , https://b.app/ ", ["https://a.app", "https://b.app"]),
        ("https://A.App", ["https://a.app"]),
        ("HTTPS://a.app", ["https://a.app"]),
        ("https://a.app//", ["https://a.app"]),
        ("https://a.app:8443/", ["https://a.app:8443"]),
        ("https://a.app/path", ["https://a.app"]),
        ("https://a.app,, ,https://b.app/", ["https://a.app", "https://b.app"]),
        ("http://localhost:3000/", ["http://localhost:3000"]),
        ("", []),
        ("  ,  /  ", []),
        ("*", ["*"]),  # il jolly resta com'è: normalizzarlo lo cancellerebbe
    ],
)
def test_cors_origins_normalizzate(monkeypatch, raw, expected):
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert Settings().cors_origins == expected


def test_origine_con_path_logga_avviso_e_non_fallisce(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://x.app/qualcosa")
    with structlog.testing.capture_logs() as logs:
        settings = Settings()
    assert settings.cors_origins == ["https://x.app"]
    assert any(e.get("log_level") == "warning" and e.get("event") == "cors_origin_normalizzata" for e in logs), logs


def test_cors_vuoto_in_dev_non_fallisce(monkeypatch, _settings_cache):
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.setenv("CORS_ORIGINS", "")
    assert get_settings().cors_origins == []


def test_cors_vuoto_in_prod_fallisce_all_avvio(monkeypatch, _settings_cache):
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h/db")
    monkeypatch.setenv("JWT_SECRET", "prod-secret-abbastanza-lungo-0123456789")
    monkeypatch.setenv("CORS_ORIGINS", "  /  ")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        get_settings()


async def test_preflight_accetta_origin_senza_slash(monkeypatch, _settings_cache):
    """End-to-end: env con slash finale, Origin del browser senza slash -> 200; origine estranea -> 400."""
    monkeypatch.setenv("CORS_ORIGINS", "https://fitcoach.vercel.app/")
    from app.main import create_app

    application = create_app()
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as c:
        ok = await c.options(
            "/billing/prices",
            headers={"Origin": "https://fitcoach.vercel.app", "Access-Control-Request-Method": "GET"},
        )
        assert ok.status_code == 200, ok.text
        assert ok.headers["access-control-allow-origin"] == "https://fitcoach.vercel.app"

        ko = await c.options(
            "/billing/prices",
            headers={"Origin": "https://altro.example", "Access-Control-Request-Method": "GET"},
        )
        assert ko.status_code == 400
        assert "access-control-allow-origin" not in ko.headers
