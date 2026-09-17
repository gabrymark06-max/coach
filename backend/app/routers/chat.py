from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import datetime

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.deps import DbDep, SettingsDep, UserDep
from app.models import ChatMessage
from app.ratelimit import limiter
from app.schemas.chat import ChatMessageOut, ChatOptionIn, ChatQuotaOut, ChatSendIn, ChatTextsOut
from app.schemas.common import ERROR_RESPONSES, ErrorOut, ErrorQuotaOut
from app.services import chat as svc
from app.services import entitlements as ent_service
from app.services import quota as quota_service

router = APIRouter(prefix="/chat", tags=["chat"])


def message_out(m: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(
        id=m.id, role=m.role, kind=m.kind, at=m.created_at, status=m.status, protocol=m.protocol,
        blocks=m.blocks or [], notes=m.notes or [], reply_to_id=m.reply_to_id,
    )


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/messages", response_model=list[ChatMessageOut], responses=ERROR_RESPONSES, summary="Thread in ordine cronologico; `before` per paginare all'indietro")
async def list_messages(db: DbDep, user: UserDep, before: datetime | None = None, limit: int = Query(default=50, ge=1, le=200)) -> list[ChatMessageOut]:
    q = select(ChatMessage).where(ChatMessage.user_id == user.id)
    if before is not None:
        q = q.where(ChatMessage.created_at < before)
    rows = (await db.execute(q.order_by(ChatMessage.created_at.desc()).limit(limit))).scalars().all()
    return [message_out(m) for m in reversed(rows)]


@router.post(
    "/messages",
    responses={
        200: {"content": {"text/event-stream": {"example": 'data: {"type":"delta","text":"Ci "}\n\ndata: {"type":"block","block":{...}}\n\ndata: {"type":"done","message":{...}}\n\n'}}, "description": "Stream SSE: `delta` (testo), `block`, `done` (messaggio completo, `ChatMessageOut`), `error`."},
        429: {"model": ErrorQuotaOut, "description": "`chat_quota_exceeded` con `resets_at`, `used`, `limit`"},
        502: {"model": ErrorOut, "description": "`llm_failed`: il turno non conta nella quota"},
        **ERROR_RESPONSES,
    },
    summary="Manda un turno utente. Idempotente per client_op_id. Un turno fallito non conta.",
)
@limiter.limit("20/minute")
async def send_message(request: Request, body: ChatSendIn, db: DbDep, settings: SettingsDep, user: UserDep):
    ready, um = await svc.prepare_turn(db, settings, user, body.text, body.client_op_id)
    if ready is None:
        assert um is not None
        ready = await svc.run_turn(db, settings, request.app.state.llm, request.app.state.embedder, user, um)
    message = message_out(ready)

    async def gen() -> AsyncIterator[str]:
        text = next((b.text for b in message.blocks if getattr(b, "type", None) == "paragraph"), "")
        words = text.split(" ") if text else []
        for i, w in enumerate(words):
            yield _sse({"type": "delta", "text": w if i == len(words) - 1 else w + " "})
        for b in message.blocks:
            if getattr(b, "type", None) != "paragraph":
                yield _sse({"type": "block", "block": b.model_dump(mode="json", by_alias=True)})
        yield _sse({"type": "done", "message": message.model_dump(mode="json", by_alias=True)})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/options/{option_id}", response_model=ChatMessageOut, responses={403: {"model": ErrorOut, "description": "`plan_required` (rinegoziazione in mantenimento)"}, 404: {"model": ErrorOut}, 409: {"model": ErrorOut, "description": "`option_already_chosen`"}, **ERROR_RESPONSES}, summary="Scegli un'opzione del coach: il motore ricalcola, il coach conferma. Non consuma quota.")
async def choose_option(option_id: str, body: ChatOptionIn, request: Request, db: DbDep, settings: SettingsDep, user: UserDep) -> ChatMessageOut:
    cm = await svc.choose_option(db, settings, request.app.state.llm, user, option_id, body.message_id)
    return message_out(cm)


@router.get("/quota", response_model=ChatQuotaOut, responses=ERROR_RESPONSES)
async def quota(db: DbDep, settings: SettingsDep, user: UserDep) -> ChatQuotaOut:
    ent = await ent_service.get_entitlement(db, user)
    q = await quota_service.get_quota(db, settings, user, ent_service.is_pro(ent))
    return ChatQuotaOut(used=q.used, limit=q.limit, resets_at=q.resets_at, daily_used=q.daily_used, daily_limit=q.daily_limit, exhausted=q.exhausted)


@router.get("/texts", response_model=ChatTextsOut, summary="Testi fissi (pubblica): badge AI (con nota di sistema), righe di contesto del paywall, email di supporto")
async def texts(db: DbDep, settings: SettingsDep) -> ChatTextsOut:
    return ChatTextsOut(**(await svc.chat_texts(db, settings)))
