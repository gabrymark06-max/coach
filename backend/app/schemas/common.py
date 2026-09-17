"""Forme condivise: la Nota (elemento firma), i numeri con nota, gli errori."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CitationOut(BaseModel):
    authors: str
    year: int
    title: str
    journal: str
    doi: str
    url: str
    open_access: bool
    type: str


class Note(BaseModel):
    """design-system §9.1. Arriva inline con il numero: il frontend non fa una seconda chiamata."""

    n: int = Field(ge=1, description="Numero locale nella schermata/messaggio")
    rule_id: str
    rule_version: int
    updated_at: date
    title_it: str = Field(max_length=80)
    summary_it: str
    not_says_it: str
    grade: Literal["A", "B", "C"] | None
    grade_label_it: str
    is_own_note: bool
    rationale_it: str | None
    citations: list[CitationOut]


class IntWithNote(BaseModel):
    value: int
    unit: str | None = None
    note_n: int | None = Field(default=None, description="Se null, l'apice non si disegna")


class RangeWithNote(BaseModel):
    value: int | None = None
    range: list[int] | None = Field(default=None, min_length=2, max_length=2)
    unit: str | None = None
    note_n: int | None = None


class ErrorOut(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: str
    detail: str


class ErrorValidationOut(ErrorOut):
    errors: list[dict] = []


class ErrorQuotaOut(ErrorOut):
    resets_at: str
    used: int
    limit: int


class OkOut(BaseModel):
    ok: bool = True


ERROR_RESPONSES = {
    401: {"model": ErrorOut, "description": "Sessione assente o scaduta (`unauthorized`)"},
    422: {"model": ErrorValidationOut, "description": "Input non valido (`validation_error`)"},
    429: {"model": ErrorOut, "description": "Troppe richieste (`rate_limited`)"},
}
