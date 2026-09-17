from __future__ import annotations

import uuid

from fastapi import APIRouter, Header, Query, Response, status

from app.deps import DbDep, UserDep
from app.engine import ReadinessInput
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.schemas.plans import (
    ClientOp,
    CloseIn,
    CloseOut,
    ReadinessIn,
    ReadinessOut,
    SessionExerciseOut,
    SessionOut,
    SetAddIn,
    SetOut,
    SetPatchIn,
    SubstituteIn,
    SyncIn,
    SyncOut,
)
from app.services import sessions as svc

router = APIRouter(prefix="/sessions", tags=["sessions"])

_CLOSED = {409: {"model": ErrorOut, "description": "`session_closed`: la seduta è chiusa, la progressione è già calcolata"}}
_404 = {404: {"model": ErrorOut, "description": "`not_found` (anche se la seduta è di un altro utente)"}}


def _etag(out: SessionOut) -> str:
    return f'W/"{out.updated_at.isoformat()}"'


@router.get(
    "/{session_id}",
    response_model=SessionOut,
    responses={304: {"description": "Non modificata (If-None-Match)"}, **_404, **ERROR_RESPONSES},
    summary="La seduta con note inline. Risponde con ETag = updated_at per la bozza offline.",
)
async def get_session(session_id: uuid.UUID, response: Response, db: DbDep, user: UserDep, if_none_match: str | None = Header(default=None)):
    s = await svc.load_session(db, user.id, session_id)
    out = await svc.build_session_out(db, user, s)
    tag = _etag(out)
    if if_none_match and if_none_match.strip() == tag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": tag})
    response.headers["ETag"] = tag
    return out


@router.post("/{session_id}/readiness", response_model=ReadinessOut, responses={409: {"model": ErrorOut, "description": "`readiness_already_done` · `session_closed`"}, **_404, **ERROR_RESPONSES}, summary="Tre risposte: il motore adatta oggi e lo dice")
async def readiness(session_id: uuid.UUID, body: ReadinessIn, db: DbDep, user: UserDep) -> ReadinessOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.apply_readiness(db, user, s, ReadinessInput(sleep=body.sleep, mood=body.mood, pain=body.pain))
    await db.commit()
    return out


@router.post(
    "/{session_id}/short",
    response_model=ReadinessOut,
    responses={409: {"model": ErrorOut, "description": "`already_short` · `session_closed`"}, **_404, **ERROR_RESPONSES},
    summary="v1.1 — Versione corta dall'anteprima di Oggi, senza questionario: stesso motore e stesso diff della readiness. `safety` è sempre null.",
)
async def short(session_id: uuid.UUID, db: DbDep, user: UserDep) -> ReadinessOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.apply_short(db, user, s)
    await db.commit()
    return out


@router.post("/{session_id}/readiness/restore/{exercise_id}", response_model=SessionOut, responses={409: {"model": ErrorOut, "description": "`not_removed` · `session_closed`"}, **_404, **ERROR_RESPONSES}, summary="Rimettilo: l'esercizio tolto oggi torna con le serie originali")
async def readiness_restore(session_id: uuid.UUID, exercise_id: str, db: DbDep, user: UserDep) -> SessionOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.restore_removed(db, user, s, exercise_id)
    await db.commit()
    return out


@router.patch("/{session_id}/sets/{set_id}", response_model=SetOut, responses={**_CLOSED, **_404, **ERROR_RESPONSES}, summary="Logga una serie. Idempotente per client_op_id; last-write-wins per client_updated_at.")
async def patch_set(session_id: uuid.UUID, set_id: uuid.UUID, body: SetPatchIn, db: DbDep, user: UserDep) -> SetOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.patch_set(db, user, s, set_id, body)
    await db.commit()
    return out


@router.post("/{session_id}/sets", response_model=SetOut, status_code=status.HTTP_201_CREATED, responses={**_CLOSED, **_404, **ERROR_RESPONSES}, summary="Aggiungi una serie in coda a un esercizio")
async def add_set(session_id: uuid.UUID, body: SetAddIn, db: DbDep, user: UserDep) -> SetOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.add_set(db, user, s, body.exercise_id, body.client_op_id, body.client_updated_at)
    await db.commit()
    return out


@router.delete("/{session_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT, responses={409: {"model": ErrorOut, "description": "`not_last_set` · `min_sets` · `session_closed`"}, **_404, **ERROR_RESPONSES}, summary="Togli l'ultima serie di un esercizio")
async def delete_set(session_id: uuid.UUID, set_id: uuid.UUID, db: DbDep, user: UserDep, client_op_id: str = Query(min_length=1, max_length=64)) -> Response:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    await svc.delete_set(db, user, s, set_id, client_op_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{session_id}/exercises/{exercise_id}/substitute", response_model=SessionExerciseOut, responses={422: {"model": ErrorOut, "description": "`invalid_substitute`"}, **_CLOSED, **_404, **ERROR_RESPONSES}, summary="Sostituisci con uno dei `substitutes` (stesso schema di movimento)")
async def substitute(session_id: uuid.UUID, exercise_id: uuid.UUID, body: SubstituteIn, db: DbDep, user: UserDep) -> SessionExerciseOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.substitute(db, user, s, exercise_id, body.exercise_id, body.client_op_id, body.client_updated_at)
    await db.commit()
    return out


@router.post("/{session_id}/exercises/{exercise_id}/skip", response_model=SessionExerciseOut, responses={**_CLOSED, **_404, **ERROR_RESPONSES})
async def skip(session_id: uuid.UUID, exercise_id: uuid.UUID, body: ClientOp, db: DbDep, user: UserDep) -> SessionExerciseOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.skip_exercise(db, user, s, exercise_id, body.client_op_id, body.client_updated_at, skipped=True)
    await db.commit()
    return out


@router.post("/{session_id}/exercises/{exercise_id}/restore", response_model=SessionExerciseOut, responses={**_CLOSED, **_404, **ERROR_RESPONSES})
async def restore(session_id: uuid.UUID, exercise_id: uuid.UUID, body: ClientOp, db: DbDep, user: UserDep) -> SessionExerciseOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    out = await svc.skip_exercise(db, user, s, exercise_id, body.client_op_id, body.client_updated_at, skipped=False)
    await db.commit()
    return out


@router.post(
    "/{session_id}/close",
    response_model=CloseOut,
    responses={409: {"model": ErrorOut, "description": "`draft_conflict` (con `server_session`) · `session_closed`"}, **_404, **ERROR_RESPONSES},
    summary="Chiudi con la bozza intera: merge per set, progressione sulla prossima seduta uguale",
)
async def close(session_id: uuid.UUID, body: CloseIn, db: DbDep, user: UserDep) -> CloseOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    line, out, nb = await svc.close_session(db, user, s, body)
    await db.commit()
    return CloseOut(close_line=line, notes=nb.notes(), session=out)


@router.post("/{session_id}/sync", response_model=SyncOut, responses={**_404, **ERROR_RESPONSES}, summary="Batch delle operazioni in coda (ritorno della rete). Ogni op è idempotente; su una seduta chiusa ogni op nuova è `{status:\"error\", code:\"session_closed\"}` e il batch resta 200.")
async def sync(session_id: uuid.UUID, body: SyncIn, db: DbDep, user: UserDep) -> SyncOut:
    s = await svc.load_session(db, user.id, session_id, for_update=True)
    results = await svc.sync(db, user, s, body.ops)
    await db.commit()
    s = await svc.load_session(db, user.id, session_id)
    return SyncOut(results=results, session=await svc.build_session_out(db, user, s))
