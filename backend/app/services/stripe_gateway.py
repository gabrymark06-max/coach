"""Il confine con Stripe. Tutto ciò che parla con l'API sta qui, dietro un'interfaccia sostituibile nei test."""

from __future__ import annotations

from typing import Any, Protocol

import stripe
import structlog

from app.config import Settings
from app.errors import ApiError

log = structlog.get_logger()


class StripeGateway(Protocol):
    async def create_customer(self, email: str, user_id: str) -> str: ...
    async def create_checkout(self, *, customer_id: str, price_id: str, success_url: str, cancel_url: str, user_id: str, promotion_code: str | None = None) -> str: ...
    async def create_portal(self, *, customer_id: str, return_url: str, flow: str | None = None) -> str: ...
    async def cancel_subscription(self, subscription_id: str) -> None: ...
    async def refund_payment_intent(self, payment_intent_id: str, *, idempotency_key: str) -> str: ...
    async def promotion_code_redemptions(self, code_id: str) -> int: ...
    def construct_event(self, payload: bytes, sig_header: str) -> dict[str, Any]: ...


class RealStripe:
    def __init__(self, settings: Settings):
        self._client = stripe.StripeClient(settings.stripe_secret_key)
        self._webhook_secret = settings.stripe_webhook_secret

    async def create_customer(self, email: str, user_id: str) -> str:
        c = await self._client.v1.customers.create_async(params={"email": email, "metadata": {"user_id": user_id}})
        return c.id

    async def create_checkout(self, *, customer_id: str, price_id: str, success_url: str, cancel_url: str, user_id: str, promotion_code: str | None = None) -> str:
        params: dict[str, Any] = {
            "mode": "subscription",
            "customer": customer_id,
            "client_reference_id": user_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "automatic_tax": {"enabled": True},  # Stripe Tax: IVA inclusa (tax_behavior=inclusive sui prezzi)
            "customer_update": {"address": "auto"},
            "billing_address_collection": "required",
            "subscription_data": {"metadata": {"user_id": user_id}},  # niente trial: il primo blocco è il trial
            "locale": "it",
        }
        if promotion_code:
            params["discounts"] = [{"promotion_code": promotion_code}]
        else:
            params["allow_promotion_codes"] = True
        s = await self._client.v1.checkout.sessions.create_async(params=params)
        return s.url

    async def create_portal(self, *, customer_id: str, return_url: str, flow: str | None = None) -> str:
        params: dict[str, Any] = {"customer": customer_id, "return_url": return_url, "locale": "it"}
        if flow == "cancel":
            # il flow richiede l'id dell'abbonamento: il portale generico lo mostra comunque
            pass
        s = await self._client.v1.billing_portal.sessions.create_async(params=params)
        return s.url

    async def cancel_subscription(self, subscription_id: str) -> None:
        await self._client.v1.subscriptions.cancel_async(subscription_id, params={"prorate": False})

    async def refund_payment_intent(self, payment_intent_id: str, *, idempotency_key: str) -> str:
        r = await self._client.v1.refunds.create_async(params={"payment_intent": payment_intent_id}, options={"idempotency_key": idempotency_key})
        return r.id

    async def promotion_code_redemptions(self, code_id: str) -> int:
        if not code_id:
            return 0
        p = await self._client.v1.promotion_codes.retrieve_async(code_id)
        return int(getattr(p, "times_redeemed", 0) or 0)

    def construct_event(self, payload: bytes, sig_header: str) -> dict[str, Any]:
        ev = stripe.Webhook.construct_event(payload, sig_header, self._webhook_secret)
        return ev.to_dict_recursive() if hasattr(ev, "to_dict_recursive") else dict(ev)


class BillingUnavailable(ApiError):
    status_code = 503
    code = "billing_unavailable"


class DisabledStripe:
    """Nessuna chiave: i pagamenti non sono attivi e lo si dice (503 `billing_unavailable`), invece di chiamare Stripe
    con una chiave vuota e cadere in un 500 (QA M12). Il contatore fondatori resta vivo: la pagina prezzi non dipende
    da Stripe per esistere."""

    def __init__(self, settings: Settings):
        self._detail = f"I pagamenti non sono ancora attivi. Se ti serve Pro adesso scrivimi a {settings.support_email}."

    def _unavailable(self) -> BillingUnavailable:
        return BillingUnavailable(self._detail)

    async def create_customer(self, email: str, user_id: str) -> str:
        raise self._unavailable()

    async def create_checkout(self, *, customer_id: str, price_id: str, success_url: str, cancel_url: str, user_id: str, promotion_code: str | None = None) -> str:
        raise self._unavailable()

    async def create_portal(self, *, customer_id: str, return_url: str, flow: str | None = None) -> str:
        raise self._unavailable()

    async def cancel_subscription(self, subscription_id: str) -> None:
        raise self._unavailable()

    async def refund_payment_intent(self, payment_intent_id: str, *, idempotency_key: str) -> str:
        raise self._unavailable()

    async def promotion_code_redemptions(self, code_id: str) -> int:
        return 0

    def construct_event(self, payload: bytes, sig_header: str) -> dict[str, Any]:
        raise self._unavailable()


def build_stripe(settings: Settings) -> StripeGateway:
    if not settings.stripe_secret_key:
        log.warning("stripe_disabled", reason="STRIPE_SECRET_KEY vuota: /billing risponde 503 billing_unavailable")
        return DisabledStripe(settings)
    return RealStripe(settings)
