"""Filtro di sicurezza: tassonomia nostra (non Bloom), match su stringhe, testo fisso. Nessun LLM, nessuna quota."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from app.services.knowledge import load_corpus


@dataclass(frozen=True)
class SafetyEntry:
    id: str
    title_it: str
    text_it: str
    options: list[dict]
    triggers: list[str]


@lru_cache
def entries() -> list[SafetyEntry]:
    corpus = load_corpus()
    return [
        SafetyEntry(id=s["id"], title_it=s["title_it"], text_it=s["text_it"].strip(), options=list(s.get("options", [])), triggers=[t.lower() for t in s.get("triggers", [])])
        for s in corpus.get("safety", [])
    ]


def match_safety(text: str) -> SafetyEntry | None:
    t = re.sub(r"\s+", " ", text.lower())
    for e in entries():
        for trig in e.triggers:
            if re.search(r"\b" + re.escape(trig) + r"\b", t):
                return e
    return None
