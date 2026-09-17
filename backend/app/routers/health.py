"""Health check per la piattaforma di hosting (Render) e per il monitoraggio.

- `GET /health`: liveness. 200 se il processo risponde. Non tocca il database: è la rotta che Render batte ogni
  pochi secondi e che un uptime monitor può pingare per tenere sveglio il piano free; se toccasse il DB terrebbe
  sempre acceso anche il compute di Neon (100 CU-ore/mese sul free, scale-to-zero dopo 5 min).
- `GET /health/db`: readiness. 200 se `SELECT 1` risponde, altrimenti 503 `db_unavailable` con lo stesso formato
  di errore di tutto il resto. Da chiamare a mano o con un monitor a bassa frequenza (ogni 10-15 minuti).

Nessuna delle due è nel contratto del frontend (docs/api-contract.md), nessuna richiede auth, nessuna porta dati.
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
    version: str


class HealthDbOut(HealthOut):
    db: str


@router.get("/health", response_model=HealthOut, summary="Liveness: il processo risponde (per l'hosting)", include_in_schema=False)
@limiter.exempt
async def health(request: Request) -> HealthOut:
    return HealthOut(status="ok", version=request.app.version)


@router.get(
    "/health/db",
    response_model=HealthDbOut,
    responses={503: {"description": "Database non raggiungibile"}},
    summary="Readiness: il database risponde a SELECT 1",
    include_in_schema=False,
)
@limiter.exempt
async def health_db(request: Request) -> HealthDbOut | JSONResponse:
    version = request.app.version
    try:
        async with get_sessionmaker()() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": "db_unavailable", "detail": "Il database non risponde. Riprova tra un minuto.", "version": version},
        )
    return HealthDbOut(status="ok", db="ok", version=version)
