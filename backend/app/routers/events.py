from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import DbDep, UserDep
from app.models import ProductEvent, User
from app.schemas.chat import EventIn, EventOut
from app.schemas.common import ERROR_RESPONSES
from app.services import events as svc

router = APIRouter(prefix="/events", tags=["account"])


def _out(e: ProductEvent) -> EventOut:
    return EventOut(id=e.id, name=e.name, props=e.props, source=e.source, at=e.created_at)


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED, responses=ERROR_RESPONSES, summary="Eventi emessi dalla UI (install, paywall_shown, checkout_started)")
async def post_event(body: EventIn, db: DbDep, user: UserDep) -> EventOut:
    if body.name == "installed":
        user.pwa_installed_reported = True
    ev = await svc.record(db, user.id, body.name, body.props, source="client")
    await db.commit()
    return _out(ev)


@router.get("/mine", response_model=list[EventOut], responses=ERROR_RESPONSES, summary="I propri eventi (per debug e per l'export)")
async def my_events(db: DbDep, user: UserDep) -> list[EventOut]:
    rows = (await db.execute(select(ProductEvent).where(ProductEvent.user_id == user.id).order_by(ProductEvent.created_at))).scalars().all()
    return [_out(e) for e in rows]
