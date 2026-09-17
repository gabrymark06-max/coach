"""Quota chat: turni utente per mese solare Europe/Rome. Contano solo i user_turn andati a buon fine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import ChatMessage, User


@dataclass
class ChatQuota:
    used: int
    limit: int
    resets_at: datetime
    daily_used: int | None
    daily_limit: int | None

    @property
    def exhausted(self) -> bool:
        if self.used >= self.limit:
            return True
        return self.daily_limit is not None and self.daily_used is not None and self.daily_used >= self.daily_limit

    @property
    def left(self) -> int:
        return max(0, self.limit - self.used)


def month_window(now: datetime, tz_name: str) -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    local = now.astimezone(tz)
    start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    nxt = (start + timedelta(days=32)).replace(day=1)
    return start.astimezone(UTC), nxt.astimezone(UTC)


def day_window(now: datetime, tz_name: str) -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    local = now.astimezone(tz)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


async def _count(db: AsyncSession, user_id, start: datetime, end: datetime) -> int:
    q = select(func.count(ChatMessage.id)).where(
        ChatMessage.user_id == user_id,
        ChatMessage.role == "user",
        ChatMessage.kind == "user_turn",
        ChatMessage.status == "sent",
        ChatMessage.created_at >= start,
        ChatMessage.created_at < end,
    )
    return int((await db.execute(q)).scalar_one())


async def get_quota(db: AsyncSession, settings: Settings, user: User, pro: bool, now: datetime | None = None) -> ChatQuota:
    now = now or datetime.now(UTC)
    m_start, m_end = month_window(now, settings.timezone)
    used = await _count(db, user.id, m_start, m_end)
    if pro:
        d_start, d_end = day_window(now, settings.timezone)
        daily = await _count(db, user.id, d_start, d_end)
        return ChatQuota(used, settings.chat_quota_pro_month, m_end, daily, settings.chat_quota_pro_day)
    return ChatQuota(used, settings.chat_quota_free_month, m_end, None, None)
