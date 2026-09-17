"""Regole ed esercizi: pubblici in lettura (servono a landing, crediti e alle note della UI)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import DbDep
from app.models import Exercise
from app.schemas.common import Note
from app.services.notes import KnowledgeIndex, NoteBook

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class MediaOut(BaseModel):
    gif_url: str | None
    poster_url: str | None
    attribution: str | None


class ExerciseOut(BaseModel):
    exercise_id: str
    name_it: str
    name_en: str
    pattern: str
    primary_muscle: str
    secondary_muscles: list[str]
    equipment: str
    mechanic: str
    instructions_it: list[str]
    media: MediaOut


@router.get("/rules", response_model=list[Note], summary="Tutte le regole come Note (n = posizione nell'elenco)")
async def list_rules(db: DbDep) -> list[Note]:
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    for rid in sorted(index.rules):
        nb.n(rid)
    return nb.notes()


@router.get("/rules/{rule_id}", response_model=Note, responses={404: {"description": "`not_found`"}})
async def get_rule(rule_id: str, db: DbDep) -> Note:
    from app.errors import NotFound

    index = await KnowledgeIndex.load(db)
    if rule_id not in index.rules:
        raise NotFound("Questa nota non è disponibile adesso. Riprova tra poco.")
    nb = NoteBook(index)
    nb.n(rule_id)
    return nb.notes()[0]


@router.get("/exercises", response_model=list[ExerciseOut], summary="Repertorio esercizi con istruzioni in italiano")
async def list_exercises(db: DbDep) -> list[ExerciseOut]:
    rows = (await db.execute(select(Exercise).order_by(Exercise.pattern, Exercise.id))).scalars().all()
    return [
        ExerciseOut(
            exercise_id=e.id,
            name_it=e.name_it,
            name_en=e.name_en,
            pattern=e.pattern,
            primary_muscle=e.primary_muscle,
            secondary_muscles=list(e.secondary_muscles or []),
            equipment=e.equipment,
            mechanic=e.mechanic,
            instructions_it=list(e.instructions_it or []),
            media=MediaOut(gif_url=e.gif_url, poster_url=e.poster_url, attribution=e.attribution),
        )
        for e in rows
    ]
