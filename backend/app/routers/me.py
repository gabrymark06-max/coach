from __future__ import annotations

from fastapi import APIRouter

from app.deps import DbDep, SettingsDep, UserDep
from app.schemas.common import ERROR_RESPONSES
from app.schemas.me import MeOut
from app.services.me import build_me

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeOut, responses=ERROR_RESPONSES, summary="Stato dell'utente in una chiamata")
async def me(db: DbDep, settings: SettingsDep, user: UserDep) -> MeOut:
    return await build_me(db, settings, user)
