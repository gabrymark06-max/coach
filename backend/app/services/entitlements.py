"""Un solo predicato letto ovunque: is_pro(entitlement, now)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Entitlement, Mesocycle, User


def is_pro(ent: Entitlement | None, now: datetime | None = None) -> bool:
    if ent is None or ent.plan != "pro":
        return False
    now = now or datetime.now(UTC)
    if ent.valid_until is None or ent.valid_until > now:
        return True
    return ent.grace_until is not None and ent.grace_until > now


def engine_active(ent: Entitlement | None, mesocycle: Mesocycle | None, now: datetime | None = None) -> bool:
    """Regola di dominio (business-model §10): engine_active = is_pro OR mesocycle.index == 1."""
    if is_pro(ent, now):
        return True
    if mesocycle is None:
        return True  # nessun blocco ancora: il primo è sempre libero
    return mesocycle.index == 1 and mesocycle.status == "active"


async def get_entitlement(db: AsyncSession, user: User) -> Entitlement:
    ent = await db.get(Entitlement, user.id)
    if ent is None:
        ent = Entitlement(user_id=user.id, plan="free", source="none")
        db.add(ent)
        await db.flush()
    return ent


async def grant(
    db: AsyncSession, user_id, *, source: str, valid_until: datetime | None, grace_until: datetime | None = None
) -> Entitlement:
    ent = await db.get(Entitlement, user_id)
    if ent is None:
        ent = Entitlement(user_id=user_id)
        db.add(ent)
    ent.plan = "pro"
    ent.source = source
    ent.valid_until = valid_until
    ent.grace_until = grace_until
    await db.flush()
    return ent


async def revoke(db: AsyncSession, user_id) -> Entitlement:
    ent = await db.get(Entitlement, user_id)
    if ent is None:
        ent = Entitlement(user_id=user_id)
        db.add(ent)
    ent.plan = "free"
    ent.source = "none"
    ent.valid_until = None
    ent.grace_until = None
    await db.flush()
    return ent
