"""GET /today: la seduta di oggi o uno stato vuoto del coach. È qui che vive il coach mentale."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import today_local
from app.config import Settings
from app.llm.base import LLMProvider
from app.models import ChatMessage, Entitlement, Mesocycle, PlannedSession, User
from app.schemas.plans import EmptyStateOut, SessionPreviewOut, TodayOptionAction, TodayOptionOut, TodayOut
from app.services import entitlements as ent_service
from app.services import events
from app.services import plans as plans_service
from app.services.coach import create_proactive_message
from app.services.dates_it import human_date
from app.services.notes import KnowledgeIndex, NoteBook


def _route(target: str) -> TodayOptionAction:
    return TodayOptionAction(type="route", target=target)


def _chat(option_id: str, message_id: uuid.UUID) -> TodayOptionAction:
    return TodayOptionAction(type="chat_option", target=option_id, message_id=message_id)


def short_or_full_options() -> list[dict]:
    """Le due scelte di `week_skipped` e `return_after_break` (design §2.10): corta o intera, la prossima seduta.

    Sono esattamente quelle che `/today` offre in `empty_state.options`: il messaggio in chat e la schermata devono
    portare le stesse opzioni, altrimenti un tap su "Intera" finisce in 404.
    """
    return [
        {"id": "short_tomorrow", "label": "Corta", "description": "La prossima seduta in 25 minuti: gli esercizi principali, stessi carichi", "is_pro": False, "chosen": False},
        {"id": "full", "label": "Intera", "description": "La prossima seduta com'è nel piano, tutta", "is_pro": False, "chosen": False},
    ]


def no_day_options(engine_active: bool) -> list[dict]:
    """Le tre scelte del giorno no. In mantenimento la terza è Pro (business-model §6)."""
    return [
        {"id": "short_tomorrow", "label": "Corta, domani", "description": "25 minuti, gli esercizi principali, stessi carichi", "is_pro": False, "chosen": False},
        {"id": "move", "label": "Sposta", "description": "La seduta va al prossimo giorno libero della settimana", "is_pro": False, "chosen": False}
        if engine_active
        else {"id": "rest", "label": "Riposo", "description": "Oggi niente; la prossima seduta resta com'è", "is_pro": False, "chosen": False},
        {"id": "renegotiate", "label": "Riposo, e rifaccio la settimana" if engine_active else "Rinegozia la settimana", "description": "Il motore ricalcola le sedute rimaste", "is_pro": not engine_active, "chosen": False},
    ]


def option_chosen(msg: ChatMessage | None) -> bool:
    """True se l'utente ha già scelto un'opzione del messaggio: lo stato vuoto che lo porta è chiuso (QA G5)."""
    if msg is None:
        return False
    for b in msg.blocks or []:
        if b.get("type") == "options" and any(o.get("chosen") for o in b.get("options") or []):
            return True
    return False


async def _already_answered(db: AsyncSession, session: PlannedSession) -> bool:
    """Il giorno no / bentornato di questa seduta è già stato risolto con una scelta."""
    if session.no_day_message_id is None:
        return False
    return option_chosen(await db.get(ChatMessage, session.no_day_message_id))


async def ensure_no_day_message(db: AsyncSession, settings: Settings, llm: LLMProvider, user: User, session: PlannedSession, *, now: datetime | None = None, protocol: str = "no_day") -> ChatMessage:
    if session.no_day_message_id is not None:
        msg = await db.get(ChatMessage, session.no_day_message_id)
        if msg is not None:
            return msg
    ent = await db.get(Entitlement, user.id)
    meso = await db.get(Mesocycle, session.mesocycle_id)
    active = ent_service.engine_active(ent, meso)
    context = f"Seduta saltata: {session.name} del {session.date.isoformat()}. Settimana {session.week_n}."
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    if protocol == "return_after_break":
        nb.n("return.after_break")
    options = short_or_full_options() if protocol in ("return_after_break", "week_skipped") else no_day_options(active)
    msg = await create_proactive_message(db, llm, user, protocol=protocol, context=context, notes=nb.notes(), options=options)
    session.no_day_message_id = msg.id
    await events.record(db, user.id, "no_day_triggered", {"session_id": str(session.id), "protocol": protocol})
    await db.flush()
    return msg


async def build_today(db: AsyncSession, settings: Settings, llm: LLMProvider, user: User, today: date | None = None) -> TodayOut:
    today = today or today_local(settings.timezone)
    meso = await plans_service.require_mesocycle(db, user.id, load_all=True)
    ent = await ent_service.get_entitlement(db, user)
    await plans_service.refresh_status(db, meso, user, today)
    if meso.status == "maintenance":
        rules, catalog = await plans_service.engine_inputs(db)
        await plans_service.ensure_maintenance_weeks(db, meso, user, today, rules, catalog)
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    sessions = sorted((s for w in meso.weeks for s in w.sessions), key=lambda s: (s.date, s.index_in_week))

    if meso.status == "completed":
        await events.record(db, user.id, "paywall_shown", {"surface": "end_of_block"})
        nb.n("maintenance.repeat_week")
        await db.commit()
        return TodayOut(
            kind="block_completed",
            date=today,
            readiness_required=False,
            empty_state=EmptyStateOut(
                title=f"Blocco {meso.index}, chiuso.",
                coach_text=nb.mark("Quattro settimane di numeri tuoi. Il blocco successivo lo costruisco su quelli; oppure la settimana si ripete uguale[[rule:maintenance.repeat_week]]."),
                notes=nb.notes(),
                options=[
                    TodayOptionOut(id="build_block_2", label=f"Costruisci il blocco {meso.index + 1}", is_pro=not ent_service.is_pro(ent), action=_route(f"/blocco/{meso.index}/riepilogo")),
                    TodayOptionOut(id="continue_maintenance", label="Continua in mantenimento — gratis", action=_route("/settimana")),
                ],
            ),
        )

    todays = next((s for s in sessions if s.date == today), None)
    if todays is not None:
        await db.commit()
        return TodayOut(
            kind="session",
            date=today,
            readiness_required=todays.readiness is None and todays.status == "planned",
            session_preview=SessionPreviewOut(
                session_id=todays.id,
                name=todays.name,
                exercises_count=len([e for e in todays.exercises if not e.removed_today]),
                est_minutes=todays.est_minutes,
                short_available=todays.status == "planned" and not todays.short_version,
                status=todays.status,
            ),
        )

    past = [s for s in sessions if s.date < today]
    last_closed = max((s for s in past if s.closed_at is not None and s.status != "skipped"), key=lambda s: s.date, default=None)
    last_past = past[-1] if past else None

    # ritorno dopo >= 2 settimane senza sedute (con almeno una fatta prima); finché l'utente non ha scelto Corta/Intera
    is_return = last_closed is not None and (today - last_closed.date).days >= 14 and any(s.status == "skipped" for s in past if s.date > last_closed.date)
    skipped_session = next((s for s in reversed(past) if s.status == "skipped"), None) if is_return else None
    if skipped_session is not None and not await _already_answered(db, skipped_session):
        weeks = (today - last_closed.date).days // 7
        msg = await ensure_no_day_message(db, settings, llm, user, skipped_session, protocol="return_after_break")
        nb.n("return.after_break")
        await db.commit()
        return TodayOut(
            kind="return_after_break",
            date=today,
            readiness_required=False,
            empty_state=EmptyStateOut(
                title=f"Bentornato. Sono passate {weeks} settimane.",
                coach_text=nb.mark("Il corpo ricorda più di quanto credi: si riparte un gradino sotto e si risale in fretta[[rule:return.after_break]]."),
                notes=nb.notes(),
                options=[
                    TodayOptionOut(id="short_tomorrow", label="Corta", action=_chat("short_tomorrow", msg.id)),
                    TodayOptionOut(id="full", label="Intera", action=_chat("full", msg.id)),
                    TodayOptionOut(id="talk", label="Parliamone", action=_route(f"/chat?msg={msg.id}")),
                ],
            ),
            redirect=f"/chat?msg={msg.id}",
        )

    # settimana corrente a zero con >= 2 sedute già passate
    cur_n = plans_service.week_n_for(meso, today)
    cur_week = [s for s in sessions if s.week_n == cur_n]
    cur_past = [s for s in cur_week if s.date < today]
    if len(cur_past) >= 2 and all(s.status == "skipped" for s in cur_past) and not await _already_answered(db, cur_past[-1]):
        msg = await ensure_no_day_message(db, settings, llm, user, cur_past[-1], protocol="week_skipped")
        await db.commit()
        return TodayOut(
            kind="week_skipped",
            date=today,
            readiness_required=False,
            empty_state=EmptyStateOut(
                title=f"Questa settimana: 0 su {len(cur_week)}.",
                coach_text="Ne restano altre. Corta o intera, la prossima è quella che conta.",
                notes=[],
                options=[
                    TodayOptionOut(id="short_tomorrow", label="Sì, corta", action=_chat("short_tomorrow", msg.id)),
                    TodayOptionOut(id="full", label="No, intera", action=_chat("full", msg.id)),
                    TodayOptionOut(id="talk", label="Parliamone", action=_route(f"/chat?msg={msg.id}")),
                ],
            ),
            redirect=f"/chat?msg={msg.id}",
        )

    # ultima seduta pianificata saltata (ieri o prima, entro 3 giorni): giorno no -> chat
    if last_past is not None and last_past.status == "skipped" and (today - last_past.date).days <= 3 and not await _already_answered(db, last_past):
        prev = past[-2] if len(past) >= 2 else None
        protocol = "second_skip" if (prev is not None and prev.status == "skipped") else "no_day"
        msg = await ensure_no_day_message(db, settings, llm, user, last_past, protocol=protocol)
        await db.commit()
        return TodayOut(kind="session_skipped", date=today, readiness_required=False, redirect=f"/chat?msg={msg.id}")

    nxt = next((s for s in sessions if s.date > today), None)
    if meso.status == "maintenance":
        nb.n("maintenance.repeat_week")
        await db.commit()
        return TodayOut(
            kind="maintenance",
            date=today,
            readiness_required=False,
            empty_state=EmptyStateOut(
                title=f"Blocco {meso.index} chiuso. La settimana ora si ripete.",
                coach_text=nb.mark("Stessi esercizi, stesse serie, stessi carichi[[rule:maintenance.repeat_week]]. La seduta si logga come sempre."),
                notes=nb.notes(),
                options=[
                    TodayOptionOut(id="summary", label="Vedi il riepilogo del blocco", action=_route(f"/blocco/{meso.index}/riepilogo")),
                    TodayOptionOut(id="next", label="Vedi la prossima seduta", action=_route(f"/settimana")),
                ],
            ),
        )
    await db.commit()
    return TodayOut(
        kind="rest_day",
        date=today,
        readiness_required=False,
        empty_state=EmptyStateOut(
            title="Oggi: recupero.",
            coach_text=("La prossima seduta è " + (f"{human_date(nxt.date)}: {nxt.name}." if nxt else "nel prossimo blocco.")) + " Il recupero è parte del piano, non una pausa da esso.",
            notes=[],
            options=[
                TodayOptionOut(id="next", label="Vedi la prossima seduta", action=_route("/settimana")),
                TodayOptionOut(id="talk", label="Parla col coach", action=_route("/chat")),
            ],
        ),
    )
