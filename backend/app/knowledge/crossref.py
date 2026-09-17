"""Validatore DOI via Crossref (polite pool con mailto, 10 req/s — verifica.md #9).

Nessuna citazione entra nel DB senza passare di qui: cinque DOI "a memoria" erano sbagliati.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

CROSSREF_URL = "https://api.crossref.org/works/{doi}"
MIN_INTERVAL_S = 0.12  # sotto le 10 req/s del polite pool


class CitationVerificationError(Exception):
    pass


@dataclass(frozen=True)
class VerifiedCitation:
    doi: str
    verified_title: str
    verified_year: int | None
    verified_at: datetime
    via: str = "crossref"


class Verifier(Protocol):
    async def verify(self, doi: str, expected_title: str, expected_year: int) -> VerifiedCitation: ...


_WORD = re.compile(r"[a-z0-9]+")


def _tokens(s: str) -> set[str]:
    return {t for t in _WORD.findall(s.lower()) if len(t) > 2}


def titles_match(expected: str, actual: str) -> bool:
    a, b = _tokens(expected), _tokens(actual)
    if not a or not b:
        return False
    inter = len(a & b)
    return inter / len(a) >= 0.75 and inter / len(b) >= 0.5


def _year(msg: dict) -> int | None:
    for key in ("published-print", "published-online", "issued", "created"):
        parts = (msg.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            return int(parts[0][0])
    return None


def _years(msg: dict) -> set[int]:
    out: set[int] = set()
    for key in ("published-print", "published-online", "issued", "created"):
        parts = (msg.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            out.add(int(parts[0][0]))
    return out


class CrossrefVerifier:
    def __init__(self, mailto: str, *, transport: httpx.AsyncBaseTransport | None = None, timeout: float = 20.0):
        if not mailto:
            raise ValueError("CROSSREF_MAILTO obbligatorio: il polite pool lo richiede")
        self._mailto = mailto
        self._transport = transport
        self._timeout = timeout
        self._last = 0.0

    async def _throttle(self) -> None:
        loop = asyncio.get_running_loop()
        now = loop.time()
        wait = self._last + MIN_INTERVAL_S - now
        if wait > 0:
            await asyncio.sleep(wait)
        self._last = loop.time()

    async def verify(self, doi: str, expected_title: str, expected_year: int) -> VerifiedCitation:
        await self._throttle()
        headers = {"User-Agent": f"fitcoach/1.0 (mailto:{self._mailto})"}
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=self._timeout, headers=headers) as client:
                r = await client.get(CROSSREF_URL.format(doi=doi), params={"mailto": self._mailto})
        except httpx.HTTPError as e:
            raise CitationVerificationError(f"{doi}: rete non disponibile o Crossref irraggiungibile ({e.__class__.__name__})") from e
        if r.status_code == 404:
            raise CitationVerificationError(f"{doi}: il DOI non risolve su Crossref (404)")
        if r.status_code != 200:
            raise CitationVerificationError(f"{doi}: Crossref ha risposto {r.status_code}")
        msg = (r.json() or {}).get("message") or {}
        titles = msg.get("title") or []
        actual = titles[0] if titles else ""
        if not titles_match(expected_title, actual):
            raise CitationVerificationError(f"{doi}: il titolo non coincide. Atteso: {expected_title!r}; Crossref: {actual!r}")
        years = _years(msg)
        if years and not any(abs(y - expected_year) <= 1 for y in years):
            raise CitationVerificationError(f"{doi}: anno non coerente. Atteso {expected_year}, Crossref {sorted(years)}")
        return VerifiedCitation(doi=doi, verified_title=actual, verified_year=_year(msg), verified_at=datetime.now(UTC))
