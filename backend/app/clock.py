"""L'unico posto in cui si decide che giorno è.

"Oggi" per il piano è la data nel fuso dell'utente (Settings.timezone, default Europe/Rome), non la data UTC:
alle 23:30 a Roma il backend è già a domani in UTC, e la seduta di oggi sparirebbe. Ogni servizio che confronta
`PlannedSession.date` con "oggi" passa da qui. Gli istanti (`created_at`, `closed_at`, token) restano UTC.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    """Istante corrente, UTC e aware. Punto unico da sostituire nei test."""
    return datetime.now(UTC)


def _tz(tz_name: str | None) -> ZoneInfo:
    if tz_name is None:
        from app.config import get_settings

        tz_name = get_settings().timezone
    return ZoneInfo(tz_name)


def local_date(now: datetime, tz_name: str | None = None) -> date:
    """La data di calendario di un istante nel fuso dell'app."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    return now.astimezone(_tz(tz_name)).date()


def today_local(tz_name: str | None = None, now: datetime | None = None) -> date:
    """Oggi nel fuso dell'app. `now` serve ai job e ai test che ragionano su un istante preciso."""
    return local_date(now or utcnow(), tz_name)
