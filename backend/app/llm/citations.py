"""Validatore citazioni: l'LLM può citare SOLO id presenti nei chunk recuperati in questo turno.

Non è una speranza: è un controllo su stringhe. `[[cit:ID]]` -> `[[n]]` (nota) se ID recuperato e con rule_id;
altrimenti il marcatore sparisce e, se non resta nessuna fonte valida, lo diciamo.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.llm.retrieval import RetrievedChunk
from app.services.notes import NoteBook

_CIT = re.compile(r"\s*\[\[cit:([A-Za-z0-9_.\-]+)\]\]")
NO_SOURCE_IT = "Non ho una fonte verificata su questo: prendilo come esperienza, non come studio."


@dataclass
class ValidationResult:
    text: str
    removed: list[str] = field(default_factory=list)
    kept: list[str] = field(default_factory=list)


def validate_citations(text: str, retrieved: dict[str, RetrievedChunk], nb: NoteBook) -> ValidationResult:
    result = ValidationResult(text="")

    def repl(m: re.Match) -> str:
        cid = m.group(1)
        chunk = retrieved.get(cid)
        if chunk is None:
            result.removed.append(cid)
            return ""
        result.kept.append(cid)
        if chunk.rule_ids:
            n = nb.n(chunk.rule_ids[0])
            return f"[[{n}]]" if n else ""
        return ""

    out = _CIT.sub(repl, text)
    out = re.sub(r"\s+([.,;:!?])", r"\1", out).strip()
    if result.removed and not result.kept:
        out = (out + " " if out else "") + NO_SOURCE_IT
    result.text = out
    return result
