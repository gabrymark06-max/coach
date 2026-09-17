from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from app.deps import DbDep, UserDep
from app.ratelimit import limiter
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.services import account as svc

router = APIRouter(tags=["account"])


class ExportOut(BaseModel):
    download_url: str
    expires_at: datetime


@router.post("/me/export", response_model=ExportOut, status_code=status.HTTP_202_ACCEPTED, responses=ERROR_RESPONSES, summary="Scarica i miei dati (JSON): prepara il file, vale 24 ore")
async def export(db: DbDep, user: UserDep) -> ExportOut:
    token, expires = await svc.create_export(db, user)
    return ExportOut(download_url=f"/me/export/{token}", expires_at=expires)


@router.get("/me/export/{token}", responses={200: {"description": "Il JSON con tutti i dati dell'utente", "content": {"application/json": {}}}, 404: {"model": ErrorOut}, **ERROR_RESPONSES}, summary="Il file esportato (solo l'utente che l'ha chiesto)")
async def download(token: str, db: DbDep, user: UserDep) -> dict:
    return await svc.read_export(db, user, token)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, responses=ERROR_RESPONSES, summary="Cancella l'account e tutti i dati (irreversibile)")
async def delete_me(db: DbDep, user: UserDep) -> Response:
    await svc.delete_account(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
