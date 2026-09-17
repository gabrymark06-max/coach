"""Seam: app.clock.today_local — "oggi" è la data nel fuso dell'app, non la data UTC."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.clock import local_date, today_local


def test_2330_in_rome_is_still_today_even_if_utc_is_already_tomorrow_minus_one():
    rome_2330 = datetime(2026, 9, 17, 23, 30, tzinfo=ZoneInfo("Europe/Rome"))
    assert rome_2330.astimezone(UTC).date() == date(2026, 9, 17)  # 21:30Z: qui UTC e Roma coincidono ancora
    assert today_local("Europe/Rome", now=rome_2330) == date(2026, 9, 17)


def test_0030_in_rome_is_tomorrow_while_utc_is_still_yesterday():
    rome_0030 = datetime(2026, 9, 18, 0, 30, tzinfo=ZoneInfo("Europe/Rome"))
    assert rome_0030.astimezone(UTC).date() == date(2026, 9, 17)  # in UTC è ancora ieri
    assert today_local("Europe/Rome", now=rome_0030) == date(2026, 9, 18)


def test_winter_time_offset_is_respected():
    rome_2330_winter = datetime(2026, 12, 3, 23, 30, tzinfo=ZoneInfo("Europe/Rome"))  # UTC+1
    assert rome_2330_winter.astimezone(UTC) == datetime(2026, 12, 3, 22, 30, tzinfo=UTC)
    assert local_date(datetime(2026, 12, 3, 23, 30, tzinfo=UTC), "Europe/Rome") == date(2026, 12, 4)


def test_default_timezone_comes_from_settings(monkeypatch):
    from app.config import get_settings

    assert get_settings().timezone == "Europe/Rome"
    naive_utc = datetime(2026, 9, 17, 22, 30)  # naive = UTC
    assert local_date(naive_utc) == date(2026, 9, 18)
