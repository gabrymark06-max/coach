from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.auth import UserOut


class EntitlementOut(BaseModel):
    plan: Literal["free", "pro"]
    source: Literal["stripe", "promo", "manual", "none"]
    valid_until: datetime | None
    grace_until: datetime | None


class ChatQuotaOut(BaseModel):
    used: int
    limit: int
    resets_at: datetime
    daily_used: int | None = None
    daily_limit: int | None = None


class MesocycleBrief(BaseModel):
    index: int
    week: int
    total_weeks: int
    status: Literal["active", "maintenance", "completed"]


class SubscriptionOut(BaseModel):
    interval: Literal["month", "year"]
    price_key: Literal["month", "year", "year_founders"]
    status: str
    started_at: datetime
    renews_at: datetime | None
    cancel_at_period_end: bool


class HealthConsentOut(BaseModel):
    given: bool
    given_at: datetime | None


class PwaOut(BaseModel):
    installed_reported: bool


class MeOut(BaseModel):
    """design-system §9.2."""

    user: UserOut
    entitlement: EntitlementOut
    engine_active: bool
    chat_quota: ChatQuotaOut
    mesocycle: MesocycleBrief | None
    subscription: SubscriptionOut | None
    withdrawal_eligible_until: datetime | None
    health_consent: HealthConsentOut
    onboarding_completed: bool
    support_email: str
    pwa: PwaOut
