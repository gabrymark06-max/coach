"""Health check per la piattaforma di hosting (Render/Railway) e per il monitoraggio.

`GET /health` risponde 200 solo se il processo è su e il database risponde a `SELECT 1`: se il DB non c'è,
503 `db_unavailable` con lo stesso formato di errore di tutto il resto. Non è nel contratto del frontend
(docs/api-contract.md) e non richiede auth: è pubblico per costruzione, non porta dati.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.db import get_sessionmaker
from app.ratelimit import limiter

router = APIRouter(tags=["health"])


class HealthOut(BaseModel):
    status: str
    db: str
    version: str


@router.get(
    "/health",
    response_model=HealthOut,
    responses={503: {"description": "Database non raggiungibile"}},
    summary="Stato del processo e del database (per l'hosting)",
    include_in_schema=False,
)
@limiter.exempt
async def health(request: Request) -> HealthOut | JSONResponse:
    version = request.app.version
    try:
        async with get_sessionmaker()() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": "db_unavailable", "detail": "Il database non risponde. Riprova tra un minuto.", "version": version},
        )
    return HealthOut(status="ok", db="ok", version=version)
