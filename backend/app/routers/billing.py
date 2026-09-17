from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from app.deps import DbDep, MailerDep, SettingsDep, UserDep
from app.ratelimit import limiter
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.services import billing as svc

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutIn(BaseModel):
    price: Literal["month", "year", "year_founders"]
    from_surface: Literal["end_of_block", "chat_quota", "maintenance_request", "pricing", "account"] = "pricing"


class UrlOut(BaseModel):
    url: str


class PortalIn(BaseModel):
    intent: Literal["cancel", "update_payment", "switch_plan"] | None = None


class WithdrawOut(BaseModel):
    withdrawn_at: datetime
    refund_amount: float = Field(description="Importo lordo IVA inclusa, in unità (es. 9.99)")
    refund_currency: str


class FoundersOut(BaseModel):
    remaining: int
    price_eur: float = Field(description="Annuale fondatori, IVA inclusa (es. 49.99). Stesso valore di /billing/prices")


class PriceOut(BaseModel):
    key: Literal["month", "year", "year_founders"] = Field(description="Lo stesso `price` che si manda a POST /billing/checkout")
    interval: Literal["month", "year"]
    amount_cents: int = Field(description="Importo IVA inclusa in centesimi (es. 999)")
    amount_eur: float = Field(description="Importo IVA inclusa in unità (es. 9.99)")
    per_month_eur: float = Field(description="Equivalente mensile (annuale / 12), per il confronto in pagina")
    label_it: str
    available: bool = Field(description="False solo per `year_founders` quando i 100 posti sono finiti")


class FoundersStatusOut(BaseModel):
    available: bool
    remaining: int


class PricesOut(BaseModel):
    currency: Literal["EUR"]
    vat_included: Literal[True]
    prices: list[PriceOut] = Field(description="Sempre nell'ordine month, year, year_founders")
    founders: FoundersStatusOut


class WebhookOut(BaseModel):
    received: bool
    duplicate: bool


_UNAVAILABLE = {503: {"model": ErrorOut, "description": "`billing_unavailable`: Stripe non è configurato (nessuna chiave)"}}


def _gateway(request: Request):
    return request.app.state.stripe


@router.post("/checkout", response_model=UrlOut, responses={409: {"model": ErrorOut, "description": "`founders_sold_out`"}, **_UNAVAILABLE, **ERROR_RESPONSES}, summary="Stripe Checkout (hosted), senza trial. Prezzi IVA inclusa da env.")
@limiter.limit("10/minute")
async def checkout(request: Request, body: CheckoutIn, db: DbDep, settings: SettingsDep, user: UserDep) -> UrlOut:
    return UrlOut(url=await svc.checkout(db, settings, _gateway(request), user, body.price, body.from_surface))


@router.post("/portal", response_model=UrlOut, responses={409: {"model": ErrorOut, "description": "`no_subscription`"}, **_UNAVAILABLE, **ERROR_RESPONSES}, summary="Customer Portal: carta, mensile<->annuale, disdetta a fine periodo, ricevute")
async def portal(request: Request, body: PortalIn, db: DbDep, settings: SettingsDep, user: UserDep) -> UrlOut:
    return UrlOut(url=await svc.portal(db, settings, _gateway(request), user, body.intent))


@router.post(
    "/withdraw",
    response_model=WithdrawOut,
    responses={403: {"model": ErrorOut, "description": "`withdrawal_window_closed`"}, 409: {"model": ErrorOut, "description": "`no_subscription` · `already_withdrawn`"}, **_UNAVAILABLE, **ERROR_RESPONSES},
    summary="Recedi dal contratto qui: entro 14 giorni, cancella subito e rimborsa per intero (Dir. 2023/2673)",
)
async def withdraw(request: Request, db: DbDep, settings: SettingsDep, mailer: MailerDep, user: UserDep) -> WithdrawOut:
    w = await svc.withdraw(db, settings, _gateway(request), mailer, user)
    return WithdrawOut(withdrawn_at=w.requested_at, refund_amount=round(w.amount_cents / 100, 2), refund_currency=w.currency)


@router.get("/founders", response_model=FoundersOut, summary="Contatore fondatori (cache 60 s lato client)")
async def founders(request: Request, settings: SettingsDep) -> FoundersOut:
    return FoundersOut(remaining=await svc.founders_remaining(settings, _gateway(request)), price_eur=round(svc.price_cents_for(settings, "year_founders") / 100, 2))


@router.get("/prices", response_model=PricesOut, summary="Listino Pro (pubblico): le tre opzioni da env, IVA inclusa; vivo anche senza Stripe")
async def prices(request: Request, settings: SettingsDep) -> PricesOut:
    return PricesOut.model_validate(await svc.price_catalog(settings, _gateway(request)))


@router.post("/webhook", response_model=WebhookOut, responses={400: {"model": ErrorOut, "description": "`invalid_signature`"}, **_UNAVAILABLE}, summary="Webhook Stripe: firma verificata, idempotente per event id", include_in_schema=True)
async def webhook(request: Request, db: DbDep, settings: SettingsDep, stripe_signature: str | None = Header(default=None)) -> WebhookOut:
    payload = await request.body()
    out = await svc.handle_webhook(db, settings, _gateway(request), payload, stripe_signature)
    return WebhookOut(**out)
