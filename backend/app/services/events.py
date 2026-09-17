"""Eventi di prodotto (business-model §10): prima parte, nessuna terza parte."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductEvent

SERVER_EVENTS = {
    "onboarding_completed",
    "first_session_logged",
    "no_day_triggered",
    "no_day_option_chosen",
    "safety_triggered",
    "mesocycle_completed",
    "paywall_shown",
    "subscription_started",
    "withdrawn",
    "churned",
}
CLIENT_EVENTS = {"install_prompt_shown", "installed", "paywall_shown", "checkout_started"}


async def record(db: AsyncSession, user_id, name: str, props: dict | None = None, *, source: str = "server") -> ProductEvent:
    ev = ProductEvent(user_id=user_id, name=name, props=props or {}, source=source)
    db.add(ev)
    await db.flush()
    return ev
