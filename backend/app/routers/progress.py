from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from app.deps import DbDep, SettingsDep, UserDep
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.schemas.plans import ConsistencyOut, ProgressExerciseOut, ProgressHistoryOut
from app.services import entitlements as ent_service
from app.services import progress as svc

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/consistency", response_model=ConsistencyOut, responses=ERROR_RESPONSES, summary="Sedute fatte e ritorni, mai giorni di fila")
async def consistency(db: DbDep, settings: SettingsDep, user: UserDep, weeks: int = Query(default=4, ge=1, le=52)) -> ConsistencyOut:
    ent = await ent_service.get_entitlement(db, user)
    return await svc.consistency(db, settings, user, weeks=weeks, pro=ent_service.is_pro(ent))


@router.get("/exercises", response_model=list[ProgressExerciseOut], responses=ERROR_RESPONSES)
async def exercises(db: DbDep, user: UserDep) -> list[ProgressExerciseOut]:
    return await svc.exercises_overview(db, user)


@router.get("/exercises/{exercise_id}", response_model=ProgressHistoryOut, responses={404: {"model": ErrorOut}, **ERROR_RESPONSES}, summary="In free `since` è forzato a -8 settimane e `history_limited` è true")
async def history(exercise_id: str, db: DbDep, settings: SettingsDep, user: UserDep, since: date | None = None) -> ProgressHistoryOut:
    ent = await ent_service.get_entitlement(db, user)
    return await svc.exercise_history(db, settings, user, exercise_id, since=since, pro=ent_service.is_pro(ent))
