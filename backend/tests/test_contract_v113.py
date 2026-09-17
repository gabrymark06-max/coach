"""Seam v1.1.3: due buchi di contratto segnalati dal frontend.

1. `Retry-After` deve essere leggibile dal browser: `Access-Control-Expose-Headers` sul 429 con Origin in allowlist.
2. `GET /billing/prices` (pubblica): le tre opzioni Pro da env, anche senza Stripe.
"""

import pytest_asyncio

from app.ratelimit import limiter
from tests.test_billing import stripe_fake  # noqa: F401 — fixture condivisa

ORIGIN = {"Origin": "http://localhost:3000"}


@pytest_asyncio.fixture
async def limited():
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = False


# ---------------------------------------------------------------- 1. Retry-After esposto in CORS


async def test_429_exposes_retry_after_to_the_browser(client, limited):
    last = None
    for _ in range(11):
        last = await client.post("/auth/login", json={"email": "x@example.org", "password": "sbagliata-123"}, headers=ORIGIN)
    assert last.status_code == 429
    assert last.headers.get("retry-after", "").isdigit()
    assert last.headers.get("access-control-allow-origin") == "http://localhost:3000"
    exposed = {h.strip() for h in last.headers.get("access-control-expose-headers", "").split(",")}
    assert {"Retry-After", "X-Request-Id", "ETag"} <= exposed, exposed


# ---------------------------------------------------------------- 2. GET /billing/prices


def _by_key(body):
    return {p["key"]: p for p in body["prices"]}


async def test_prices_is_public_and_lists_the_three_pro_options(client, stripe_fake):
    r = await client.get("/billing/prices", headers=ORIGIN)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["currency"] == "EUR" and body["vat_included"] is True
    assert [p["key"] for p in body["prices"]] == ["month", "year", "year_founders"]
    p = _by_key(body)
    # Valori da env (conftest non li imposta: sono i default del business model, 9,99 / 59,99 / 49,99 IVA inclusa)
    assert p["month"] == {"key": "month", "interval": "month", "amount_cents": 999, "amount_eur": 9.99, "per_month_eur": 9.99, "label_it": "Mensile", "available": True}
    assert p["year"] == {"key": "year", "interval": "year", "amount_cents": 5999, "amount_eur": 59.99, "per_month_eur": 5.0, "label_it": "Annuale", "available": True}
    assert p["year_founders"] == {"key": "year_founders", "interval": "year", "amount_cents": 4999, "amount_eur": 49.99, "per_month_eur": 4.17, "label_it": "Annuale fondatori", "available": True}
    assert body["founders"] == {"available": True, "remaining": 100}
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_prices_agree_with_founders_endpoint(client, stripe_fake):
    prices = (await client.get("/billing/prices")).json()
    founders = (await client.get("/billing/founders")).json()
    assert _by_key(prices)["year_founders"]["amount_eur"] == founders["price_eur"]
    assert prices["founders"]["remaining"] == founders["remaining"]


async def test_prices_mark_founders_sold_out(client, stripe_fake):
    stripe_fake.founders_redeemed = 100
    body = (await client.get("/billing/prices")).json()
    assert body["founders"] == {"available": False, "remaining": 0}
    p = _by_key(body)
    assert p["year_founders"]["available"] is False
    assert p["month"]["available"] is True and p["year"]["available"] is True


async def test_prices_work_without_stripe(client, app):
    from app.config import get_settings
    from app.services.stripe_gateway import build_stripe

    settings = get_settings()
    previous, old_key = app.state.stripe, settings.stripe_secret_key
    settings.stripe_secret_key = ""
    app.state.stripe = build_stripe(settings)
    try:
        r = await client.get("/billing/prices")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["founders"] == {"available": True, "remaining": 100}
        assert [p["amount_eur"] for p in body["prices"]] == [9.99, 59.99, 49.99]
    finally:
        settings.stripe_secret_key = old_key
        app.state.stripe = previous


async def test_prices_come_from_env(client, stripe_fake):
    from app.config import get_settings

    settings = get_settings()
    old = (settings.pro_price_month_cents, settings.pro_price_year_cents, settings.pro_price_year_founders_cents)
    settings.pro_price_month_cents, settings.pro_price_year_cents, settings.pro_price_year_founders_cents = 1299, 7900, 6000
    try:
        p = _by_key((await client.get("/billing/prices")).json())
        assert (p["month"]["amount_eur"], p["year"]["amount_eur"], p["year_founders"]["amount_eur"]) == (12.99, 79.0, 60.0)
        assert (p["year"]["per_month_eur"], p["year_founders"]["per_month_eur"]) == (6.58, 5.0)
        assert (await client.get("/billing/founders")).json()["price_eur"] == 60.0
    finally:
        settings.pro_price_month_cents, settings.pro_price_year_cents, settings.pro_price_year_founders_cents = old


async def test_prices_is_in_openapi_with_response_model(client):
    spec = (await client.get("/openapi.json")).json()
    op = spec["paths"]["/billing/prices"]["get"]
    assert "security" not in op or op["security"] == []
    ref = op["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
    assert ref.endswith("/PricesOut")
