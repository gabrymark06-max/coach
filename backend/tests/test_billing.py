"""Seam: /billing — Checkout, Portal, webhook idempotenti, grace, recesso 14 giorni con rimborso integrale."""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models import Entitlement, StripeEvent, Subscription, Withdrawal
from tests.conftest import register


class FakeStripe:
    """Registra le chiamate; nessuna rete. Le firme dei webhook sono verificate con `sig_ok`."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.founders_redeemed = 0

    async def create_customer(self, email, user_id):
        self.calls.append(("create_customer", {"email": email}))
        return "cus_test_1"

    async def create_checkout(self, *, customer_id, price_id, success_url, cancel_url, user_id, promotion_code=None):
        self.calls.append(("create_checkout", {"customer_id": customer_id, "price_id": price_id, "promotion_code": promotion_code}))
        return "https://checkout.stripe.test/s/1"

    async def create_portal(self, *, customer_id, return_url, flow=None):
        self.calls.append(("create_portal", {"customer_id": customer_id, "flow": flow}))
        return "https://billing.stripe.test/p/1"

    async def cancel_subscription(self, subscription_id):
        self.calls.append(("cancel_subscription", {"subscription_id": subscription_id}))

    async def refund_payment_intent(self, payment_intent_id, *, idempotency_key):
        self.calls.append(("refund", {"payment_intent_id": payment_intent_id, "idempotency_key": idempotency_key}))
        return "re_test_1"

    async def promotion_code_redemptions(self, code_id):
        return self.founders_redeemed

    def construct_event(self, payload: bytes, sig_header: str):
        import json

        if sig_header != "sig_ok":
            raise ValueError("bad signature")
        return json.loads(payload)


@pytest_asyncio.fixture
async def stripe_fake(app):
    fake = FakeStripe()
    app.state.stripe = fake
    yield fake


def _sub_event(event_id="evt_1", type_="checkout.session.completed", *, user_id, sub_id="sub_1", status="active", cancel_at_period_end=False, price_id="price_month_test", started=None):
    started = started or datetime.now(UTC)
    period_end = started + timedelta(days=30)
    sub = {
        "id": sub_id,
        "customer": "cus_test_1",
        "status": status,
        "cancel_at_period_end": cancel_at_period_end,
        "start_date": int(started.timestamp()),
        "current_period_end": int(period_end.timestamp()),
        "latest_invoice": "in_1",
        "items": {"data": [{"price": {"id": price_id}}]},
        "metadata": {"user_id": user_id},
    }
    if type_ == "checkout.session.completed":
        obj = {"id": "cs_1", "customer": "cus_test_1", "subscription": sub_id, "metadata": {"user_id": user_id}, "client_reference_id": user_id, "amount_total": 999, "currency": "eur", "payment_intent": None, "subscription_object": sub}
    elif type_.startswith("customer.subscription."):
        obj = sub
    elif type_.startswith("invoice."):
        obj = {"id": "in_2", "customer": "cus_test_1", "subscription": sub_id, "payment_intent": "pi_1", "amount_paid": 999, "currency": "eur", "status": "paid" if type_ == "invoice.paid" else "open"}
    return {"id": event_id, "type": type_, "data": {"object": obj}}


async def _post_event(client, event, sig="sig_ok"):
    import json

    return await client.post("/billing/webhook", content=json.dumps(event).encode(), headers={"stripe-signature": sig, "content-type": "application/json"})


async def test_checkout_creates_customer_and_session(client, stripe_fake):
    headers, body = await register(client)
    r = await client.post("/billing/checkout", json={"price": "month", "from_surface": "end_of_block"}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["url"].startswith("https://checkout.stripe.test")
    names = [c[0] for c in stripe_fake.calls]
    assert names == ["create_customer", "create_checkout"]
    assert stripe_fake.calls[1][1]["price_id"] == "price_month_test"
    ev = (await client.get("/events/mine", headers=headers)).json()
    assert any(e["name"] == "checkout_started" and e["props"]["price"] == "month" for e in ev)


async def test_checkout_invalid_price_is_422(client, stripe_fake):
    headers, _ = await register(client)
    r = await client.post("/billing/checkout", json={"price": "lifetime", "from_surface": "chat_quota"}, headers=headers)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


async def test_founders_counter_and_sold_out(client, stripe_fake):
    headers, _ = await register(client)
    r = await client.get("/billing/founders")
    assert r.status_code == 200 and r.json()["remaining"] == 100
    stripe_fake.founders_redeemed = 100
    r2 = await client.post("/billing/checkout", json={"price": "year_founders", "from_surface": "end_of_block"}, headers=headers)
    assert r2.status_code == 409 and r2.json()["code"] == "founders_sold_out"


async def test_portal_without_subscription_is_409(client, stripe_fake):
    headers, _ = await register(client)
    r = await client.post("/billing/portal", json={"intent": "cancel"}, headers=headers)
    assert r.status_code == 409 and r.json()["code"] == "no_subscription"


async def test_webhook_bad_signature_is_400(client, stripe_fake):
    headers, body = await register(client)
    r = await _post_event(client, _sub_event(user_id=body["user"]["id"]), sig="nope")
    assert r.status_code == 400 and r.json()["code"] == "invalid_signature"


async def test_webhook_checkout_completed_grants_pro_and_is_idempotent(client, stripe_fake, db):
    headers, body = await register(client)
    uid = body["user"]["id"]
    ev = _sub_event(user_id=uid)
    r = await _post_event(client, ev)
    assert r.status_code == 200, r.text
    assert r.json() == {"received": True, "duplicate": False}
    me = (await client.get("/me", headers=headers)).json()
    assert me["entitlement"]["plan"] == "pro" and me["entitlement"]["source"] == "stripe"
    assert me["subscription"]["interval"] == "month" and me["subscription"]["status"] == "active"
    assert me["withdrawal_eligible_until"] is not None
    r2 = await _post_event(client, ev)
    assert r2.json() == {"received": True, "duplicate": True}
    subs = (await db.execute(select(Subscription))).scalars().all()
    assert len(subs) == 1
    evs = (await db.execute(select(StripeEvent))).scalars().all()
    assert len(evs) == 1
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "subscription_started" in names
    portal = await client.post("/billing/portal", json={"intent": "cancel"}, headers=headers)
    assert portal.status_code == 200 and portal.json()["url"].startswith("https://billing.stripe.test")
    assert stripe_fake.calls[-1] == ("create_portal", {"customer_id": "cus_test_1", "flow": "cancel"})


async def test_webhook_payment_failed_sets_grace_then_deleted_downgrades(client, stripe_fake, db):
    headers, body = await register(client)
    uid = body["user"]["id"]
    await _post_event(client, _sub_event("evt_a", user_id=uid))
    r = await _post_event(client, _sub_event("evt_b", "invoice.payment_failed", user_id=uid))
    assert r.status_code == 200
    me = (await client.get("/me", headers=headers)).json()
    assert me["entitlement"]["plan"] == "pro" and me["entitlement"]["grace_until"] is not None
    assert me["subscription"]["status"] == "past_due"
    r2 = await _post_event(client, _sub_event("evt_c", "customer.subscription.deleted", user_id=uid, status="canceled"))
    assert r2.status_code == 200
    me2 = (await client.get("/me", headers=headers)).json()
    assert me2["entitlement"]["plan"] == "free" and me2["subscription"] is None
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "churned" in names


async def test_webhook_subscription_updated_cancel_at_period_end(client, stripe_fake):
    headers, body = await register(client)
    uid = body["user"]["id"]
    await _post_event(client, _sub_event("evt_a", user_id=uid, price_id="price_year_test"))
    await _post_event(client, _sub_event("evt_b", "customer.subscription.updated", user_id=uid, cancel_at_period_end=True, price_id="price_year_test"))
    me = (await client.get("/me", headers=headers)).json()
    assert me["subscription"]["cancel_at_period_end"] is True and me["subscription"]["renews_at"] is None
    assert me["subscription"]["interval"] == "year"


async def test_webhook_unknown_user_is_acknowledged_not_500(client, stripe_fake):
    r = await _post_event(client, _sub_event("evt_x", user_id="00000000-0000-0000-0000-000000000000"))
    assert r.status_code == 200 and r.json()["received"] is True


async def test_withdraw_within_14_days_refunds_and_downgrades(client, stripe_fake, db, app):
    headers, body = await register(client)
    uid = body["user"]["id"]
    await _post_event(client, _sub_event("evt_a", user_id=uid))
    await _post_event(client, _sub_event("evt_b", "invoice.paid", user_id=uid))
    r = await client.post("/billing/withdraw", headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["refund_amount"] == 9.99 and out["refund_currency"] == "eur" and out["withdrawn_at"]
    names = [c[0] for c in stripe_fake.calls]
    assert "refund" in names and "cancel_subscription" in names
    refund_call = next(c for c in stripe_fake.calls if c[0] == "refund")[1]
    assert refund_call["payment_intent_id"] == "pi_1" and refund_call["idempotency_key"]
    me = (await client.get("/me", headers=headers)).json()
    assert me["entitlement"]["plan"] == "free" and me["subscription"] is None and me["withdrawal_eligible_until"] is None
    w = (await db.execute(select(Withdrawal))).scalar_one()
    assert w.refund_id == "re_test_1" and w.amount_cents == 999
    assert any(m.kind == "withdrawal_confirmation" for m in app.state.mailer.sent)
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "withdrawn" in names
    again = await client.post("/billing/withdraw", headers=headers)
    assert again.status_code == 409 and again.json()["code"] == "no_subscription"


async def test_withdraw_after_14_days_is_403(client, stripe_fake):
    headers, body = await register(client)
    uid = body["user"]["id"]
    started = datetime.now(UTC) - timedelta(days=15)
    await _post_event(client, _sub_event("evt_a", user_id=uid, started=started))
    r = await client.post("/billing/withdraw", headers=headers)
    assert r.status_code == 403 and r.json()["code"] == "withdrawal_window_closed"


async def test_withdraw_without_subscription_is_409(client, stripe_fake):
    headers, _ = await register(client)
    r = await client.post("/billing/withdraw", headers=headers)
    assert r.status_code == 409 and r.json()["code"] == "no_subscription"
