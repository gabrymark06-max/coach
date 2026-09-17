"""GET /me: lo stato dell'utente in una chiamata (design-system §9.2)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import today_local
from app.config import Settings
from app.models import Mesocycle, Profile, Subscription, User
from app.schemas.auth import UserOut
from app.schemas.me import (
    ChatQuotaOut,
    EntitlementOut,
    HealthConsentOut,
    MeOut,
    MesocycleBrief,
    PwaOut,
    SubscriptionOut,
)
from app.services import entitlements as ent_service
from app.services import quota as quota_service


async def latest_mesocycle(db: AsyncSession, user_id) -> Mesocycle | None:
    q = select(Mesocycle).where(Mesocycle.user_id == user_id).order_by(Mesocycle.index.desc()).limit(1)
    return (await db.execute(q)).scalar_one_or_none()


def current_week_n(meso: Mesocycle, today) -> int:
    days = (today - meso.started_on).days
    if days < 0:
        return 1
    if meso.status == "maintenance":
        return meso.total_weeks
    return min(meso.total_weeks, days // 7 + 1)


async def active_subscription(db: AsyncSession, user_id) -> Subscription | None:
    q = (
        select(Subscription)
        .where(Subscription.user_id == user_id, Subscription.status.in_(("active", "past_due", "trialing", "unpaid")))
        .order_by(Subscription.started_at.desc())
        .limit(1)
    )
    return (await db.execute(q)).scalar_one_or_none()


def withdrawal_eligible_until(sub: Subscription | None, settings: Settings, now: datetime) -> datetime | None:
    if sub is None or sub.status not in ("active", "past_due", "trialing"):
        return None
    until = sub.started_at + timedelta(days=settings.withdrawal_days)
    return until if until > now else None


async def build_me(db: AsyncSession, settings: Settings, user: User) -> MeOut:
    now = datetime.now(UTC)
    ent = await ent_service.get_entitlement(db, user)
    meso = await latest_mesocycle(db, user.id)
    pro = ent_service.is_pro(ent, now)
    quota = await quota_service.get_quota(db, settings, user, pro, now)
    profile = await db.get(Profile, user.id)
    sub = await active_subscription(db, user.id)
    today = today_local(settings.timezone, now)
    return MeOut(
        user=UserOut(id=user.id, email=user.email, email_verified=user.email_verified),
        entitlement=EntitlementOut(
            plan=ent.plan, source=ent.source, valid_until=ent.valid_until, grace_until=ent.grace_until
        ),
        engine_active=ent_service.engine_active(ent, meso, now),
        chat_quota=ChatQuotaOut(
            used=quota.used,
            limit=quota.limit,
            resets_at=quota.resets_at,
            daily_used=quota.daily_used,
            daily_limit=quota.daily_limit,
        ),
        mesocycle=(
            MesocycleBrief(
                index=meso.index, week=current_week_n(meso, today), total_weeks=meso.total_weeks, status=meso.status
            )
            if meso
            else None
        ),
        subscription=(
            SubscriptionOut(
                interval="month" if sub.price_key == "month" else "year",
                price_key=sub.price_key,
                status=sub.status,
                started_at=sub.started_at,
                renews_at=None if sub.cancel_at_period_end else sub.current_period_end,
                cancel_at_period_end=sub.cancel_at_period_end,
            )
            if sub
            else None
        ),
        withdrawal_eligible_until=withdrawal_eligible_until(sub, settings, now),
        health_consent=HealthConsentOut(
            given=bool(profile and profile.health_consent_given),
            given_at=profile.health_consent_at if profile else None,
        ),
        onboarding_completed=bool(profile and profile.onboarding_completed_at),
        support_email=settings.support_email,
        pwa=PwaOut(installed_reported=user.pwa_installed_reported),
    )
