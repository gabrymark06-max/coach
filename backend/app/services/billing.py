"""Soldi: trattati come ostili. Prezzi solo da env, webhook verificati e idempotenti, recesso con rimborso integrale."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.email.base import Mailer, OutgoingEmail
from app.errors import ApiError, Conflict, Forbidden
from app.models import EmailLog, StripeEvent, Subscription, User, Withdrawal
from app.services import entitlements as ent_service
from app.services import events
from app.services.stripe_gateway import StripeGateway

log = structlog.get_logger()

PRICE_KEYS = ("month", "year", "year_founders")
ACTIVE_STATUSES = ("active", "past_due", "trialing", "unpaid", "incomplete")


def price_cents_for(settings: Settings, key: str) -> int:
    """Importo IVA inclusa in centesimi, da env: l'unico posto in cui il backend conosce i numeri."""
    return {"month": settings.pro_price_month_cents, "year": settings.pro_price_year_cents, "year_founders": settings.pro_price_year_founders_cents}[key]


PRICE_INTERVALS = {"month": "month", "year": "year", "year_founders": "year"}
PRICE_LABELS_IT = {"month": "Mensile", "year": "Annuale", "year_founders": "Annuale fondatori"}


async def price_catalog(settings: Settings, gateway: StripeGateway) -> dict[str, Any]:
    """Le tre opzioni Pro per la pagina prezzi. Senza Stripe `remaining` è il massimo: la pagina resta viva."""
    remaining = await founders_remaining(settings, gateway)
    prices = []
    for key in PRICE_KEYS:
        cents = price_cents_for(settings, key)
        months = 12 if PRICE_INTERVALS[key] == "year" else 1
        prices.append(
            {
                "key": key,
                "interval": PRICE_INTERVALS[key],
                "amount_cents": cents,
                "amount_eur": round(cents / 100, 2),
                "per_month_eur": round(cents / months / 100, 2),
                "label_it": PRICE_LABELS_IT[key],
                "available": remaining > 0 if key == "year_founders" else True,
            }
        )
    return {"currency": "EUR", "vat_included": True, "prices": prices, "founders": {"available": remaining > 0, "remaining": remaining}}


def price_id_for(settings: Settings, key: str) -> str:
    return {"month": settings.stripe_price_month, "year": settings.stripe_price_year, "year_founders": settings.stripe_price_year_founders}[key]


def price_key_for(settings: Settings, price_id: str | None) -> str:
    for k in PRICE_KEYS:
        if price_id and price_id_for(settings, k) == price_id:
            return k
    return "month"


async def founders_remaining(settings: Settings, gateway: StripeGateway) -> int:
    redeemed = await gateway.promotion_code_redemptions(settings.stripe_founders_promo_code_id)
    return max(0, settings.stripe_founders_max - redeemed)


async def ensure_customer(db: AsyncSession, gateway: StripeGateway, user: User) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    cid = await gateway.create_customer(user.email, str(user.id))
    user.stripe_customer_id = cid
    await db.flush()
    return cid


async def checkout(db: AsyncSession, settings: Settings, gateway: StripeGateway, user: User, price: str, from_surface: str) -> str:
    if price == "year_founders" and await founders_remaining(settings, gateway) <= 0:
        raise Conflict("Il prezzo fondatori è finito: restano il mensile e l'annuale.", code="founders_sold_out")
    cid = await ensure_customer(db, gateway, user)
    url = await gateway.create_checkout(
        customer_id=cid,
        price_id=price_id_for(settings, price),
        success_url=f"{settings.frontend_url}/account/abbonamento/successo",
        cancel_url=f"{settings.frontend_url}/account/abbonamento/annullato",
        user_id=str(user.id),
        promotion_code=settings.stripe_founders_promo_code_id or None if price == "year_founders" else None,
    )
    await events.record(db, user.id, "checkout_started", {"price": price, "from_surface": from_surface})
    await db.commit()
    return url


async def current_subscription(db: AsyncSession, user_id) -> Subscription | None:
    q = select(Subscription).where(Subscription.user_id == user_id, Subscription.status.in_(ACTIVE_STATUSES)).order_by(Subscription.started_at.desc()).limit(1)
    return (await db.execute(q)).scalar_one_or_none()


async def portal(db: AsyncSession, settings: Settings, gateway: StripeGateway, user: User, intent: str | None) -> str:
    sub = await current_subscription(db, user.id)
    if sub is None or not user.stripe_customer_id:
        raise Conflict("Non c'è un abbonamento da gestire. Piano: Base.", code="no_subscription")
    return await gateway.create_portal(customer_id=user.stripe_customer_id, return_url=f"{settings.frontend_url}/account", flow=intent)


# ---------------------------------------------------------------- webhook


def _ts(v: Any) -> datetime | None:
    return datetime.fromtimestamp(int(v), tz=UTC) if v else None


async def _user_for(db: AsyncSession, obj: dict) -> User | None:
    uid = (obj.get("metadata") or {}).get("user_id") or obj.get("client_reference_id")
    if uid:
        try:
            u = await db.get(User, uuid.UUID(str(uid)))
            if u:
                return u
        except ValueError:
            pass
    cus = obj.get("customer")
    if cus:
        return (await db.execute(select(User).where(User.stripe_customer_id == cus))).scalar_one_or_none()
    return None


async def _upsert_subscription(db: AsyncSession, settings: Settings, user: User, sub: dict) -> Subscription:
    row = (await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == sub["id"]))).scalar_one_or_none()
    items = ((sub.get("items") or {}).get("data") or [])
    price_id = ((items[0].get("price") or {}).get("id") if items else None)
    if row is None:
        row = Subscription(
            user_id=user.id,
            stripe_customer_id=sub.get("customer") or user.stripe_customer_id or "",
            stripe_subscription_id=sub["id"],
            price_key=price_key_for(settings, price_id),
            status=sub.get("status", "active"),
            started_at=_ts(sub.get("start_date")) or datetime.now(UTC),
        )
        db.add(row)
    row.status = sub.get("status", row.status)
    row.price_key = price_key_for(settings, price_id) if price_id else row.price_key
    row.current_period_end = _ts(sub.get("current_period_end")) or row.current_period_end
    row.cancel_at_period_end = bool(sub.get("cancel_at_period_end", False))
    row.latest_invoice_id = sub.get("latest_invoice") if isinstance(sub.get("latest_invoice"), str) else row.latest_invoice_id
    if sub.get("status") == "canceled":
        row.ended_at = _ts(sub.get("ended_at")) or datetime.now(UTC)
    if not user.stripe_customer_id and sub.get("customer"):
        user.stripe_customer_id = sub["customer"]
    await db.flush()
    return row


async def _apply_entitlement(db: AsyncSession, settings: Settings, user: User, row: Subscription) -> None:
    if row.status in ("active", "trialing"):
        await ent_service.grant(db, user.id, source="stripe", valid_until=row.current_period_end, grace_until=None)
    elif row.status in ("past_due", "unpaid"):
        await ent_service.grant(db, user.id, source="stripe", valid_until=row.current_period_end, grace_until=datetime.now(UTC) + timedelta(days=settings.grace_days))
    else:
        await ent_service.revoke(db, user.id)


async def handle_webhook(db: AsyncSession, settings: Settings, gateway: StripeGateway, payload: bytes, sig_header: str | None) -> dict:
    try:
        event = gateway.construct_event(payload, sig_header or "")
    except ApiError:
        raise  # es. 503 billing_unavailable: Stripe ritenta, e non è una firma sbagliata
    except Exception as e:  # firma non valida, payload rotto
        raise ApiError("Firma del webhook non valida.", code="invalid_signature", status_code=400) from e
    event_id = str(event.get("id"))
    if await db.get(StripeEvent, event_id) is not None:
        return {"received": True, "duplicate": True}
    etype = str(event.get("type"))
    obj = (event.get("data") or {}).get("object") or {}
    log.info("stripe_webhook", type=etype, event_id=event_id)

    user = await _user_for(db, obj)
    if user is not None:
        if etype == "checkout.session.completed":
            sub = obj.get("subscription_object") or {}
            if not sub and obj.get("subscription"):
                sub = {"id": obj["subscription"], "customer": obj.get("customer"), "status": "active", "start_date": None, "metadata": obj.get("metadata") or {}}
            if sub:
                row = await _upsert_subscription(db, settings, user, sub)
                await _apply_entitlement(db, settings, user, row)
                await events.record(db, user.id, "subscription_started", {"price": row.price_key})
        elif etype in ("customer.subscription.created", "customer.subscription.updated"):
            row = await _upsert_subscription(db, settings, user, obj)
            await _apply_entitlement(db, settings, user, row)
        elif etype == "customer.subscription.deleted":
            obj = {**obj, "status": "canceled"}
            row = await _upsert_subscription(db, settings, user, obj)
            await ent_service.revoke(db, user.id)
            await events.record(db, user.id, "churned", {"price": row.price_key})
        elif etype == "invoice.paid":
            row = await current_subscription(db, user.id)
            if row is not None:
                row.status = "active"
                row.latest_invoice_id = obj.get("id") or row.latest_invoice_id
                pi = obj.get("payment_intent")
                row.latest_payment_intent_id = pi if isinstance(pi, str) else (pi or {}).get("id") if pi else row.latest_payment_intent_id
                row.amount_cents = obj.get("amount_paid", row.amount_cents)
                row.currency = obj.get("currency", row.currency)
                await _apply_entitlement(db, settings, user, row)
        elif etype == "invoice.payment_failed":
            row = await current_subscription(db, user.id)
            if row is not None:
                row.status = "past_due"
                await _apply_entitlement(db, settings, user, row)
    else:
        log.warning("stripe_webhook_unknown_user", type=etype, event_id=event_id)

    db.add(StripeEvent(id=event_id, type=etype))
    await db.commit()
    return {"received": True, "duplicate": False}


# ---------------------------------------------------------------- recesso (Dir. 2023/2673)


async def withdraw(db: AsyncSession, settings: Settings, gateway: StripeGateway, mailer: Mailer, user: User) -> Withdrawal:
    sub = await current_subscription(db, user.id)
    if sub is None:
        raise Conflict("Non c'è un abbonamento da cui recedere. Piano: Base.", code="no_subscription")
    now = datetime.now(UTC)
    deadline = sub.started_at + timedelta(days=settings.withdrawal_days)
    if now > deadline:
        raise Forbidden("I 14 giorni per il recesso sono passati. Puoi comunque disdire a fine periodo dal portale.", code="withdrawal_window_closed")
    existing = (await db.execute(select(Withdrawal).where(Withdrawal.subscription_id == sub.id))).scalar_one_or_none()
    if existing is not None:
        raise Conflict("Il recesso è già registrato.", code="already_withdrawn")
    amount = sub.amount_cents or price_cents_for(settings, sub.price_key)
    currency = sub.currency or "eur"
    refund_id = None
    if sub.latest_payment_intent_id:
        refund_id = await gateway.refund_payment_intent(sub.latest_payment_intent_id, idempotency_key=f"withdraw-{sub.id}")
    else:
        log.warning("withdraw_without_payment_intent", subscription_id=str(sub.id))
    await gateway.cancel_subscription(sub.stripe_subscription_id)
    sub.status = "canceled"
    sub.ended_at = now
    await ent_service.revoke(db, user.id)
    w = Withdrawal(user_id=user.id, subscription_id=sub.id, requested_at=now, refund_id=refund_id, amount_cents=amount, currency=currency)
    db.add(w)
    await events.record(db, user.id, "withdrawn", {"price": sub.price_key, "amount_cents": amount})
    subject = "Recesso registrato"
    await mailer.send(
        OutgoingEmail(
            to=user.email,
            subject=subject,
            text=(
                f"Recesso registrato il {now.strftime('%d/%m/%Y')}. Rimborso di {amount / 100:.2f} {currency.upper()} in arrivo sulla carta "
                "(di solito entro 5-10 giorni lavorativi). Il piano torna Base: il primo blocco e la seduta restano tuoi.\n\n"
                "Questa email vale come conferma su supporto durevole (Dir. 2023/2673)."
            ),
            kind="withdrawal_confirmation",
            meta={"withdrawal_id": str(w.id)},
        )
    )
    db.add(EmailLog(user_id=user.id, to_email=user.email, kind="withdrawal_confirmation", subject=subject))
    await db.commit()
    return w
