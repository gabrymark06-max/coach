"""Date in italiano per i testi del coach: "giovedì 24 settembre"."""

from __future__ import annotations

from datetime import date

DAY_NAMES = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def human_date(d: date) -> str:
    return f"{DAY_NAMES[d.weekday()]} {d.day} {MONTHS[d.month - 1]}"
